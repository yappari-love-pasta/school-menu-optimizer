-- ==================================================
-- 小学校給食献立最適化システム
-- データベーステーブル作成SQL
-- ==================================================

-- 1. 小学校・ユーザー管理
-- ==================================================

-- 1.1 schools（小学校マスタ）
CREATE TABLE schools (
    school_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE schools IS '小学校マスタ';
COMMENT ON COLUMN schools.school_id IS '小学校ID（自動採番）';
COMMENT ON COLUMN schools.name IS '小学校名';

-- 1.2 users（ユーザー）
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    school_id INTEGER REFERENCES schools(school_id),
    login_id VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    name VARCHAR(100),
    role INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    UNIQUE (school_id, login_id)
);

COMMENT ON TABLE users IS 'ユーザー';
COMMENT ON COLUMN users.user_id IS 'ユーザーID（UUIDv7）';
COMMENT ON COLUMN users.school_id IS '所属小学校ID';
COMMENT ON COLUMN users.login_id IS 'ログインID（school_idと組み合わせて一意）';
COMMENT ON COLUMN users.name IS 'ユーザー名';
COMMENT ON COLUMN users.email IS 'メールアドレス';
COMMENT ON COLUMN users.password_hash IS 'パスワードハッシュ';
COMMENT ON COLUMN users.role IS '権限（数値で管理）';

-- 2. レシピ・栄養・食材マスタ
-- ==================================================

