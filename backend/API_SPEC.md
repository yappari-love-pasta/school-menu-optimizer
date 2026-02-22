# School Menu Optimizer API 仕様書

## 概要

給食献立最適化APIです。量子アニーリングを用いて、栄養バランス・コスト・レシピの多様性を考慮した最適な献立計画を生成します。

- **バージョン**: 1.0.0
- **ベースURL**:
  - Production: `https://school-menu-optimizer-backend-xxxxx-an.a.run.app`
  - Local: `http://localhost:8080`

## 認証

現在は認証なしでアクセス可能です。本番環境では適切な認証・認可機構の実装を推奨します。

## エンドポイント

### POST /optimize

献立最適化を実行します。

#### リクエスト

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "M": 5,                          // 必須: 献立を生成する日数（1-30）
  "cost": 1500.0,                  // 必須: M日間の合計コスト目標値（円）
  "save_to_db": true,              // オプション: データベースに保存するか
  "school_id": "school_001",       // オプション: 小学校ID（save_to_db=trueの場合）
  "target_year_month": "2026-03-01" // オプション: 対象年月（save_to_db=trueの場合）
}
```

**パラメータ:**

| フィールド | 型 | 必須 | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| `M` | integer | ✓ | 5 | 献立を生成する日数（1-30の範囲） |
| `cost` | number | ✓ | 1500.0 | M日間の合計コスト目標値（円） |
| `save_to_db` | boolean | - | false | 献立データをデータベースに保存するか |
| `school_id` | string | - | "default_school" | 小学校ID（save_to_db=trueの場合に使用） |
| `target_year_month` | string (DATE) | - | 現在月 | 対象年月（YYYY-MM-DD形式、月初日を指定） |

#### レスポンス

**成功 (200 OK):**

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
    },
    "weights": {
      "H1": 80.0,    // カテゴリ制約の重み
      "H2": 0.03,    // 栄養バランスの重み
      "H3": 0.006,   // コスト制約の重み
      "H4": 20.0,    // レシピ重複抑制の重み
      "H5": 0.2,     // ジャンル制御の重み
      "H7": 0.2      // 隣接日多様性の重み
    },
    "h5_mode": "practical",
    "topk_sim": 12
  },
  "plan": {
    "days": [
      {
        "day": 1,
        "recipes": [
          {
            "idx": 30,
            "id": "M000000030",
            "title": "ごはん",
            "category": 2,
            "category_name": "主食",
            "genre": 0,
            "nutritions": {
              "エネルギー": 254.9,
              "たんぱく質": 4.1,
              "脂質": 0.5,
              "ナトリウム": 0.0
            },
            "ingredients": [
              {
                "food_id": 1001,
                "amount_g": 80.0,
                "name": "米",
                "unit_cost": 0.5,
                "cost": 40.0
              }
            ],
            "recipe_cost": 40.0
          }
        ]
      }
    ],
    "daily_totals": [
      {
        "day": 1,
        "totals": {
          "cost": 298.5,
          "エネルギー": 648.2,
          "たんぱく質": 19.8,
          "脂質": 17.5,
          "ナトリウム": 995.3
        }
      }
    ],
    "total_cost": 1492.5
  },
  "checks": {
    "per_day_category_counts": [
      {
        "day": 1,
        "counts": {
          "主菜": 1,
          "副菜": 1,
          "主食": 1,
          "汁物": 1,
          "デザート": 0
        }
      }
    ]
  }
}
```

**エラー (500 Internal Server Error):**

```json
{
  "error": "No active recipes found."
}
```

#### レスポンスフィールド詳細

**meta (メタ情報)**

| フィールド | 型 | 説明 |
|----------|-----|------|
| `M` | integer | 生成した献立の日数 |
| `N_candidates` | integer | 候補レシピ数 |
| `target` | object | 栄養素・コストの目標値 |
| `weights` | object | 最適化の重み係数 |
| `h5_mode` | string | ジャンル制御モード（practical/paper） |
| `topk_sim` | integer | 類似度計算で考慮する近傍数 |

**plan.days[] (日別献立)**

| フィールド | 型 | 説明 |
|----------|-----|------|
| `day` | integer | 日数（1から開始） |
| `recipes` | array | その日のレシピリスト |

**plan.days[].recipes[] (レシピ詳細)**

| フィールド | 型 | 説明 |
|----------|-----|------|
| `idx` | integer | レシピインデックス |
| `id` | string | レシピID |
| `title` | string | レシピ名 |
| `category` | integer | カテゴリID (0=主菜, 1=副菜, 2=主食, 3=汁物, 4=デザート) |
| `category_name` | string | カテゴリ名 |
| `genre` | integer | ジャンルID |
| `nutritions` | object | 栄養情報 |
| `ingredients` | array | 食材リスト |
| `recipe_cost` | number | レシピコスト（円） |

**nutritions (栄養情報)**

| フィールド | 型 | 単位 | 説明 |
|----------|-----|------|------|
| `エネルギー` | number | kcal | エネルギー |
| `たんぱく質` | number | g | たんぱく質 |
| `脂質` | number | g | 脂質 |
| `ナトリウム` | number | mg | ナトリウム |

