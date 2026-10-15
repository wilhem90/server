-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE status_profil AS ENUM (
    'active',
    'inactive',
    'banned',
    'suspended',
    'pending'
);

CREATE TYPE currencies AS ENUM (
    'BRL',
    'USD',
    'EUR',
    'HTG',
    'MXN',
    'CLP',
    'DOP'
);

CREATE TYPE profile_type AS ENUM (
    'user',
    'employee',
    'company',
    'admin',
    'superadmin',
    'owner',
    'manager'
);

CREATE TYPE service_name AS ENUM (
    'topup',
    'money_transfer',
    'betting',
    'withdraw'
);
-- ============================================================
-- 2. PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email CITEXT NOT NULL UNIQUE,
    username CITEXT NOT NULL UNIQUE,
    fullname TEXT NOT NULL,
    phone TEXT,
    status status_profil NOT NULL DEFAULT 'active',
    need_wallet BOOLEAN NOT NULL DEFAULT FALSE,
    type profile_type NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_profiles_auth_users FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles (status);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles (phone);

-- ============================================================
-- 3. WALLETS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS wallets_id_seq START
WITH
    10000 INCREMENT BY 1;

DROP TABLE IF EXISTS wallets;

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    profile_id UUID NOT NULL,
    balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    account_number TEXT NOT NULL UNIQUE DEFAULT nextval('wallets_id_seq'),
    currency currencies NOT NULL DEFAULT 'BRL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_wallets_profiles FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    CONSTRAINT chk_wallet_balance CHECK (balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallets_profile_id ON wallets (profile_id);

-- ============================================================
-- 4. SERVICES
-- ============================================================

DROP TABLE IF EXISTS services CASCADE;

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    code service_name NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_active ON services (active);

INSERT INTO
    services (code, description)
VALUES (
        'topup',
        'Recarga internacional'
    ),
    (
        'money_transfer',
        'Transferência de valores'
    ),
    (
        'betting',
        'Serviço de apostas'
    ),
    ('withdraw', 'Saque de saldo')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5. PRICING RULES
-- Preços padrão do sistema
-- ============================================================

DROP TABLE IF EXISTS pricing_rules CASCADE;

CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    service_code service_name NOT NULL,
    max_value NUMERIC(18, 2) NOT NULL,
    min_value NUMERIC(18, 2) NOT NULL,
    price_step NUMERIC(18, 2) NOT NULL,
    start_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    end_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    fee_fixed NUMERIC(18, 2) NOT NULL DEFAULT 0,
    fee_provider NUMERIC(18, 2) NOT NULL DEFAULT 0,
    currency currencies NOT NULL DEFAULT 'BRL',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_pricing_rules_service FOREIGN KEY (service_code) REFERENCES services (code) ON DELETE CASCADE,
    CONSTRAINT chk_pricing_rules_range CHECK (max_value > min_value),
    CONSTRAINT chk_pricing_rules_min_value CHECK (min_value >= 0),
    CONSTRAINT chk_pricing_rules_fee_provider CHECK (fee_provider >= 0),
    CONSTRAINT chk_pricing_rules_fee_fixed CHECK (fee_fixed >= 0),
    CONSTRAINT chk_pricing_rules_dates CHECK (
        effective_to IS NULL
        OR effective_to > effective_from
    )
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_service ON pricing_rules (service_code);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_service_active ON pricing_rules (service_code)
WHERE
    active = TRUE;

CREATE INDEX IF NOT EXISTS idx_pricing_rules_metadata ON pricing_rules USING GIN (metadata);

-- ============================================================
-- 6. PREÇO PADRÃO - TOPUP
-- ============================================================

INSERT INTO
    pricing_rules (
        service_code,
        min_value,
        max_value,
        price_step,
        start_percent,
        end_percent,
        fee_fixed,
        fee_provider,
        currency
    )
SELECT s.code, 10, 1000, 1, 0, 0, 0, 0, 'BRL'
FROM services s
WHERE
    s.code = 'topup'
    AND NOT EXISTS (
        SELECT 1
        FROM pricing_rules pr
        WHERE
            pr.service_code = s.code
            AND pr.min_value = 10
            AND pr.max_value = 1000
            AND pr.price_step = 1
            AND pr.start_percent = 0
            AND pr.end_percent = 0
            AND pr.fee_fixed = 0
            AND pr.fee_provider = 0
            AND pr.currency = 'BRL'
    )
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. COMPANY PRICING RULES
-- Preços personalizados por empresa
-- ============================================================

DROP TABLE IF EXISTS company_pricing_rules CASCADE;

CREATE TABLE IF NOT EXISTS company_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    company_id UUID NOT NULL,
    service_code service_name NOT NULL,
    max_value NUMERIC(18, 2) NOT NULL,
    min_value NUMERIC(18, 2) NOT NULL,
    price_step NUMERIC(18, 2) NOT NULL,
    start_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    end_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    fee_fixed NUMERIC(18, 2) NOT NULL DEFAULT 0,
    fee_provider NUMERIC(18, 2) NOT NULL DEFAULT 0,
    currency currencies NOT NULL DEFAULT 'BRL',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_company_pricing_type_company FOREIGN KEY (company_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_company_pricing_service FOREIGN KEY (service_code) REFERENCES services (code) ON DELETE CASCADE,
    CONSTRAINT chk_company_pricing_range CHECK (max_value > min_value),
    CONSTRAINT chk_company_pricing_min_value CHECK (min_value >= 0),
    CONSTRAINT chk_company_pricing_fee_provider CHECK (fee_provider >= 0),
    CONSTRAINT chk_company_pricing_fee_fixed CHECK (fee_fixed >= 0),
    CONSTRAINT chk_company_pricing_dates CHECK (
        effective_to IS NULL
        OR effective_to > effective_from
    )
);

