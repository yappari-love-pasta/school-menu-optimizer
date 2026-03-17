# テーブル定義書

## 概要

本システムは小学校給食の献立最適化システムのデータベースです。QUBO（量子アニーリング）を用いた献立レコメンデーション機能を提供します。

---

## 1. 小学校・ユーザー管理

### 1.1 schools（小学校マスタ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_id | UUID | PRIMARY KEY | 小学校ID（UUIDv7） |
| name | VARCHAR(100) | NOT NULL | 小学校名 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

### 1.2 users（ユーザー）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| user_id | UUID | PRIMARY KEY | ユーザーID（UUIDv7） |
| school_id | UUID | FOREIGN KEY → schools(school_id), UNIQUE (複合) | 所属小学校ID |
| login_id | VARCHAR(100) | NOT NULL, UNIQUE (複合) | ログインID |
| email | VARCHAR(255) | UNIQUE | メールアドレス |
| password_hash | TEXT | NOT NULL | パスワードハッシュ |
| name | VARCHAR(100) | | ユーザー名 |
| role | INTEGER | | 権限（数値で管理） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

> **備考**: `school_id`と`login_id`の組み合わせで一意性を保証（複合ユニーク制約）

---

## 2. レシピ・栄養・食材マスタ

### 2.1 recipes（レシピマスタ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| recipe_id | SERIAL | PRIMARY KEY | レシピID |
| recipe_name | VARCHAR(100) | NOT NULL | レシピ名 |
| category | VARCHAR(20) | | カテゴリ（主食/主菜/副菜/汁物/デザート） |
| genre | VARCHAR(20) | | ジャンル（和風/洋風/韓国風/中華風/エスニック/その他） |
| available_months | INT[] | | 提供可能月（配列、例: {4,5,6}） |
| energy_kcal | DECIMAL(6,2) | | エネルギー（kcal） |
| protein_g | DECIMAL(6,2) | | たんぱく質（g） |
| fat_g | DECIMAL(6,2) | | 脂質（g） |
| salt_g | DECIMAL(6,2) | | 食塩相当量（g） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

### 2.2 recipe_ingredients（レシピ食材構成）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| food_id | SERIAL | PRIMARY KEY | 食材ID |
| recipe_id | INTEGER | FOREIGN KEY → recipes(recipe_id) | レシピID |
| food_name | VARCHAR(200) |  | 食材名 |
| amount_g | DECIMAL(10,2) | | 使用量（g） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

### 2.3 food_costs（食材単価）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| food_id | INTEGER | FOREIGN KEY → recipe_ingredients(food_id) | 食材ID |
| school_id | UUID | FOREIGN KEY → schools(school_id) | 小学校ID |
| price_per_gram | DECIMAL(10,4) | NOT NULL | グラム単価（円/g） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

> **備考**: 食材単価は小学校ごとに異なる（地域の仕入れ価格差を考慮）

### 2.4 recipe_workload（調理工程）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| recipe_id | INTEGER | FOREIGN KEY → recipe_ingredients(food_id) | 食材ID |
| step_id | UUID | FOREIGN KEY → schools(school_id) | 小学校ID |
| step_name | DECIMAL(10,4) | NOT NULL | 調理工程 |
| use_heat | BOOLEAN | DEFAULT FALSE | 火を使用するか（コンロ制限） |
| use_oven | BOOLEAN | DEFAULT FALSE | オーブンを使用するか |
| required_staff_count | INTEGER |  | 必要人数 |
| is_parallel_ok | BOOLEAN |  | 他の料理と並行可能か |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

---

## 3. 実行ログ・献立保存

### 3.1 recommendation_logs（レコメンデーション実行ログ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| log_id | SERIAL | PRIMARY KEY | ログID（自動採番） |
| school_id | UUID | FOREIGN KEY → schools(school_id) | 小学校ID |
| solver_time | DECIMAL(10,5) | | ソルバー実行時間（秒） |
| total_time | DECIMAL(10,5) | | 総処理時間（秒） |
| parameters | JSONB | | 実行パラメータ（制約の重み等） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

**parameters の構造例:**
```json
{
  "num_days": 5,
  "lambda_nutrition": 1.0,
  "lambda_cost": 0.8,
  "lambda_variety": 1.2
}
```

### 3.2 school_menus（献立保存 ※1日1コース1レコード）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_menu_id | SERIAL | PRIMARY KEY | 献立ID（自動採番） |
| school_id | UUID | FOREIGN KEY → schools(school_id) | 小学校ID |
| target_date | DATE | NOT NULL | 提供日（例: 2026-04-07） |
| plan_type | CHAR(1) | NOT NULL, CHECK IN ('A','B') | コース区分（A: 第一 / B: 第二小学校コース） |
| menu_data | JSONB | NOT NULL | その日の献立データ（1日分のレシピリスト） |
| total_cost | INT | | その日のコスト（円） |
| total_nutrition | JSONB | | その日の栄養価 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時（論理削除用） |

> **格納方針**: M日間の献立を1日×コース単位で分割して保存。新しい献立が同じ `(school_id, target_date, plan_type)` に来た場合は既存レコードを論理削除してから新規挿入するため、日付単位で正確に上書き管理できる。

