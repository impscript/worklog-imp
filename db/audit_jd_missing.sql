-- ============================================================================
-- AUDIT v4 (ใช้ชื่อคอลัมน์จริงจาก schema ของคุณ):
--   users.active_workspace_id / users.status / users.position
--   workspaces.workspace_name (ไม่ใช่ name)
--   tb_user_jd.position_name
-- รันทั้งไฟล์ใน Supabase SQL Editor แล้วส่งผลกลับมา
-- ============================================================================

-- 1) สรุปตัวเลข
SELECT
  (SELECT count(*) FROM users)                                              AS total_users,
  (SELECT count(*) FROM users WHERE status = 'Active')                      AS active_users,
  (SELECT count(*) FROM users WHERE active_workspace_id IS NULL)            AS null_workspace_users,
  (SELECT count(*) FROM users WHERE position IS NULL OR position = '')      AS null_position_users,
  (SELECT count(*) FROM users WHERE status = 'Active'
     AND active_workspace_id IS NULL)                                        AS active_but_null_ws;

-- 2) รายชื่อที่ active_workspace_id ว่าง (กลุ่มหลักที่หลุดจาก list หน้าจอ admin)
SELECT id, emp_id, full_name, department, status, position, active_workspace_id
FROM users
WHERE active_workspace_id IS NULL
ORDER BY full_name
LIMIT 300;

-- 3) พนักงานที่ไม่อยู่ใน workspace_users เลย (孤儿用户)
SELECT u.id, u.emp_id, u.full_name, u.active_workspace_id
FROM users u
LEFT JOIN workspace_users wu ON wu.user_id = u.id
WHERE wu.user_id IS NULL
ORDER BY u.full_name
LIMIT 300;

-- 4) workspace ที่มีอยู่ (ใช้ workspace_name)
SELECT id, workspace_name, parent_id, use_global_master FROM workspaces ORDER BY workspace_name;

-- 5) active_workspace_id ชี้ไป workspace ที่ไม่มีอยู่จริง (orphan FK)
SELECT u.id, u.full_name, u.active_workspace_id
FROM users u
LEFT JOIN workspaces w ON w.id = u.active_workspace_id
WHERE u.active_workspace_id IS NOT NULL AND w.id IS NULL
ORDER BY u.full_name;

-- 6) tb_user_jd มีข้อมูลมั้ย + เป็นของกลุ่มไหน
SELECT
  (SELECT count(*) FROM tb_user_jd)                                                          AS total_jd_rows,
  (SELECT count(*) FROM tb_user_jd j JOIN users u ON u.id = j.user_id
     WHERE u.active_workspace_id IS NULL)                                                     AS jd_rows_of_null_ws_users;

-- 7) ผู้ใช้ที่มี tb_user_jd แต่ position ใน users ว่าง
SELECT u.full_name, u.position, j.position_name
FROM tb_user_jd j
JOIN users u ON u.id = j.user_id
WHERE u.position IS NULL OR u.position = ''
ORDER BY u.full_name
LIMIT 100;
