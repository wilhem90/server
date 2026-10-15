CREATE TABLE settings_global (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at DATE DEFAULT CURRENT_DATE
);


-- Get permission role_permissions;

create OR replace view public.role_permissions_view with (security_invoker = on) as
 SELECT role,
    permissions,
    active
   FROM role_permissions;
;
