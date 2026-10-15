-- ============================================================
-- 1. LIMPEZA (com CASCADE para garantir remoção de dependências)
-- ============================================================
DROP FUNCTION IF EXISTS public.create_intent_transaction CASCADE;

DROP FUNCTION IF EXISTS public.get_transfers CASCADE;

DROP TRIGGER IF EXISTS set_transfers_updated_at ON public.transfers;

DROP TABLE IF EXISTS public.transfers CASCADE;

DROP SEQUENCE IF EXISTS public.transfers_sequence_number_seq CASCADE;

-- ============================================================
-- 2. FUNÇÃO AUXILIAR PARA updated_at (caso não exista)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- ============================================================
-- 3. SEQUÊNCIA
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.transfers_sequence_number_seq START
WITH
    10000 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- ============================================================
-- 4. TABELA transfers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    sequence_number BIGINT NOT NULL DEFAULT nextval(
        'public.transfers_sequence_number_seq'
    ),
    wallet_id UUID DEFAULT NULL,
    created_by UUID NOT NULL,
    client_id BIGINT NOT NULL,
    distributor_ref UUID DEFAULT NULL,
    statement_id UUID DEFAULT NULL,
    beneficiary_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    operator_name TEXT NOT NULL CHECK (
        operator_name IN ('moncash', 'natcash')
    ),
    send_value NUMERIC(10, 2) NOT NULL CHECK (send_value > 0),
    send_currency currencies NOT NULL,
    received_value NUMERIC(10, 2) DEFAULT NULL,
    received_currency currencies DEFAULT NULL,
    fee NUMERIC(10, 2) NOT NULL CHECK (fee >= 0),
    fee_commission NUMERIC(10, 2) NOT NULL CHECK (fee_commission >= 0),
    fee_provider NUMERIC(10, 2) NOT NULL CHECK (fee_provider >= 0),
    send_value_with_tax NUMERIC(10, 2) GENERATED ALWAYS AS (send_value - fee) STORED CHECK (send_value_with_tax >= 0),
    exchange_rate NUMERIC(10, 4) NOT NULL CHECK (exchange_rate > 0),
    delivred_by UUID DEFAULT NULL,
    status statuses NOT NULL DEFAULT 'pending',
    error_message TEXT DEFAULT NULL,
    canceled_by UUID DEFAULT NULL,
    canceled_reason TEXT DEFAULT NULL,
    transfer_externe_id TEXT DEFAULT NULL,
    needed_wallet BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canceled_at TIMESTAMPTZ DEFAULT NULL,
    delivered_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT transfers_delivred_by_fkey FOREIGN KEY (delivred_by) REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT transfers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE CASCADE,
    CONSTRAINT transfers_canceled_by_fkey FOREIGN KEY (canceled_by) REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT transfers_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets (id) ON DELETE CASCADE,
    CONSTRAINT transfers_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.statements (id) ON DELETE CASCADE
);

-- ============================================================
-- 5. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS transfers_sequence_number_idx ON public.transfers (sequence_number);

CREATE INDEX IF NOT EXISTS transfers_client_id_idx ON public.transfers (client_id);

CREATE INDEX IF NOT EXISTS transfers_status_idx ON public.transfers (status);

CREATE INDEX IF NOT EXISTS transfers_wallet_id_idx ON public.transfers (wallet_id);

CREATE INDEX IF NOT EXISTS transfers_created_at_idx ON public.transfers (created_at DESC);

-- Índice composto para a validação dos 30 minutos (anti-duplicidade)
CREATE INDEX IF NOT EXISTS transfers_account_created_idx ON public.transfers (
    account_number,
    created_at DESC
);

-- Índice para busca por transfer_externe_id (integração com operadoras)
CREATE INDEX IF NOT EXISTS transfers_externe_id_idx ON public.transfers (transfer_externe_id)
WHERE
    transfer_externe_id IS NOT NULL;

-- ============================================================
-- 6. TRIGGER para updated_at automático
-- ============================================================
DROP TRIGGER IF EXISTS set_transfers_updated_at ON public.transfers;

