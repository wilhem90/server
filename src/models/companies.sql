drop function if exists public.get_my_companies (UUID);

CREATE OR REPLACE FUNCTION public.get_my_companies(
    p_profile_id UUID
)
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    company_email TEXT,
    role TEXT,
    active BOOLEAN,
    member_id UUID
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        company.id AS company_id,
        company.fullname AS company_name,
        company.email::TEXT AS company_email,
        cm.role::TEXT,
        cm.active,
        cm.id AS member_id
    FROM public.company_members cm
    INNER JOIN public.profiles company
        ON company.id = cm.company_id
    WHERE cm.profile_id = p_profile_id
      AND cm.active = TRUE
      AND company.type = 'company'
    ORDER BY company.created_at;
$$;

-- get company members by company ID

DROP FUNCTION IF EXISTS public.company_members (UUID);

CREATE OR REPLACE FUNCTION public.company_members(
    p_company_id UUID
)
RETURNS TABLE (
    member_id UUID,
    profile_id UUID,
    role TEXT,
    active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        cm.id AS member_id,
        cm.profile_id,
        cm.role::TEXT,
        cm.active
    FROM public.company_members cm
    WHERE cm.company_id = p_company_id
      AND cm.active = TRUE
    ORDER BY cm.created_at;
$$;

-- CREATE TABLE permissions
DROP TABLE IF EXISTS role_permissions;

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    role profile_type NOT NULL UNIQUE,
    permissions JSONB NOT NULL DEFAULT '{}'::JSONB,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT role_permissions_object_check CHECK (
        jsonb_typeof(permissions) = 'object'
    )
);

INSERT INTO
    public.role_permissions (role, permissions)
VALUES (
        'owner',
        '{
        "transfer": {"read": true, "write": true, "update": true},
        "betting":  {"read": true, "write": true, "update": true},
        "topup":    {"read": true, "write": true, "update": true},
        "employees": {"read": true, "write": true, "update": true, "delete": true},
        "wallet": {"read": true, "write": false, "update": false}
    }'::JSONB
    ),
    (
        'admin',
        '{
        "transfer": {"read": true, "write": true, "update": false},
        "betting":  {"read": true, "write": true, "update": false},
        "topup":    {"read": true, "write": true, "update": false},
        "employees": {"read": true, "write": true, "update": true, "delete": false},
        "wallet": {"read": true, "write": false, "update": false}
    }'::JSONB
    ),
    (
        'manager',
        '{
        "transfer": {"read": true, "write": true, "update": false},
        "betting":  {"read": true, "write": true, "update": false},
        "topup":    {"read": true, "write": true, "update": false},
        "employees": {"read": true, "write": false, "update": false, "delete": false},
        "wallet": {"read": true, "write": false, "update": false}
    }'::JSONB
    ),
    (
        'employee',
        '{
        "transfer": {"read": true, "write": true, "update": false},
        "betting":  {"read": true, "write": true, "update": false},
        "topup":    {"read": true, "write": true, "update": false},
        "employees": {"read": false, "write": false, "update": false, "delete": false},
        "wallet": {"read": true, "write": false, "update": false}
    }'::JSONB
    )
ON CONFLICT (role) DO
UPDATE
SET
    permissions = EXCLUDED.permissions,
    active = TRUE,
    updated_at = NOW();

DROP SEQUENCE IF EXISTS public.clients_id_seq;

CREATE SEQUENCE IF NOT EXISTS public.clients_id_seq AS bigint START
WITH
    1000 INCREMENT BY 1;

DROP TABLE IF EXISTS public.clients CASCADE;

create table public.clients (
    id bigint DEFAULT nextval('public.clients_id_seq') NOT NULL,
    client_name text not null default ''::text,
    company_id uuid null default gen_random_uuid (),
    phone text null,
    status public.status_profil null default 'active'::status_profil,
    doc_id extensions.citext not null,
    created_at timestamp with time zone null default (
        now() AT TIME ZONE 'utc'::text
    ),
    constraint clients_pkey primary key (id),
    constraint clients_doc_id_key unique (doc_id),
    constraint clients_company_id_fkey foreign KEY (company_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;





SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name = 'clients'
ORDER BY table_name;