**ingredients[] (食材情報)**

| フィールド | 型 | 説明 |
|----------|-----|------|
| `food_id` | integer/null | 食材ID |
| `amount_g` | number/null | 使用量（g） |
| `name` | string/null | 食材名 |
| `unit_cost` | number/null | 単価（円/g） |
| `cost` | number/null | 食材コスト（円） |

**plan.daily_totals[] (日別集計)**

| フィールド | 型 | 説明 |
|----------|-----|------|
| `day` | integer | 日数 |
| `totals` | object | その日の栄養・コスト合計 |

**checks (検証情報)**

| フィールド | 型 | 説明 |
|----------|-----|------|
| `per_day_category_counts` | array | 日別カテゴリ出現数 |

**saved_menu_id (データベース保存時のみ)**

| フィールド | 型 | 説明 |
|----------|-----|------|
| `saved_menu_id` | integer | データベースに保存された献立のID（save_to_db=trueの場合のみ返却） |

### OPTIONS /optimize

CORS preflightリクエスト用エンドポイント。

#### レスポンス

**204 No Content**

CORSヘッダーが設定されます。

## 最適化アルゴリズム

本APIは以下の制約・目標を考慮して献立を最適化します：

### 制約条件

1. **カテゴリ制約 (H1)**
   - 主食と主菜：各日必ず1品
   - 副菜・汁物・デザート：各日0品または1品

2. **栄養バランス (H2)**
   - 各日の栄養素が目標値に近づくように調整
   - エネルギー: 650 kcal
   - たんぱく質: 20 g
   - 脂質: 18 g
   - ナトリウム: 1000 mg

3. **コスト制約 (H3)**
   - M日間の合計コストが目標値に近づくように調整

4. **レシピ重複抑制 (H4)**
   - 期間内で同じレシピが重複して出現しないように制御

5. **ジャンル多様性 (H5)**
   - 同日内で同じジャンルのレシピが重複しないように制御
   - モード: practical（推奨）= 同ジャンル抑制

6. **隣接日多様性 (H7)**
   - 隣り合う日で類似したレシピが出現しないように制御
   - 食材の類似度とジャンルを考慮

### 重み係数

各制約の重要度を調整する係数：

| 係数 | デフォルト値 | 説明 |
|-----|------------|------|
| H1 | 80.0 | カテゴリ制約（強制） |
| H2 | 0.03 | 栄養バランス |
| H3 | 0.006 | コスト |
| H4 | 20.0 | レシピ重複抑制 |
| H5 | 0.2 | ジャンル多様性 |
| H7 | 0.2 | 隣接日多様性 |

## カテゴリ定義

| カテゴリID | カテゴリ名 | 制約 |
|----------|----------|------|
| 0 | 主菜 | 必須（各日1品） |
| 1 | 副菜 | 任意（各日0-1品） |
| 2 | 主食 | 必須（各日1品） |
| 3 | 汁物 | 任意（各日0-1品） |
| 4 | デザート | 任意（各日0-1品） |

## CORS設定

すべてのオリジンからのアクセスを許可しています（`Access-Control-Allow-Origin: *`）。

本番環境では特定ドメインに制限することを推奨します。

## エラーコード

| ステータスコード | 説明 |
|--------------|------|
| 200 | 成功 |
| 204 | CORS preflight成功 |
| 500 | サーバーエラー（最適化失敗、データ不正など） |

## 使用例

### cURLでの実行

```bash
curl -X POST https://your-cloud-run-url/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "M": 5,
    "cost": 1500.0
  }'
```

### JavaScriptでの実行

```javascript
const response = await fetch('https://your-cloud-run-url/optimize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    M: 5,
    cost: 1500.0
  })
});

const result = await response.json();
console.log(result);
```

### Pythonでの実行

```python
import requests

response = requests.post(
    'https://your-cloud-run-url/optimize',
    json={
        'M': 5,
        'cost': 1500.0
    }
)

result = response.json()
print(result)
```

## パフォーマンス

- **平均レスポンス時間**: 10-30秒（M=5の場合）
- **最大実行時間**: 300秒（タイムアウト）
- **推奨リクエスト頻度**: 同時実行数は2以下を推奨

計算時間はMの値と候補レシピ数に依存します。

## 制限事項

1. **日数制限**: Mは1-30の範囲を推奨（それ以上は計算時間が増加）
2. **タイムアウト**: 5分以内に結果が返らない場合はタイムアウトエラー
3. **同時実行**: 高負荷時は順次処理されるため、レスポンスが遅延する可能性あり

## 注意事項

1. **APIトークン**: 本番環境ではAmplify APIトークンを環境変数またはSecret Managerで管理すること
2. **CORS設定**: 本番環境では特定ドメインに制限すること
3. **認証**: 本番環境では適切な認証機構を実装すること

## サポート

問題が発生した場合は、以下を確認してください：

1. リクエストボディが正しいJSON形式か
2. 必須パラメータ（M, cost）が含まれているか
3. Cloud Runのログを確認（デプロイ先環境の場合）

## 変更履歴

### v1.0.0 (2024-01-01)
- 初回リリース
- POST /optimize エンドポイント実装
- 量子アニーリングによる献立最適化機能
