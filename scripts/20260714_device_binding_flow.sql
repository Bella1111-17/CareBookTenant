-- Device tenant distribution history and caregiver binding audit fields.
-- Execute in carebook_tenant before deploying the matching API version.

CREATE TABLE IF NOT EXISTS device_tenant_binding (
  id SERIAL PRIMARY KEY,
  device_no VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  bind_at TIMESTAMP NOT NULL,
  unbind_at TIMESTAMP NULL,
  unbind_reason VARCHAR(500) NOT NULL DEFAULT '',
  bind_operator_id INT NULL,
  bind_operator_name VARCHAR(64) NOT NULL DEFAULT '',
  unbind_operator_id INT NULL,
  unbind_operator_name VARCHAR(64) NOT NULL DEFAULT '',
  bind_status VARCHAR(20) NOT NULL DEFAULT 'BOUND',
  del_flag CHAR(1) NOT NULL DEFAULT '0',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_tenant_binding_device_current
  ON device_tenant_binding (device_no, unbind_at);

CREATE INDEX IF NOT EXISTS idx_device_tenant_binding_tenant_current
  ON device_tenant_binding (tenant_id, unbind_at);

CREATE UNIQUE INDEX IF NOT EXISTS uk_device_tenant_binding_active_device
  ON device_tenant_binding (device_no)
  WHERE unbind_at IS NULL AND del_flag = '0';

ALTER TABLE tenant_badge_binding
  ADD COLUMN IF NOT EXISTS unbind_reason VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bind_operator_id INT NULL,
  ADD COLUMN IF NOT EXISTS bind_operator_name VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unbind_operator_id INT NULL,
  ADD COLUMN IF NOT EXISTS unbind_operator_name VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uk_tenant_badge_binding_active_device
  ON tenant_badge_binding (tenant_id, device_no)
  WHERE unbind_at IS NULL AND del_flag = '0';

CREATE UNIQUE INDEX IF NOT EXISTS uk_tenant_badge_binding_active_caregiver
  ON tenant_badge_binding (tenant_id, tenant_caregiver_id)
  WHERE unbind_at IS NULL AND del_flag = '0';
