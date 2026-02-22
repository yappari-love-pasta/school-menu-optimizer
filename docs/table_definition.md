# テーブル定義書

## 概要

本システムは小学校給食の献立最適化システムのデータベースです。QUBO（量子アニーリング）を用いた献立レコメンデーション機能を提供します。

---

## 1. 小学校・ユーザー管理

### 1.1 schools（小学校マスタ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_id | SERIAL | PRIMARY KEY | 小学校ID（自動採番） |
| name | VARCHAR(100) | NOT NULL | 小学校名 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

### 1.2 users（ユーザー）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| user_id | UUID | PRIMARY KEY | ユーザーID（UUIDv7） |
| school_id | INTEGER | FOREIGN KEY → schools(school_id), UNIQUE (複合) | 所属小学校ID |
| login_id | VARCHAR(100) | NOT NULL, UNIQUE (複合) | ログインID |
| email | VARCHAR(255) | UNIQUE | メールアドレス |
| password_hash | TEXT | NOT NULL | パスワードハッシュ |
| name | VARCHAR(100) | | ユーザー名 |
| role | INTEGER | | 権限（数値で管理） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

> **備考**: `school_id`と`login_id`の組み合わせで一意性を保証（複合ユニーク制約）

---

## 2. レシピ・栄養・食材マスタ

### 2.1 recipes（レシピマスタ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| recipe_id | SERIAL | PRIMARY KEY | レシピID |
| recipe_name | VARCHAR(100) | NOT NULL | レシピ名 |
| category | VARCHAR(20) | | カテゴリ（主食/主菜/副菜/汁物/デザート） |
| genre | VARCHAR(20) | | ジャンル（和食/洋食/中華など） |
| available_months | INT[] | | 提供可能月（配列、例: {4,5,6}） |
| energy_kcal | DECIMAL(6,2) | | エネルギー（kcal） |
| protein_g | DECIMAL(6,2) | | たんぱく質（g） |
| fat_g | DECIMAL(6,2) | | 脂質（g） |
| salt_g | DECIMAL(6,2) | | 食塩相当量（g） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

### 2.2 recipe_ingredients（レシピ食材構成）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| food_id | SERIAL | PRIMARY KEY | 食材ID |
| recipe_id | INTEGER | FOREIGN KEY → recipes(recipe_id) | レシピID |
| food_name | VARCHAR(200) |  | 食材名 |
| amount_g | DECIMAL(10,2) | | 使用量（g） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

### 2.3 food_costs（食材単価）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| food_id | SERIAL | PRIMARY KEY | 食材ID |
| school_id | INTEGER | FOREIGN KEY → schools(school_id) | 小学校ID |
| price_per_gram | DECIMAL(10,4) | NOT NULL | グラム単価（円/g） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

> **備考**: 食材単価は小学校ごとに異なる（地域の仕入れ価格差を考慮）

---

## 3. 実行ログ・献立保存

### 3.1 recommendation_logs（レコメンデーション実行ログ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| log_id | SERIAL | PRIMARY KEY | ログID（自動採番） |
| school_id | INTEGER | FOREIGN KEY → schools(school_id) | 小学校ID |
| solver_time | DECIMAL(10,5) | | ソルバー実行時間（秒） |
| total_time | DECIMAL(10,5) | | 総処理時間（秒） |
| parameters | JSONB | | 実行パラメータ（制約の重み等） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

**parameters の構造例:**
```json
{
  "num_days": 5,
  "lambda_nutrition": 1.0,
  "lambda_cost": 0.8,
  "lambda_variety": 1.2
}
```

### 3.2 school_menus（献立保存）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_menu_id | SERIAL | PRIMARY KEY | 献立ID（自動採番） |
| school_id | INTEGER | FOREIGN KEY → schools(school_id) | 小学校ID |
| target_year_month | VARCHAR(7) | NOT NULL | 対象年月（YYYY-MM形式、例: "2026-03"） |
| target_week | SMALLINT | CHECK (1-5) | 対象週（1〜5週目） |
| menu_data | JSONB | NOT NULL | 献立データ（QUBO出力をそのまま保存） |
| total_cost | INT | | 合計コスト（円） |
| total_nutrition_avg | JSONB | | 平均栄養価 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

**menu_data の構造例:**
```json
{
  "menu": [
    {
      "day": 1,
      "menu": [
        {"menu_id": 1, "name": "ツナと昆布の炊き込みごはん", "category": "主食", "nutrition": {...}}
      ]
    }
  ]
}
```

---

## 4. 学習用データ（QUBO制約項用）

### 4.1 past_pairings（過去の組み合わせ履歴）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_id | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → schools(school_id) | 小学校ID |
| staple_recipe_id | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | 主食レシピID |
| paired_recipe_id | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | ペアレシピID |
| occurrence_count | INT | DEFAULT 1 | 出現回数 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

> **用途**: H6（主食と他メニューの相性）計算に使用。過去に一緒に出された組み合わせを学習し、相性の良いペアを優遇。

### 4.2 bad_pairings（NG組み合わせ）

| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| school_id | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → schools(school_id) | 小学校ID |
| recipe_id_a | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | レシピID（A） |
| recipe_id_b | INTEGER | PRIMARY KEY (複合), FOREIGN KEY → recipes(recipe_id) | レシピID（B） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 削除日時 |

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