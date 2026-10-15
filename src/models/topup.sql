-- =====================================================
-- FLEXPAY: TABELA DE RECARGAS INTERNACIONAIS
-- =====================================================
DROP TABLE IF EXISTS public.topups CASCADE;

CREATE TABLE IF NOT EXISTS public.topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    wallet_id UUID NOT NULL REFERENCES public.wallets (id),
    profile_id UUID NOT NULL REFERENCES public.profiles (id),
    statement_id UUID REFERENCES public.wallet_transaction_balances (id),
    transfer_id TEXT DEFAULT NULL,
    sku_code TEXT NOT NULL,
    account_number TEXT NOT NULL,
    send_value NUMERIC(18, 2) NOT NULL,
    send_currency currencies NOT NULL,
    received_value NUMERIC(18, 2) NOT NULL,
    received_currency currencies NOT NULL,
    fee NUMERIC(18, 2) NOT NULL DEFAULT 0,
    fee_provider NUMERIC(18, 2) NOT NULL DEFAULT 0,
    send_value_with_fee NUMERIC(18, 2) GENERATED ALWAYS AS (send_value - fee) STORED,
    distributor_ref UUID,
    status statuses NOT NULL DEFAULT 'pending',
    error_code TEXT,
    error_message TEXT,
    raw_api_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT topups_send_value_positive CHECK (send_value > 0),
    CONSTRAINT topups_received_value_nonnegative CHECK (received_value >= 0),
    CONSTRAINT topups_fee_nonnegative CHECK (fee >= 0),
    CONSTRAINT topups_fee_provider_nonnegative CHECK (fee_provider >= 0),
    CONSTRAINT topups_send_value_with_fee_nonnegative CHECK (send_value_with_fee >= 0)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_topups_wallet_id ON public.topups (wallet_id);

CREATE INDEX IF NOT EXISTS idx_topups_profile_id ON public.topups (profile_id);

CREATE INDEX IF NOT EXISTS idx_topups_status ON public.topups (status);

CREATE INDEX IF NOT EXISTS idx_topups_created_at ON public.topups (created_at DESC);

-- =====================================================
-- ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_topups_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topups_updated_at ON public.topups;

CREATE TRIGGER trg_topups_updated_at
BEFORE UPDATE ON public.topups
FOR EACH ROW
EXECUTE FUNCTION public.set_topups_updated_at();

NOTIFY pgrst, 'reload schema';

-- =====================================================
-- FUNÇÃO DE CRIAÇÃO DE TOPUP
-- =====================================================

DROP FUNCTION IF EXISTS public.create_topup;

CREATE OR REPLACE FUNCTION public.create_topup(
    p_profile_id UUID,
    p_type public.profile_type,
    p_sku_code TEXT,
    p_send_value NUMERIC,
    p_account_number TEXT,
    p_send_currency public.currencies,
    p_transfer_id TEXT,
    p_received_value NUMERIC,
    p_distributor_ref UUID,
    p_received_currency public.currencies,
    p_fee NUMERIC,
    p_fee_provider NUMERIC,
    p_error_code TEXT,
    p_error_message TEXT,
    p_raw_api_response JSONB
)
RETURNS public.topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_wallet RECORD;
    v_topup public.topups;
    v_total_debit NUMERIC(18,2);
    v_profile_id UUID;
    v_statement RECORD;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
