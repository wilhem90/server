-- ============================================================
-- 0. LIMPEZA SEGURA (evita DROP TABLE acidental)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_wallet_account (UUID, TEXT, TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.get_wallet_company_account (UUID) CASCADE;

DROP FUNCTION IF EXISTS public.pricing_rules_for_current_profile (service_name) CASCADE;

DROP FUNCTION IF EXISTS public.pricing_rules_for_current_company (UUID, service_name) CASCADE;

-- Tabela: só dropa se realmente quiser recriar (COMENTE em produção!)
-- DROP TABLE IF EXISTS public.wallet_transaction_balances CASCADE;

-- ============================================================
-- 1. get_wallet_account
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_wallet_account(
    p_profile_id     UUID DEFAULT NULL,
    p_account_number TEXT DEFAULT NULL,
    p_email          TEXT DEFAULT NULL
)
RETURNS TABLE (
    wallet_id      UUID,
    account_number TEXT,
    balance        NUMERIC,
    fullname       TEXT,
    currency       public.currencies,
    profile_id     UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_profile_id IS NULL
       AND p_account_number IS NULL
       AND p_email IS NULL THEN
        RAISE EXCEPTION 'At least one parameter is required (profile_id, account_number or email)';
    END IF;

    RETURN QUERY
    SELECT
        w.id,
        w.account_number::TEXT,
        w.balance,
        p.fullname::TEXT,
        w.currency,
        p.id
    FROM public.wallets  AS w
    INNER JOIN public.profiles AS p ON p.id = w.profile_id
    WHERE w.profile_id IS NOT NULL
      AND (
            (p_profile_id     IS NOT NULL AND p.id                    = p_profile_id)
         OR (p_account_number IS NOT NULL AND w.account_number::TEXT = p_account_number)
         OR (p_email          IS NOT NULL AND p.email::TEXT          = LOWER(p_email))
      )
    ORDER BY w.id
    LIMIT 1;   -- garante 1 resultado consistente
END;
$$;

-- ============================================================
-- 2. get_wallet_company_account
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_wallet_company_account(
    p_profile_id UUID
)
RETURNS TABLE (
    wallet_id      UUID,
    account_number TEXT,
    balance        NUMERIC,
    currency       public.currencies,
    company_id     UUID,
    active         BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_profile_id IS NULL THEN
        RAISE EXCEPTION 'Profile ID is required.';
    END IF;

    RETURN QUERY
    SELECT
        w.id,
        w.account_number::TEXT,
        w.balance,
        w.currency,
        cm.company_id,
        cm.active
    FROM public.company_members AS cm
    INNER JOIN public.wallets AS w ON w.profile_id = cm.company_id
    WHERE cm.profile_id = p_profile_id
      AND cm.active = TRUE          -- só vínculos ativos
    ORDER BY w.id;
END;
$$;

-- ============================================================
-- 3. pricing_rules_for_current_profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.pricing_rules_for_current_profile(
    p_code service_name
)
RETURNS TABLE (
    id             UUID,
    service_code   service_name,
    max_value      NUMERIC,
    min_value      NUMERIC,
    price_step     NUMERIC,
    start_percent  NUMERIC,
    end_percent    NUMERIC,
    fee_fixed      NUMERIC,
    fee_provider   NUMERIC,
    currency       currencies,
    active         BOOLEAN,
    need_wallet    BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        pr.id,
        pr.service_code,
        pr.max_value,
        pr.min_value,
        pr.price_step,
        pr.start_percent,
        pr.end_percent,
        pr.fee_fixed,
        pr.fee_provider,
        pr.currency,
        pr.active,
        pr.need_wallet
    FROM public.pricing_rules AS pr
    WHERE pr.service_code = p_code
      AND pr.active = TRUE
    ORDER BY pr.min_value ASC NULLS FIRST;
$$;

-- ============================================================
-- 4. pricing_rules_for_current_company
-- ============================================================
CREATE OR REPLACE FUNCTION public.pricing_rules_for_current_company(
    p_profile_id UUID,
    p_code       service_name
)
RETURNS TABLE (
    id             UUID,
    company_id     UUID,
    service_code   service_name,
    max_value      NUMERIC,
    min_value      NUMERIC,
    price_step     NUMERIC,
    start_percent  NUMERIC,
    end_percent    NUMERIC,
    fee_fixed      NUMERIC,
    fee_provider   NUMERIC,
    currency       currencies,
    active         BOOLEAN,
    need_wallet    BOOLEAN,
    effective_from TIMESTAMPTZ,
    effective_to   TIMESTAMPTZ,
    metadata       JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_profile_id IS NULL THEN
        RAISE EXCEPTION 'Profile ID is required.';
    END IF;

    IF p_code IS NULL THEN
        RAISE EXCEPTION 'Service code is required.';
    END IF;

    RETURN QUERY
    SELECT
        cpr.id,
        cpr.company_id,
        cpr.service_code, -- Corrigido: Removido o ::TEXT para não quebrar a assinatura de tipo do retorno
        cpr.max_value,
        cpr.min_value,
        cpr.price_step,
        cpr.start_percent,
        cpr.end_percent,
        cpr.fee_fixed,
        cpr.fee_provider,
        cpr.currency,
        cpr.active,
        cpr.need_wallet,
        cpr.effective_from,
        cpr.effective_to,
        cpr.metadata
    FROM public.company_pricing_rules AS cpr
    INNER JOIN public.company_members AS cm
        ON cm.company_id = cpr.company_id
       AND cm.profile_id = p_profile_id
       AND cm.active = TRUE
    WHERE cpr.service_code = p_code
      AND cpr.active = TRUE
      AND (cpr.effective_from IS NULL OR cpr.effective_from <= NOW())
      AND (cpr.effective_to   IS NULL OR cpr.effective_to   >= NOW())
    ORDER BY cpr.min_value ASC NULLS FIRST;
END;
$$;

-- ============================================================
-- 5. wallet_transaction_balances
-- ============================================================
create table public.statements (
    id uuid not null default gen_random_uuid (),
    wallet_id uuid not null,
    profile_id uuid not null,
    father_id uuid null,
    balance_before numeric not null,
    balance_after numeric not null,
    amount numeric not null,
    nature text not null,
    currency public.currencies not null,
    status public.statuses not null,
    created_at timestamp with time zone null default now(),
    constraint wallet_transaction_balances_pkey primary key (id),
    constraint wallet_transaction_father_id_fkey foreign KEY (father_id) references statements (id),
    constraint wallet_transaction_profile_id_fkey foreign KEY (profile_id) references profiles (id),
    constraint wallet_transaction_wallet_id_fkey foreign KEY (wallet_id) references wallets (id),
    constraint wallet_transaction_nature_fkey check (
        (
            nature = any (
                array['debit'::text, 'credit'::text]
            )
        )
    ),
    constraint balance_after_non_negative check (
        (balance_after >= (0)::numeric)
    ),
    constraint amount_non_negative check ((amount >= (0)::numeric))
) TABLESPACE pg_default;
create index IF not exists idx_wallet_transaction_balances_wallet_id on public.statements using btree (wallet_id) TABLESPACE pg_default;
create index IF not exists idx_wallet_transaction_balances_profile_id on public.statements using btree (profile_id) TABLESPACE pg_default;


-- Get wallet transaction balances
DROP FUNCTION IF EXISTS public.get_wallet_transaction_balances;
CREATE OR REPLACE FUNCTION public.get_wallet_transaction_balances(
    p_wallet_id UUID DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    wallet_id UUID,
    profile_id UUID,
    father_id UUID,
    balance_before NUMERIC,
    balance_after NUMERIC,
    amount NUMERIC,
    nature TEXT,
    currency public.currencies,
    status public.statuses,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.wallet_id,
        s.profile_id,
        s.father_id,
        s.balance_before,
        s.balance_after,
        s.amount,
        s.nature,
        s.currency,
        s.status,
        s.created_at
    FROM public.statements AS s
    LEFT JOIN public.wallets w ON w.id = s.wallet_id
    WHERE (p_wallet_id IS NULL OR s.wallet_id = p_wallet_id)
      AND (p_profile_id IS NULL OR s.profile_id = p_profile_id)
    ORDER BY s.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Example usage
SELECT * FROM public.get_wallet_transaction_balances(
    '6112b66d-a917-48c8-b921-609ab71624c5',
    NULL,
    50,
    0
);