CREATE TRIGGER set_transfers_updated_at
    BEFORE UPDATE ON public.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. FUNÇÃO: create_intent_transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_intent_transaction(
    p_wallet_id UUID,
    p_created_by UUID,
    p_distributor_ref UUID,
    p_client_id BIGINT,
    p_beneficiary_name TEXT,
    p_account_number TEXT,
    p_operator_name TEXT,
    p_send_value NUMERIC(10,2),
    p_send_currency currencies,
    p_fee NUMERIC(10,2),
    p_fee_commission NUMERIC(10,2),
    p_fee_provider NUMERIC(10,2),
    p_exchange_rate NUMERIC(10,4),
    p_received_value NUMERIC(10,2),
    p_received_currency currencies,
    p_needed_wallet BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_transfer_id      UUID;
    v_statement_id     UUID;
    v_balance_before   NUMERIC(18,2);
    v_balance_after    NUMERIC(18,2);
    v_total_debit      NUMERIC(18,2);
    v_client_exists    BOOLEAN;
    v_recent_transfer  BOOLEAN;
    v_wallet_locked    BOOLEAN;
BEGIN
    -- --------------------------------------------------------
    -- 1. VALIDAÇÕES DE INPUT
    -- --------------------------------------------------------
    IF p_created_by IS NULL THEN
        RAISE EXCEPTION 'Created by cannot be null';
    END IF;

    IF p_client_id IS NULL THEN
        RAISE EXCEPTION 'Client ID cannot be null';
    END IF;

    IF p_distributor_ref IS NULL THEN
        RAISE EXCEPTION 'Distributor reference cannot be null';
    END IF;

    IF NULLIF(TRIM(p_beneficiary_name), '') IS NULL THEN
        RAISE EXCEPTION 'Beneficiary name cannot be null or empty';
    END IF;

    IF NULLIF(TRIM(p_account_number), '') IS NULL THEN
        RAISE EXCEPTION 'Account number cannot be null or empty';
    END IF;

    IF LOWER(COALESCE(p_operator_name, '')) NOT IN ('moncash', 'natcash') THEN
        RAISE EXCEPTION 'Invalid operator name: %', p_operator_name;
    END IF;

    IF p_send_value IS NULL OR p_send_value <= 0 THEN
        RAISE EXCEPTION 'Send value must be greater than zero';
    END IF;

    IF p_send_currency IS NULL THEN
        RAISE EXCEPTION 'Send currency cannot be null';
    END IF;

    IF p_received_currency IS NULL THEN
        RAISE EXCEPTION 'Received currency cannot be null';
    END IF;

    IF p_fee IS NULL OR p_fee < 0
       OR p_fee_commission IS NULL OR p_fee_commission < 0
       OR p_fee_provider IS NULL OR p_fee_provider < 0 THEN
        RAISE EXCEPTION 'Fees must be non-negative';
    END IF;

    -- ⚠️ REGRA DE NEGÓCIO: ajuste conforme definido pela empresa.
    -- Aqui consideramos: send_value DEVE ser >= (fee_provider + fee_commission)
    IF (p_fee_provider + p_fee_commission) > p_send_value THEN
        RAISE EXCEPTION
            'Fees (provider + commission) cannot exceed send_value';
    END IF;

    IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
        RAISE EXCEPTION 'Exchange rate must be greater than zero';
    END IF;

    IF p_received_value IS NULL OR p_received_value < 0 THEN
        RAISE EXCEPTION 'Received value is invalid';
    END IF;

    IF p_needed_wallet IS NULL THEN
        RAISE EXCEPTION 'Needed wallet cannot be null';
    END IF;

    IF p_needed_wallet = TRUE AND p_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet ID is required when needed_wallet = TRUE';
    END IF;

    -- --------------------------------------------------------
    -- 2. VALIDAR CLIENTE EXISTENTE
    -- --------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM public.clients WHERE id = p_client_id
    ) INTO v_client_exists;

    IF NOT v_client_exists THEN
        RAISE EXCEPTION 'Client not found: %', p_client_id;
    END IF;

    -- --------------------------------------------------------
    -- 3. ANTI-DUPLICIDADE: 30 minutos
    -- --------------------------------------------------------
    SELECT EXISTS (
        SELECT 1
        FROM public.transfers AS t
        WHERE t.account_number = p_account_number
          AND t.created_at > NOW() - INTERVAL '30 minutes'
    ) INTO v_recent_transfer;

    IF v_recent_transfer THEN
        RAISE EXCEPTION
            'A recent transfer already exists for this account within the last 30 minutes';
    END IF;

    -- --------------------------------------------------------
    -- 4. BLOQUEAR / DEBITAR CARTEIRA
    -- --------------------------------------------------------
    IF p_needed_wallet THEN
        -- Bloqueia a linha da carteira para evitar race condition
        SELECT w.balance
        INTO v_balance_before
        FROM public.wallets AS w
        WHERE w.id = p_wallet_id
        FOR UPDATE;

        GET DIAGNOSTICS v_wallet_locked = ROW_COUNT;

        IF NOT v_wallet_locked THEN
            RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
        END IF;

        IF v_balance_before IS NULL OR v_balance_before < p_send_value THEN
            RAISE EXCEPTION
                'Insufficient wallet balance. Available: %, Required: %',
                v_balance_before, p_send_value;
        END IF;

        v_total_debit   := p_send_value;
        v_balance_after := v_balance_before - v_total_debit;

        UPDATE public.wallets
        SET balance = v_balance_after
        WHERE id = p_wallet_id;

    ELSE
        -- Não debita, apenas registra o saldo atual (referência)
        SELECT w.balance
        INTO v_balance_before
        FROM public.wallets AS w
        WHERE w.id = p_wallet_id;

        v_balance_after := COALESCE(v_balance_before, 0);
        v_total_debit   := 0;
    END IF;

    -- --------------------------------------------------------
    -- 5. INSERIR STATEMENT (somente se houve débito real)
    -- --------------------------------------------------------
    IF p_needed_wallet THEN
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
            p_wallet_id,
            p_created_by,
            v_balance_before,
            v_total_debit,
            'debit',
            v_balance_after,
            p_send_currency,
            'completed'
        )
        RETURNING id INTO v_statement_id;
    ELSE
        v_statement_id := NULL;
    END IF;

    -- --------------------------------------------------------
    -- 6. REGISTRAR TRANSFERÊNCIA
    -- --------------------------------------------------------
    INSERT INTO public.transfers (
        wallet_id,
        created_by,
        statement_id,
        distributor_ref,
        client_id,
        beneficiary_name,
        account_number,
        operator_name,
        send_value,
        send_currency,
        fee,
        fee_commission,
        fee_provider,
        exchange_rate,
        received_value,
        received_currency,
        needed_wallet
    )
    VALUES (
        p_wallet_id,
        p_created_by,
        v_statement_id,
        p_distributor_ref,
        p_client_id,
        TRIM(p_beneficiary_name),
        TRIM(p_account_number),
        LOWER(p_operator_name),
        p_send_value,
        p_send_currency,
        p_fee,
        p_fee_commission,
        p_fee_provider,
        p_exchange_rate,
        p_received_value,
        p_received_currency,
        p_needed_wallet
    )
    RETURNING id INTO v_transfer_id;

    RETURN v_transfer_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Postgres já faz rollback automático em exceções dentro de funções.
        -- Apenas propagamos para o chamador.
        RAISE;