CREATE INDEX IF NOT EXISTS idx_company_pricing_company ON company_pricing_rules (company_id);

CREATE INDEX IF NOT EXISTS idx_company_pricing_company_service ON company_pricing_rules (company_id, service_code);

CREATE INDEX IF NOT EXISTS idx_company_pricing_active ON company_pricing_rules (company_id, service_code)
WHERE
    active = TRUE;

CREATE INDEX IF NOT EXISTS idx_company_pricing_metadata ON company_pricing_rules USING GIN (metadata);

-- ============================================================
-- 8. UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;

CREATE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_services_updated_at ON services;

CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pricing_rules_updated_at ON pricing_rules;

CREATE TRIGGER trg_pricing_rules_updated_at
BEFORE UPDATE ON pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_company_pricing_rules_updated_at ON company_pricing_rules;

CREATE TRIGGER trg_company_pricing_rules_updated_at
BEFORE UPDATE ON company_pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. COMPANY MEMBERS

CREATE TABLE IF NOT EXISTS company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    company_id UUID NOT NULL,
    profile_id UUID NOT NULL UNIQUE,
    role profile_type NOT NULL DEFAULT 'employee',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_company_members_company FOREIGN KEY (company_id) REFERENCES profiles (id) ON DELETE CASCADE,
    CONSTRAINT fk_company_members_profile FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    CONSTRAINT uq_company_members UNIQUE (company_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members (company_id);

CREATE INDEX IF NOT EXISTS idx_company_members_profile_id ON company_members (profile_id);

CREATE INDEX IF NOT EXISTS idx_company_members_active ON company_members (company_id, active);

-- ============================================================
-- 9. NOVO USUÁRIO
-- ============================================================

DROP FUNCTION IF EXISTS public.handle_new_profile() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fullname TEXT;
    v_username TEXT;
    v_need_wallet BOOLEAN;
    v_type profile_type;
    v_phone TEXT;
    v_owner_id UUID;
    v_company_id UUID;
BEGIN
    v_phone := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'phone', ''),
        NULL
    );

    v_username := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'user_name', ''),
        split_part(COALESCE(NEW.email, ''), '@', 1)
    );

    v_fullname := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(COALESCE(NEW.email, ''), '@', 1)
    );

    v_need_wallet := COALESCE(
        (NEW.raw_user_meta_data->>'need_wallet')::BOOLEAN,
        FALSE
    );

    v_type := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'type_profile', ''),
        'user'
    );

    v_owner_id := COALESCE(NULLIF(NEW.raw_user_meta_data->>'owner_id', ''), NULL)::UUID;
    
    v_company_id := COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_id', ''), NULL)::UUID;

    INSERT INTO public.profiles (
        id,
        email,
        username,
        fullname,
        phone,
        need_wallet,
        type
    )
    VALUES (
        NEW.id,
        NEW.email,
        v_username,
        v_fullname,
        v_phone,
        v_need_wallet,
        v_type
    );

    IF v_need_wallet THEN

        INSERT INTO public.wallets (
            profile_id,
            balance
        )
        VALUES (
            NEW.id,
            0
        );

    END IF;

    -- IF COMPANY PROFILE, OWNER ADD DEFAULT ENTRIES
    IF v_type = 'company' AND v_owner_id IS NOT NULL THEN
        INSERT INTO public.company_members (
            company_id,
            profile_id,
            role,
            active
        )
        VALUES (
            NEW.id,
            v_owner_id,
            'owner',
            TRUE
    );

    END IF;

    -- IF USER PROFILE, employee ADD DEFAULT ENTRIES
    IF v_type = 'employee' AND v_company_id IS NOT NULL THEN
        INSERT INTO public.company_members (
            company_id,
            profile_id,
            role,
            active
        )
        VALUES (
            v_company_id,
            NEW.id,
            'employee',
            TRUE
        );
    END IF;

    RETURN NEW;

END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_profile();

-- ============================================================
-- 10. CONSULTAR PREÇO
-- ============================================================

-- Get profile by username function
DROP FUNCTION IF EXISTS public.get_profile_by_username (TEXT);

CREATE OR REPLACE FUNCTION public.get_profile_by_username(p_username TEXT)
RETURNS TABLE(
    id UUID,
    email CITEXT,
    username CITEXT,
    fullname TEXT,
    phone TEXT,
    status status_profil,
    need_wallet BOOLEAN,
    type profile_type,
    wallet_id UUID,
    wallet_account_number TEXT,
    wallet_balance NUMERIC,
    wallet_currency currencies,
    is_active_member BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id,
        pr.email,
        pr.username,
        pr.fullname,
        pr.phone,
        pr.status,
        pr.need_wallet,
        pr.type,
        w.id,
        w.account_number,
        w.balance,
        w.currency,
        cm.active IS NOT NULL AS is_active_member
    FROM public.profiles pr
    LEFT JOIN public.company_members cm ON pr.id = cm.profile_id
    LEFT JOIN public.wallets w ON pr.id = w.profile_id OR w.profile_id = cm.company_id
    WHERE pr.username = p_username
    LIMIT 1;
END;
$$;


SELECT *
FROM public.get_profile_by_username('herode1');