-- 2.1 recipes（レシピマスタ）
CREATE TABLE recipes (
    recipe_id SERIAL PRIMARY KEY,
    recipe_name VARCHAR(100) NOT NULL,
    category VARCHAR(20),
    genre VARCHAR(20),
    available_months INT[],
    energy_kcal DECIMAL(6,2),
    protein_g DECIMAL(6,2),
    fat_g DECIMAL(6,2),
    salt_g DECIMAL(6,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE recipes IS 'レシピマスタ';
COMMENT ON COLUMN recipes.recipe_id IS 'レシピID（自動採番）';
COMMENT ON COLUMN recipes.recipe_name IS 'レシピ名';
COMMENT ON COLUMN recipes.category IS 'カテゴリ（主食/主菜/副菜/汁物/デザート）';
COMMENT ON COLUMN recipes.genre IS 'ジャンル（和食/洋食/中華など）';
COMMENT ON COLUMN recipes.available_months IS '提供可能月（配列、例: {4,5,6}）';
COMMENT ON COLUMN recipes.energy_kcal IS 'エネルギー（kcal）';
COMMENT ON COLUMN recipes.protein_g IS 'たんぱく質（g）';
COMMENT ON COLUMN recipes.fat_g IS '脂質（g）';
COMMENT ON COLUMN recipes.salt_g IS '食塩相当量（g）';

-- 2.2 recipe_ingredients（レシピ食材構成）
CREATE TABLE recipe_ingredients (
    food_id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(recipe_id),
    food_name VARCHAR(200),
    amount_g DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE recipe_ingredients IS 'レシピ食材構成';
COMMENT ON COLUMN recipe_ingredients.food_id IS '食材ID（自動採番）';
COMMENT ON COLUMN recipe_ingredients.recipe_id IS 'レシピID';
COMMENT ON COLUMN recipe_ingredients.food_name IS '食材名';
COMMENT ON COLUMN recipe_ingredients.amount_g IS '使用量（g）';

-- 2.3 food_costs（食材単価）
CREATE TABLE food_costs (
    food_id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(school_id),
    price_per_gram DECIMAL(10,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE food_costs IS '食材単価（小学校ごとに異なる地域の仕入れ価格差を考慮）';
COMMENT ON COLUMN food_costs.food_id IS '食材ID（自動採番）';
COMMENT ON COLUMN food_costs.school_id IS '小学校ID';
COMMENT ON COLUMN food_costs.price_per_gram IS 'グラム単価（円/g）';

-- 3. 実行ログ・献立保存
-- ==================================================

-- 3.1 recommendation_logs（レコメンデーション実行ログ）
CREATE TABLE recommendation_logs (
    log_id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(school_id),
    solver_time DECIMAL(10,5),
    total_time DECIMAL(10,5),
    parameters JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE recommendation_logs IS 'レコメンデーション実行ログ';
COMMENT ON COLUMN recommendation_logs.log_id IS 'ログID（自動採番）';
COMMENT ON COLUMN recommendation_logs.school_id IS '小学校ID';
COMMENT ON COLUMN recommendation_logs.solver_time IS 'ソルバー実行時間（秒）';
COMMENT ON COLUMN recommendation_logs.total_time IS '総処理時間（秒）';
COMMENT ON COLUMN recommendation_logs.parameters IS '実行パラメータ（制約の重み等、JSON形式）';

-- 3.2 school_menus（献立保存）
CREATE TABLE school_menus (
    school_menu_id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(school_id),
    target_year_month VARCHAR(7) NOT NULL,
    target_week SMALLINT CHECK (target_week >= 1 AND target_week <= 5 OR target_week IS NULL),
    menu_data JSONB NOT NULL,
    total_cost INTEGER,
    total_nutrition_avg JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE school_menus IS '献立保存';
COMMENT ON COLUMN school_menus.school_menu_id IS '献立ID（自動採番）';
COMMENT ON COLUMN school_menus.school_id IS '小学校ID';
COMMENT ON COLUMN school_menus.target_year_month IS '対象年月（YYYY-MM形式、例: "2026-03"）';
COMMENT ON COLUMN school_menus.target_week IS '対象週（1〜5週目）';
COMMENT ON COLUMN school_menus.menu_data IS '献立データ（QUBO出力をそのまま保存、JSON形式）';
COMMENT ON COLUMN school_menus.total_cost IS '合計コスト（円）';
COMMENT ON COLUMN school_menus.total_nutrition_avg IS '平均栄養価（JSON形式）';

-- 4. 学習用データ（QUBO制約項用）
-- ==================================================

-- 4.1 past_pairings（過去の組み合わせ履歴）
CREATE TABLE past_pairings (
    school_id INTEGER REFERENCES schools(school_id),
    staple_recipe_id INTEGER REFERENCES recipes(recipe_id),
    paired_recipe_id INTEGER REFERENCES recipes(recipe_id),
    occurrence_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    PRIMARY KEY (school_id, staple_recipe_id, paired_recipe_id)
);

COMMENT ON TABLE past_pairings IS '過去の組み合わせ履歴（H6: 主食と他メニューの相性計算に使用）';
COMMENT ON COLUMN past_pairings.school_id IS '小学校ID';
COMMENT ON COLUMN past_pairings.staple_recipe_id IS '主食レシピID';
COMMENT ON COLUMN past_pairings.paired_recipe_id IS 'ペアレシピID';
COMMENT ON COLUMN past_pairings.occurrence_count IS '出現回数';

-- 4.2 bad_pairings（NG組み合わせ）
CREATE TABLE bad_pairings (
    school_id INTEGER REFERENCES schools(school_id),
    recipe_id_a INTEGER REFERENCES recipes(recipe_id),
    recipe_id_b INTEGER REFERENCES recipes(recipe_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    PRIMARY KEY (school_id, recipe_id_a, recipe_id_b)
);

COMMENT ON TABLE bad_pairings IS 'NG組み合わせ（H8: 禁止組み合わせ計算に使用、栄養士が手動登録）';
COMMENT ON COLUMN bad_pairings.school_id IS '小学校ID';
COMMENT ON COLUMN bad_pairings.recipe_id_a IS 'レシピID（A）';
COMMENT ON COLUMN bad_pairings.recipe_id_b IS 'レシピID（B）';

-- ==================================================
-- インデックス作成（検索性能向上のため）
-- ==================================================

-- 献立検索用
CREATE INDEX idx_school_menus_school_month ON school_menus(school_id, target_year_month);

-- ログ検索用
CREATE INDEX idx_recommendation_logs_school ON recommendation_logs(school_id, created_at DESC);

-- レシピ検索用（食材から逆引き）
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- JSONB検索用（必要に応じて）
CREATE INDEX idx_school_menus_menu_data ON school_menus USING GIN(menu_data);
CREATE INDEX idx_recommendation_logs_parameters ON recommendation_logs USING GIN(parameters);

-- ==================================================
-- 完了
-- ==================================================