**menu_data の構造例:**
```json
{
  "day": 1,
  "recipes": [
    {
      "id": 1,
      "title": "ツナそぼろごはん",
      "category": "主食",
      "steps": 4,
      "cost": 120.5,
      "nutritions": {"エネルギー": 400, "たんぱく質": 12.0, "脂質": 5.0, "ナトリウム": 300}
    }
  ],
  "daily_total": {"cost": 280.0, "エネルギー": 650, "たんぱく質": 22.0, "脂質": 18.0, "ナトリウム": 900}
}
```

**インデックス:**
```sql
CREATE INDEX idx_school_menus_school_date ON school_menus(school_id, target_date);
CREATE INDEX idx_school_menus_date_plan   ON school_menus(school_id, target_date, plan_type) WHERE deleted_at IS NULL;
```

### 3.3 amplify_calculation_history（Fixstars Amplify計算履歴）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| calculation_id | SERIAL | PRIMARY KEY | 計算ID（自動採番） |
| school_id | UUID | FOREIGN KEY → schools(school_id) | 小学校ID |
| request_params | JSONB | NOT NULL | リクエストパラメータ（M, cost, target_year_month, weights等） |
| response_data | JSONB | NOT NULL | レスポンスデータ（meta, plan, checks等の完全な結果） |
| solver_time_sec | DECIMAL(10,5) | | ソルバー実行時間（秒） |
| total_time_sec | DECIMAL(10,5) | | 総処理時間（秒） |
| num_variables | INTEGER | | QUBO変数の数 |
| num_constraints | INTEGER | | 制約条件の数 |
| objective_value | DECIMAL(15,5) | | 目的関数値 |
| solution_status | VARCHAR(50) | | 解のステータス（optimal, feasible, infeasible等） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 計算実行日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

> **用途**: Fixstars Amplifyによる献立最適化の計算履歴を記録。リクエスト内容とレスポンス内容を完全に保存し、パフォーマンス分析・デバッグ・結果比較に使用。

**request_params の構造例:**
```json
{
  "M": 5,
  "cost": 1500.0,
  "school_id": "62059dce-db8f-4fde-b59a-444853efe5d8",
  "target_year_month": "2026-03",
  "target_week": 1,
  "add_milk": false,
  "weights": {
    "H1": 80.0,
    "H2": 0.03,
    "H3": 0.006,
    "H4": 20.0,
    "H5": 0.2,
    "H6": 0.1,
    "H7": 0.2,
    "H8": 5.0,
    "H9": 0.01,
    "H10": 2.0,
    "H11": 0.5
  }
}
```

**response_data の構造例:**
```json
{
  "meta": {
    "M": 5,
    "N_candidates": 252,
    "target": {
      "エネルギー": 650.0,
      "たんぱく質": 20.0,
      "脂質": 18.0,
      "ナトリウム": 1000.0,
      "cost": 1500.0
    }
  },
  "plan": {
    "days": [...],
    "daily_totals": [...],
    "total_cost": 7234.5
  },
  "checks": {
    "per_day_category_counts": [...]
  }
}
```

---

## 4. 学習用データ（QUBO制約項用）

### 4.1 past_pairings（過去の組み合わせ履歴）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_id | UUID | PRIMARY KEY (複合), FOREIGN KEY → schools(school_id) | 小学校ID |
| staple_recipe_id | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | 主食レシピID |
| paired_recipe_id | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | ペアレシピID |
| occurrence_count | INT | DEFAULT 1 | 出現回数 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

> **用途**: H6（主食と他メニューの相性）計算に使用。過去に一緒に出された組み合わせを学習し、相性の良いペアを優遇。

### 4.2 bad_pairings（NG組み合わせ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_id | UUID | PRIMARY KEY (複合), FOREIGN KEY → schools(school_id) | 小学校ID |
| recipe_id_a | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | レシピID（A） |
| recipe_id_b | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | レシピID（B） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | | 削除日時 |

> **用途**: H8（禁止組み合わせ）計算に使用。栄養士が手動で登録した「一緒に出してはいけない」組み合わせにペナルティを付与。

---

## ER図（概念）
```
┌─────────────┐       ┌─────────────────┐
│   schools   │───┬───│      users      │
└─────────────┘   │   └─────────────────┘
       │          │
       │          ├───│ recommendation_logs │
       │          │
       │          ├───│    school_menus     │
       │          │
       │          ├───│    food_costs       │──┐
       │          │                            │
       │          ├───│   past_pairings     │──┼──┐
       │          │                            │  │
       │          └───│    bad_pairings     │──┼──┤
       │                                       │  │
       │   ┌───────────────────────────────────┘  │
       │   │                                      │
       │   ▼                                      │
┌──────┴───────┐     ┌──────────────────┐        │
│   recipes    │─────│ recipe_nutrition │        │
└──────────────┘     └──────────────────┘        │
       │                                          │
       └─────────│ recipe_ingredients │───────────┘
```

---

## インデックス推奨
```sql
-- 検索性能向上のため
CREATE INDEX idx_school_menus_school_month ON school_menus(school_id, target_year_month);
CREATE INDEX idx_recommendation_logs_school ON recommendation_logs(school_id, created_at DESC);
CREATE INDEX idx_recipe_ingredients_food ON recipe_ingredients(food_id);

-- JSONB検索用（必要に応じて）
CREATE INDEX idx_school_menus_menu_data ON school_menus USING GIN(menu_data);
```