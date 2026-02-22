-- ==================================================
-- 初期データ投入SQL
-- ==================================================

-- 1. schools テーブルに初期データを投入
-- ==================================================

-- デフォルトの学校を追加（school_id=1）
INSERT INTO schools (name, created_at, updated_at, deleted_at)
VALUES ('テスト小学校', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL);

-- 投入されたデータを確認
SELECT * FROM schools ORDER BY school_id;
