CREATE TABLE IF NOT EXISTS erp_memberships (
 user_id uuid PRIMARY KEY REFERENCES erp_users(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES erp_workspaces(user_id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','staff'))
);
INSERT INTO erp_memberships(user_id,workspace_id,role) SELECT user_id,user_id,'owner' FROM erp_workspaces ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS erp_invites (
 token_hash text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES erp_workspaces(user_id) ON DELETE CASCADE,
 email text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '2 days',
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
