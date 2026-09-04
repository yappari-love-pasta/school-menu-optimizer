-- ==================================================
-- 初期データ投入SQL
-- ==================================================

-- 1. schools テーブルに初期データを投入
-- ==================================================

-- gen_random_uuid() を使うには pgcrypto 拡張が必要
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- デフォルトの学校を追加（school_id=1）
INSERT INTO schools (school_id, name, created_at, updated_at, deleted_at)
VALUES ('62059dce-db8f-4fde-b59a-444853efe5d8', 'Aコース', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

INSERT INTO schools (school_id, name, created_at, updated_at, deleted_at)
VALUES ('b4e2f891-c7d3-4a56-9f18-2b3c4d5e6f7a', 'Bコース', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- 投入されたデータを確認
SELECT * FROM schools ORDER BY school_id;
