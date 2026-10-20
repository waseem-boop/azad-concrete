ALTER TABLE erp_memberships DROP CONSTRAINT IF EXISTS erp_memberships_role_check;
ALTER TABLE erp_memberships ADD CONSTRAINT erp_memberships_role_check CHECK(role IN ('owner','staff','cashier','manager'));
ALTER TABLE erp_memberships ADD COLUMN IF NOT EXISTS permissions jsonb;
ALTER TABLE erp_invites ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff' CHECK(role IN ('staff','cashier','manager'));
ALTER TABLE erp_invites ADD COLUMN IF NOT EXISTS permissions jsonb;
-- Preserve current staff access on upgrade; all newly issued invites store explicit choices.
UPDATE erp_memberships SET permissions='["dashboard","stocks_view","stocks_manage","materials_view","materials_manage","production","gatepass_view","gatepass_manage","accounts_view","accounts_manage","expenses_view","expenses_manage","assets_view"]'::jsonb WHERE permissions IS NULL AND role<>'owner';
UPDATE erp_memberships SET permissions='[]'::jsonb WHERE permissions IS NULL;
UPDATE erp_invites SET permissions='["dashboard","stocks_view","stocks_manage","materials_view","materials_manage","production","gatepass_view","gatepass_manage","accounts_view","accounts_manage","expenses_view","expenses_manage","assets_view"]'::jsonb WHERE permissions IS NULL;
