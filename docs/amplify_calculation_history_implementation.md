# Fixstars Amplify計算履歴の実装

## 概要

Fixstars Amplifyによる献立最適化の計算履歴を記録する機能を実装しました。この機能により、リクエスト内容とレスポンス内容を完全に保存し、パフォーマンス分析・デバッグ・結果比較が可能になります。

## 実装内容

### 1. データベーステーブル

#### テーブル名: `amplify_calculation_history`

| カラム名 | データ型 | 説明 |
|----------|----------|------|
| calculation_id | SERIAL | 計算ID（自動採番、PRIMARY KEY） |
| school_id | UUID | 小学校ID（FOREIGN KEY → schools） |
| request_params | JSONB | リクエストパラメータ（M, cost, weights等） |
| response_data | JSONB | レスポンスデータ（meta, plan, checks等） |
| solver_time_sec | DECIMAL(10,5) | ソルバー実行時間（秒） |
| total_time_sec | DECIMAL(10,5) | 総処理時間（秒） |
| num_variables | INTEGER | QUBO変数の数 |
| num_constraints | INTEGER | 制約条件の数 |
| objective_value | DECIMAL(15,5) | 目的関数値 |
| solution_status | VARCHAR(50) | 解のステータス |
| created_at | TIMESTAMP | 計算実行日時 |
| updated_at | TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | 削除日時 |

#### インデックス

- `idx_amplify_calculation_history_school`: school_id と created_at での検索用
- `idx_amplify_calculation_history_request`: リクエストパラメータのJSON検索用（GINインデックス）
- `idx_amplify_calculation_history_response`: レスポンスデータのJSON検索用（GINインデックス）

### 2. バックエンド実装

#### 新規関数: `save_amplify_calculation_history()`

**場所**: `backend/main.py` (lines 189-260)

**機能**: Amplify計算履歴をデータベースに保存

**引数**:
- `school_id`: 小学校ID
- `request_params`: リクエストパラメータ（dict）
- `response_data`: レスポンスデータ（dict）
- `solver_time_sec`: ソルバー実行時間（秒）
- `total_time_sec`: 総処理時間（秒）
- `num_variables`: QUBO変数の数
- `num_constraints`: 制約条件の数
- `objective_value`: 目的関数値
- `solution_status`: 解のステータス

**戻り値**: `calculation_id` (保存された計算ID)

#### 修正: `solve_menu()` 関数

**追加機能**:
1. ソルバー実行時間の計測（`solver_time_sec`）
2. ソルバー情報の取得：
   - 変数の数 (`num_variables = N * M`)
   - 目的関数値 (`objective_value`)
   - 解のステータス (`solution_status`)
3. レスポンスに `solver_info` セクションを追加

**レスポンス構造**:
```json
{
  "meta": { ... },
  "plan": { ... },
  "checks": { ... },
  "solver_info": {
    "solver_time_sec": 2.1234,
    "num_variables": 1260,
    "objective_value": 123.45,
    "solution_status": "feasible"
  }
}
```

#### 修正: `/optimize` エンドポイント

**追加機能**:
1. 総処理時間の計測（`total_time_sec`）
2. 計算履歴の自動保存（すべてのリクエストで実行）
3. リクエストパラメータの構築と保存
4. レスポンスに `calculation_id` を追加

**保存されるリクエストパラメータ**:
```json
{
  "M": 5,
  "cost": 1500.0,
  "school_id": "62059dce-db8f-4fde-b59a-444853efe5d8",
  "target_year_month": "2026-03",
  "target_week": 1,
  "add_milk": false,
  "topk_sim": 12,
  "h5_mode": "practical",
  "weights": {
    "H1": 90.0,
    "H2": 20.0,
    "H3": 0.5,
    ...
  },
  "target": {
    "エネルギー": 650.0,
    "たんぱく質": 20.0,
    ...
  }
}
```

### 3. テーブル作成SQL

**ファイル**: `docs/create_amplify_calculation_history_table.sql`

このSQLファイルを実行することで、`amplify_calculation_history` テーブルとインデックスが作成されます。