BEGIN
    -- 1. Validar os parâmetros
    IF p_profile_id IS NULL THEN
        RAISE EXCEPTION 'The top-up actor is required';
    END IF;

    IF p_type IS NULL THEN
        RAISE EXCEPTION 'The profile type is required';
    END IF;

    IF p_send_value IS NULL OR p_send_value <= 0 THEN
        RAISE EXCEPTION 'The send value must be greater than zero';
    END IF;

    IF p_received_value IS NULL OR p_received_value < 0 THEN
        RAISE EXCEPTION 'The received value is invalid';
    END IF;

    IF NULLIF(TRIM(p_sku_code), '') IS NULL
       OR NULLIF(TRIM(p_account_number), '') IS NULL THEN
        RAISE EXCEPTION 'SKU and account number are required';
    END IF;

    IF COALESCE(p_fee, 0) < 0
       OR COALESCE(p_fee_provider, 0) < 0 THEN
        RAISE EXCEPTION 'Fees cannot be negative';
    END IF;

    IF p_send_currency IS NULL
       OR p_received_currency IS NULL THEN
        RAISE EXCEPTION 'Currencies are required';
    END IF;

    -- 2. Determinar o perfil dono da carteira
    v_profile_id := p_profile_id;

    IF p_type = 'employee'::public.profile_type THEN
        SELECT cm.company_id
        INTO v_profile_id
        FROM public.company_members AS cm
        WHERE cm.profile_id = p_profile_id
        AND cm.active::BOOLEAN = TRUE
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'You do not belong to any active company';
        END IF;

    ELSIF p_type NOT IN ('user'::public.profile_type, 'company'::public.profile_type) THEN
        RAISE EXCEPTION 'Profile type not allowed';
    END IF;

    -- 3. Encontrar e bloquear a carteira
    SELECT
        w.id,
        w.profile_id,
        w.balance
    INTO v_wallet
    FROM public.wallets AS w
    WHERE w.profile_id = v_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    -- 4. Verificar a referência do distribuidor
    IF p_distributor_ref IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.topups AS t
           WHERE t.distributor_ref = p_distributor_ref
       ) THEN
        RAISE EXCEPTION 'This top-up reference has already been used';
    END IF;

    -- 5. Calcular o débito conforme a regra solicitada
    v_total_debit := ROUND(
        p_send_value
        - COALESCE(p_fee, 0)
        - COALESCE(p_fee_provider, 0),
        2
    );

    IF v_total_debit <= 0 THEN
        RAISE EXCEPTION 'The debit amount must be greater than zero';
    END IF;

    IF v_wallet.balance < v_total_debit THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    v_balance_before := v_wallet.balance;
    v_balance_after := v_wallet.balance - v_total_debit;

    -- 6. Debitar somente a carteira selecionada
    UPDATE public.wallets
    SET balance = balance - v_total_debit
    WHERE id = v_wallet.id;

    -- 6.1. Inserir no extrato (statements)
    INSERT INTO public.statements (
        wallet_id,
        profile_id,
        balance_before,
        amount,
        nature,
        balance_after,
        currency,
        status
    )
    VALUES (
        v_wallet.id,
        v_profile_id,
        v_balance_before,
        v_total_debit,
        'debit',
        v_balance_after,
        p_send_currency,
        'completed'::public.statuses
    )
    RETURNING * INTO v_statement;

    -- 7. Registrar a recarga
    INSERT INTO public.topups (
        wallet_id,
        profile_id,
        transfer_id,
        sku_code,
        account_number,
        send_value,
        send_currency,
        received_value,
        received_currency,
        fee,
        fee_provider,
        distributor_ref,
        statement_id,
        status,
        error_code,
        error_message,
        raw_api_response
    )
    VALUES (
        v_wallet.id,
        v_profile_id,
        p_transfer_id,
        p_sku_code,
        p_account_number,
        p_send_value,
        p_send_currency,
        p_received_value,
        p_received_currency,
        COALESCE(p_fee, 0),
        COALESCE(p_fee_provider, 0),
        p_distributor_ref,
        v_statement.id,
        'pending',
        p_error_code,
        p_error_message,
        p_raw_api_response
    )
    RETURNING * INTO v_topup;

    RETURN v_topup;
END;
$function$;

-- =====================================================
-- FUNÇÃO DE ESTORNO DE TOPUP
-- =====================================================

DROP FUNCTION IF EXISTS public.refund_topup CASCADE;