END;
$$;

-- ============================================================
-- 8. FUNÇÃO: get_transfers
-- ============================================================
DROP FUNCTION IF EXISTS public.get_transfers;

CREATE OR REPLACE FUNCTION public.get_transfers(
    p_wallet_id   UUID   DEFAULT NULL,
    p_employee_id UUID   DEFAULT NULL,
    p_client_id   BIGINT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_limit       INT    DEFAULT 100,
    p_offset      INT    DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    sequence_number BIGINT,
    wallet_id UUID,
    created_by UUID,
    distributor_ref UUID,
    client_id BIGINT,
    beneficiary_name TEXT,
    account_number TEXT,
    operator_name TEXT,
    send_value NUMERIC,
    send_currency currencies,
    fee NUMERIC,
    fee_commission NUMERIC,
    fee_provider NUMERIC,
    send_value_with_tax NUMERIC,
    exchange_rate NUMERIC,
    received_value NUMERIC,
    received_currency currencies,
    needed_wallet BOOLEAN,
    status statuses,
    transfer_externe_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    delivred_by UUID,
    canceled_at TIMESTAMPTZ,
    canceled_by UUID,
    canceled_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_wallet_id IS NULL
       AND p_employee_id IS NULL
       AND p_client_id IS NULL THEN
        RAISE EXCEPTION
            'Informe pelo menos um filtro: carteira, funcionário ou cliente.';
    END IF;

    IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 1000 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 1000';
    END IF;

    IF p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'Offset must be non-negative';
    END IF;

    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Start date must be before end date';
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.sequence_number,
        t.wallet_id,
        t.created_by,
        t.distributor_ref,
        t.client_id,
        t.beneficiary_name,
        t.account_number,
        t.operator_name,
        t.send_value,
        t.send_currency,
        t.fee,
        t.fee_commission,
        t.fee_provider,
        t.send_value_with_tax,
        t.exchange_rate,
        t.received_value,
        t.received_currency,
        t.needed_wallet,
        t.status,
        t.transfer_externe_id,
        t.error_message,
        t.created_at,
        t.updated_at,
        t.delivered_at,
        t.delivred_by,
        t.canceled_at,
        t.canceled_by,
        t.canceled_reason
    FROM public.transfers AS t
    WHERE (p_wallet_id   IS NULL OR t.wallet_id  = p_wallet_id)
      AND (p_employee_id IS NULL OR t.created_by = p_employee_id)
      AND (p_client_id   IS NULL OR t.client_id  = p_client_id)
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    ORDER BY t.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

SELECT *
FROM public.get_transfers (
        '6112b66d-a917-48c8-b921-609ab71624c5', NULL, NULL, 50, 0
    );

-- ============================================================
-- 9. FUNÇÃO EXTRA: contar transferências (útil para paginação)
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_transfers(
    p_wallet_id   UUID   DEFAULT NULL,
    p_employee_id UUID   DEFAULT NULL,
    p_client_id   BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    IF p_wallet_id IS NULL
       AND p_employee_id IS NULL
       AND p_client_id IS NULL THEN
        RAISE EXCEPTION
            'Informe pelo menos um filtro: carteira, funcionário ou cliente.';
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM public.transfers AS t
    WHERE (p_wallet_id   IS NULL OR t.wallet_id  = p_wallet_id)
      AND (p_employee_id IS NULL OR t.created_by = p_employee_id)
      AND (p_client_id   IS NULL OR t.client_id  = p_client_id);

    RETURN v_count;
END;
$$;

-- ============================================================
-- 10. EXEMPLOS DE USO
-- ============================================================
SELECT *
FROM public.count_transfers (
        '6112b66d-a917-48c8-b921-609ab71624c5', NULL, NULL
    );