```bash
psql -h localhost -U postgres -d school_menu_db -f docs/create_amplify_calculation_history_table.sql
```

## 使用方法

### 1. テーブル作成

```bash
# PostgreSQLに接続してテーブルを作成
psql -h localhost -U postgres -d school_menu_db -f docs/create_amplify_calculation_history_table.sql
```

### 2. 献立最適化APIの実行

通常通り `/optimize` エンドポイントを呼び出すと、自動的に計算履歴が保存されます。

```bash
curl -X POST http://localhost:8080/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "M": 5,
    "cost": 1500.0,
    "school_id": "62059dce-db8f-4fde-b59a-444853efe5d8",
    "target_year_month": "2026-03",
    "target_week": 1,
    "save_to_db": true,
    "add_milk": false
  }'
```

### 3. 計算履歴の確認

```sql
-- 最新の計算履歴を取得
SELECT
    calculation_id,
    school_id,
    solver_time_sec,
    total_time_sec,
    num_variables,
    objective_value,
    solution_status,
    created_at
FROM amplify_calculation_history
ORDER BY created_at DESC
LIMIT 10;

-- 特定の小学校の計算履歴を取得
SELECT
    calculation_id,
    request_params->>'M' as days,
    request_params->>'cost' as target_cost,
    response_data->'plan'->>'total_cost' as actual_cost,
    solver_time_sec,
    created_at
FROM amplify_calculation_history
WHERE school_id = '62059dce-db8f-4fde-b59a-444853efe5d8'
ORDER BY created_at DESC;

-- 重みパラメータの履歴を確認
SELECT
    calculation_id,
    request_params->'weights' as weights,
    objective_value,
    solution_status,
    created_at
FROM amplify_calculation_history
ORDER BY created_at DESC
LIMIT 5;
```

## 活用例

### 1. パフォーマンス分析

```sql
-- ソルバー実行時間の統計
SELECT
    AVG(solver_time_sec) as avg_solver_time,
    MIN(solver_time_sec) as min_solver_time,
    MAX(solver_time_sec) as max_solver_time,
    STDDEV(solver_time_sec) as stddev_solver_time
FROM amplify_calculation_history
WHERE created_at >= NOW() - INTERVAL '30 days';

-- 変数の数とソルバー時間の相関
SELECT
    num_variables,
    AVG(solver_time_sec) as avg_time,
    COUNT(*) as count
FROM amplify_calculation_history
GROUP BY num_variables
ORDER BY num_variables;
```

### 2. 重みパラメータの比較

```sql
-- 同じ条件（M=5, cost=1500）で異なる重み設定の結果を比較
SELECT
    calculation_id,
    request_params->'weights'->>'H1' as H1_weight,
    request_params->'weights'->>'H2' as H2_weight,
    objective_value,
    response_data->'plan'->>'total_cost' as total_cost,
    created_at
FROM amplify_calculation_history
WHERE request_params->>'M' = '5'
  AND request_params->>'cost' = '1500.0'
ORDER BY created_at DESC
LIMIT 10;
```

### 3. デバッグ

```sql
-- 特定の計算の詳細を確認
SELECT
    calculation_id,
    request_params,
    response_data,
    solver_time_sec,
    objective_value,
    solution_status
FROM amplify_calculation_history
WHERE calculation_id = 123;
```

## 注意事項

1. **ストレージ容量**: レスポンスデータが大きいため、定期的に古いデータを削除することを推奨
2. **パフォーマンス**: GINインデックスを使用しているため、JSONクエリは高速ですが、書き込みは若干遅くなります
3. **エラーハンドリング**: 計算履歴の保存に失敗しても、献立最適化の結果は返されます

## まとめ

この実装により、以下が可能になりました：

1. ✅ すべての献立最適化リクエストの完全な記録
2. ✅ パフォーマンス分析（実行時間、変数の数など）
3. ✅ 重みパラメータの履歴追跡と比較
4. ✅ デバッグ用の詳細データ保存
5. ✅ 結果の再現性確保