CREATE OR REPLACE FUNCTION public.refund_topup(
    p_topup_id UUID,
    p_error_code TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_raw_api_response JSONB DEFAULT NULL
)
RETURNS public.topups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_topup public.topups;
    v_wallet RECORD;
    v_refund_amount NUMERIC(18,2);
BEGIN
    -- 1. Bloquear a recarga para evitar estornos concorrentes
    SELECT t.*
    INTO v_topup
    FROM public.topups AS t
    WHERE t.id = p_topup_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recarga não encontrada';
    END IF;

    -- 2. Se já foi estornada, não devolver novamente
    IF v_topup.status = 'refunded' THEN
        RETURN v_topup;
    END IF;

    -- Só estornar recargas ainda não concluídas
    IF v_topup.status NOT IN ('pending', 'failed') THEN
        RAISE EXCEPTION
            'Não é possível estornar uma recarga com status %',
            v_topup.status;
    END IF;

    -- 3. Calcular o valor debitado originalmente
    v_refund_amount := ROUND(
        v_topup.send_value
        - COALESCE(v_topup.fee, 0)
        - COALESCE(v_topup.fee_provider, 0),
        2
    );

    IF v_refund_amount <= 0 THEN
        RAISE EXCEPTION 'Valor de estorno inválido';
    END IF;

    -- 4. Bloquear a carteira
    SELECT w.id, w.balance
    INTO v_wallet
    FROM public.wallets AS w
    WHERE w.id = v_topup.wallet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carteira da recarga não encontrada';
    END IF;

    -- 4.1. Registrar a transação de estorno
    INSERT INTO public.wallet_transaction_balances (
        wallet_id,
        profile_id,
        father_id,
        balance_before,
        amount,
        balance_after,
        balance_after,
        nature,
        currency,
        status
    )
    VALUES (
        v_wallet.id,
        v_topup.profile_id,
        v_topup.statement_id,
        v_wallet.balance,
        v_refund_amount,
        v_wallet.balance + v_refund_amount,
        v_refund_amount,
        'credit',
        v_topup.currency,
        'completed'
    );

    -- 5. Devolver o saldo
    UPDATE public.wallets
    SET balance = balance + v_refund_amount
    WHERE id = v_wallet.id;

    -- 6. Marcar a recarga como estornada
    UPDATE public.topups
    SET status = 'refunded',
        error_code = COALESCE(p_error_code, error_code),
        error_message = COALESCE(p_error_message, error_message),
        raw_api_response = COALESCE(
            p_raw_api_response,
            raw_api_response
        ),
        updated_at = NOW()
    WHERE id = p_topup_id
    RETURNING * INTO v_topup;

    RETURN v_topup;
END;
$function$;

-- get_topup_history
DROP FUNCTION IF EXISTS public.get_topup_history (UUID);

CREATE OR REPLACE FUNCTION public.get_topup_history(
    p_profile_id UUID
)
RETURNS TABLE(
    id UUID,
    status statuses,
    send_value NUMERIC(18,2),
    send_currency currencies,
    received_value NUMERIC(18,2),
    received_currency currencies,
    fee NUMERIC(18,2),
    fee_provider NUMERIC(18,2),
    error_code TEXT,
    error_message TEXT,
    raw_api_response JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.status,
        t.send_value::NUMERIC(18,2),
        t.send_currency,
        t.received_value::NUMERIC(18,2),
        t.received_currency,
        t.fee::NUMERIC(18,2),
        t.fee_provider::NUMERIC(18,2),
        t.error_code::TEXT,
        t.error_message::TEXT,
        t.raw_api_response,
        t.created_at AT TIME ZONE 'UTC',
        t.updated_at AT TIME ZONE 'UTC'
    FROM public.topups AS t
    WHERE t.profile_id = p_profile_id
    ORDER BY t.created_at DESC;
END;
$function$;

SELECT *
FROM public.get_topup_history (
        'a2de45d4-1781-4f34-b6f9-c27e381bd2e4'
    );

NOTIFY pgrst, 'reload schema';