# School Lunch Menu Optimization Frontend

給食献立サポートシステムのReact.jsフロントエンドアプリケーション

## 概要

このフロントエンドは、Fixstars Amplify AE（アニーリングマシン）を使用した学校給食献立最適化システムのWebインターフェースです。

## 機能

- **ダッシュボード**: システム概要と使用統計の表示
- **献立作成（最適化）**: バックエンドAPIを使用した最適献立の生成
- **献立スケジュール**: 生成された献立のカレンダー表示
- **レシピ一覧**: 寝屋川市の学校給食レシピの検索と詳細表示
- **栄養価一覧**: 日本食品標準成分表のフィルタリング表示

## 技術スタック

- **React 18.2**: UIライブラリ
- **React Router 6.20**: クライアントサイドルーティング
- **Vite 5.0**: 高速ビルドツール
- **Tailwind CSS 3.4**: ユーティリティファーストCSSフレームワーク
- **Axios 1.6**: HTTPクライアント
- **Chart.js 4.4**: データ可視化（ダッシュボード用）

## セットアップ

### 1. 依存関係のインストール

```bash
cd frontend
npm install
```

### 2. バックエンドURL設定

[src/services/api.js](src/services/api.js) でバックエンドのURLが正しく設定されていることを確認:

```javascript
const API_BASE_URL = 'https://asia-northeast1-q-quest-project.cloudfunctions.net';
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスしてください。

## プロジェクト構成

```
frontend/
├── public/                      # 静的ファイル
│   ├── school_lunch_menu_neyagawa.json
│   ├── ja_food_standard_composition_list.json
│   └── recipe/                  # レシピJSONファイル（M000000001.json - M000000252.json）
├── src/
│   ├── components/              # Reactコンポーネント
│   │   ├── Sidebar.jsx          # サイドバーナビゲーション
│   │   ├── Dashboard.jsx        # ダッシュボード
│   │   ├── RecipeCreation.jsx   # 献立作成（バックエンド連携）
│   │   ├── MenuCalendar.jsx     # 献立スケジュール表示
│   │   ├── RecipeList.jsx       # レシピ一覧
│   │   └── NutritionList.jsx    # 栄養価一覧
│   ├── services/
│   │   └── api.js               # バックエンドAPI通信
│   ├── App.jsx                  # メインアプリケーション
│   ├── main.jsx                 # Reactエントリーポイント
│   └── index.css                # グローバルスタイル
├── package.json                 # 依存関係とスクリプト
├── vite.config.js              # Vite設定
├── tailwind.config.js          # Tailwind CSS設定
└── postcss.config.js           # PostCSS設定
```

## コンポーネント詳細

### RecipeCreation.jsx - 献立作成

**主な機能:**
- 年月選択（翌月から1年間）
- バックエンドAPIへのリクエスト送信
- 進行状況の表示（データ読み込み中、計算中など）
- 生成結果の献立スケジュールへの遷移

**バックエンド連携フロー:**
1. `school_lunch_menu_neyagawa.json` から全メニューを読み込み
2. 各メニューをカテゴリ・ジャンル分類
3. レシピ配列とヒストリー行列を生成
4. バックエンドAPIにPOSTリクエスト送信
5. 結果を受け取り、MenuCalendarに遷移

### MenuCalendar.jsx - 献立スケジュール

**主な機能:**
- カレンダー形式での献立表示
- 平日のみ表示（土日は除外）
- 献立の色分け（主食、主菜、副菜、汁物、デザート、牛乳）
- 月次ナビゲーション

### RecipeList.jsx - レシピ一覧

**主な機能:**
- 全252レシピの一覧表示
- メニュー名での部分一致検索
- レシピ詳細の表示（材料、作り方、栄養成分）

### NutritionList.jsx - 栄養価一覧

**主な機能:**
- 日本食品標準成分表の表形式表示
- 3つのフィルター（食品群名、食品番号、食品名）
- 部分一致検索による絞り込み
- 栄養成分の詳細表示

## APIエンドポイント

### POST /generate-school-lunch

献立を生成します。

**リクエスト:**
```json
{
  "days": 21,
  "recipes": [
    {
      "id": 1,
      "name": "ごはん",
      "category": "主食",
      "genre": "和風",
      "energy": 250,
      "protein": 4,
      "fat": 1,
      "cost": 50
    }
  ],
  "history": {
    "staple_pair_matrix": [[0, 0], [0, 0]],
    "bad_pair_matrix": [[0, 0], [0, 0]]
  }
}
```

**レスポンス:**
```json
{
  "menu": [
    {
      "day": 1,
      "menu": ["ごはん", "いわしのこはく揚げ", "だんご汁", "牛乳"]
    }
  ],
  "energy": 123.45,
  "num_solutions": 1
}
```

## ビルド

### 本番環境用ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに出力されます。

### プレビュー

```bash
npm run preview
```

## デプロイ

### Firebase Hosting

```bash
# Firebase CLIのインストール
npm install -g firebase-tools

# Firebaseプロジェクトの初期化
firebase init hosting

# ビルド
npm run build

# デプロイ
firebase deploy --only hosting
```

### Google Cloud Storage

```bash
# ビルド
npm run build

# GCSバケットへアップロード
gsutil -m cp -r dist/* gs://your-bucket-name/
```

## 開発時のヒント

### CORS問題の解決

ローカル開発時にCORSエラーが発生する場合は、バックエンドのCloud Functionで以下の設定を確認:

```python
@functions_framework.http
def generate_school_lunch(request):
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}
    # ... rest of the code
```

### データ形式の確認

[src/services/api.js](src/services/api.js) の `generateMenu` 関数でリクエストデータの形式を確認できます。

### コンポーネントの追加

新しいページを追加する場合:

1. `src/components/` に新しいコンポーネントを作成
2. [src/App.jsx](src/App.jsx) にルートを追加
3. [src/components/Sidebar.jsx](src/components/Sidebar.jsx) にナビゲーションリンクを追加

## トラブルシューティング

### バックエンド接続エラー

**エラー:** "サーバーからの応答がありません"

**解決策:**
1. バックエンドURLが正しいか確認
2. Cloud Functionがデプロイされているか確認
3. ネットワーク接続を確認
4. ブラウザの開発者ツールでネットワークタブを確認

### データ読み込みエラー

**エラー:** "データの読み込みに失敗しました"

**解決策:**
1. `public/` フォルダにJSONファイルが存在するか確認
2. JSONファイルの形式が正しいか確認
3. ブラウザのコンソールでエラーメッセージを確認

### ビルドエラー

**エラー:** "Module not found"

**解決策:**
```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

## ライセンス

このプロジェクトは教育目的で作成されています。

## 関連リンク

- [バックエンドREADME](../backend/README.md)
- [React公式ドキュメント](https://react.dev/)
- [Vite公式ドキュメント](https://vitejs.dev/)
- [Tailwind CSS公式ドキュメント](https://tailwindcss.com/)
