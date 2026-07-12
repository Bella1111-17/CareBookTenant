-- Migrate existing caregiver profiles that already belong to a tenant into
-- the tenant-care business table.
-- Safe to run repeatedly on PostgreSQL.

INSERT INTO tenant_caregiver (
  tenant_id,
  real_name,
  phone,
  org_unit_id,
  qualification,
  health_certificate,
  skill_tags,
  status,
  del_flag,
  create_by,
  create_time,
  update_by,
  update_time,
  remark
)
SELECT
  u.tenant_id,
  cp.real_name,
  COALESCE(NULLIF(cp.contact_phone, ''), u.phonenumber, ''),
  NULL,
  COALESCE(NULLIF(cp.introduction, ''), ''),
  COALESCE(NULLIF(cp.health_certificate_images, ''), ''),
  (
    SELECT COALESCE(jsonb_agg(DISTINCT tag), '[]'::jsonb)
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(cp.specialties, '[]'::jsonb)) AS tag
      UNION
      SELECT jsonb_array_elements_text(COALESCE(cp.strengths, '[]'::jsonb)) AS tag
    ) tags
    WHERE tag <> ''
  ),
  cp.status,
  cp.del_flag,
  COALESCE(NULLIF(cp.create_by, ''), 'migration'),
  COALESCE(cp.create_time, now()),
  COALESCE(NULLIF(cp.update_by, ''), 'migration'),
  COALESCE(cp.update_time, now()),
  'migrated from caregiver_profile'
FROM caregiver_profile cp
JOIN sys_user u ON u.user_id = cp.user_id
WHERE cp.del_flag = '0'
  AND u.del_flag = '0'
  AND u.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_caregiver tc
    WHERE tc.del_flag = '0'
      AND tc.tenant_id = u.tenant_id
      AND tc.real_name = cp.real_name
      AND tc.phone = COALESCE(NULLIF(cp.contact_phone, ''), u.phonenumber, '')
  );
