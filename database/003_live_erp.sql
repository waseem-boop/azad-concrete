CREATE TABLE IF NOT EXISTS erp_users (
 id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES erp_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_sessions_user ON erp_sessions(user_id);
CREATE TABLE IF NOT EXISTS erp_workspaces (
 user_id uuid PRIMARY KEY REFERENCES erp_users(id) ON DELETE CASCADE,
 state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_auth_limits (
 key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES erp_users(id), action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
