# GCPデプロイ手順

## 前提条件
- Google Cloud SDKがインストールされていること
- GCPプロジェクトが作成されていること
- 必要なAPIが有効化されていること

## デプロイの概要
1. 初期設定
2. Cloud SQL（PostgreSQL）インスタンスの作成
3. Cloud Run（バックエンド）のデプロイ
4. firebase（フロントエンド）のデプロイ


## デプロイ方法

### 1. 初期設定
```bash
# GCPにログイン
gcloud auth login

# Application Default Credentials（ADC）も設定する
# cloud-sql-proxy 等、gcloud CLI以外のツールはこちらの認証情報を参照するため必須
gcloud auth application-default login

# プロジェクトを設定
gcloud config set project q-quest-project

# APIを有効化
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### 2. Cloud SQL（PostgreSQL）インスタンスの作成

`main.py` は Cloud SQL Python Connector（pg8000）経由で接続する実装のため、インスタンス作成後に **Cloud RunサービスアカウントへのIAM権限付与** が必須です。テーブル定義は [`docs/table_definition.md`](./table_definition.md) 、実際のDDLは [`docs/create_table.sql`](./create_table.sql) を参照してください。

**1. DBインスタンスの作成:**
```bash
# ルートパスワード「YOUR_ROOT_PASSWORD」は強力なものに修正してから実行してください
gcloud sql instances create kyushoku-db \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --tier=db-f1-micro \
  --region=asia-northeast1 \
  --storage-size=10GB \
  --storage-type=SSD \
  --root-password=YOUR_ROOT_PASSWORD \
  --availability-type=ZONAL
```

```bash
 # 【運用・保守】
 # 上記コマンドでSQLインスタンス作成後、パスワードのみ変更する場合のコマンド
 # 「NEW_STRONG_PASSWORD」は強力なものに修正してから実行してください
gcloud sql users set-password postgres \
  --instance=kyushoku-db \
  --password=NEW_STRONG_PASSWORD
```

> `--edition` を省略すると環境によっては `ENTERPRISE_PLUS` がデフォルトで選ばれ、共有コアの `db-f1-micro` が使えず `Invalid Tier` エラーになります。`db-f1-micro` は Enterprise エディション専用の開発・小規模運用向け最小構成なので、必ず `--edition=ENTERPRISE` を明示してください。本番の同時アクセス数が増える場合は `db-custom-1-3840` 等への変更を検討してください（Enterprise Plus を使う場合は `db-perf-optimized-N-*` 系のマシンタイプが必要です）。

**2. データベースの作成:**
```bash
gcloud sql databases create school_menu_db --instance=kyushoku-db
```

**3. 接続名の確認（環境変数 `CLOUD_SQL_CONNECTION_NAME` に使用）:**
```bash
gcloud sql instances describe kyushoku-db --format="value(connectionName)"
# 例: q-quest-project:asia-northeast1:kyushoku-db
```

**4. Cloud RunサービスアカウントにCloud SQL Client権限を付与:**

Python Connectorがインスタンスに接続するために必要です（未付与だと接続時に権限エラーになります）。

```bash
PROJECT_NUMBER=$(gcloud projects describe q-quest-project --format="value(projectNumber)")

gcloud projects add-iam-policy-binding q-quest-project \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

**5. テーブルスキーマの投入:**

**Cloud SQL Studio**（Cloud Console → 該当インスタンス → 「Cloud SQL Studio」）を開き、`school_menu_db` に接続してから、次の順番にファイルの中身(SQL)を実行します。

1. docs/00_create_table.sql
2. docs/01_insert_initial_data.sql
3. docs/02_insert_recipes.sql
4. docs/03_insert_food_costs.sql
5. docs/04_insert_recipe_workload.sql


### 3. Cloud Run（バックエンド）のデプロイ

**1. Cloud Runにデプロイ**
```bash
# backendディレクトリに移動
cd backend

# Cloud Runにデプロイ
gcloud run deploy school-menu-optimizer-backend \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 1

# 更新時は上記と同じコマンドを実行する
```

**2. シークレットの設定**

アプリケーションが利用するシークレット設定します。

- `amplify-token`: Amplify AEのAPIトークン
- `db-name`: データベース名（デフォルト: school_menu_db）
- `db-user`: データベースユーザー名（デフォルト: postgres）
- `db-password`: データベースパスワード
- `cloud-sql-connection-name`: Cloud SQL接続名（デフォルト: 'q-quest-project:asia-northeast1:kyushoku-db'）

```bash
# シークレットを作成
# 'Amplify AEのAPIトークン' は、実際のパスワードで置き換えてください。
# 'データベースパスワード' は、実際のパスワードで置き換えてください。
echo -n 'Amplify AEのAPIトークン' | gcloud secrets create amplify-token --data-file=-
echo -n 'school_menu_db' | gcloud secrets create db-name --data-file=-
echo -n 'postgres' | gcloud secrets create db-user --data-file=-
echo -n 'データベースパスワード' | gcloud secrets create db-password --data-file=-
echo -n 'q-quest-project:asia-northeast1:kyushoku-db' | gcloud secrets create cloud-sql-connection-name --data-file=-

# Cloud RunサービスアカウントにSecret Managerへのアクセス権を付与
for s in amplify-token db-name db-user db-password cloud-sql-connection-name; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:977543908204-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done

# Cloud Runにシークレットを一括で環境変数として設定
gcloud run services update school-menu-optimizer-backend \
  --region asia-northeast1 \
  --remove-env-vars AMPLIFY_TOKEN,DB_PASSWORD \
  --update-secrets AMPLIFY_TOKEN=amplify-token:latest,\
DB_NAME=db-name:latest,\
DB_USER=db-user:latest,\
DB_PASSWORD=db-password:latest,\
CLOUD_SQL_CONNECTION_NAME=cloud-sql-connection-name:latest
```

**3. URLの確認**
デプロイが完了すると、以下のようなURLが表示されます：
```
https://school-menu-optimizer-backend-xxxxx-an.a.run.app
```

**4. 動作確認**
```bash
curl -X POST https://YOUR_CLOUD_RUN_URL/optimize \
  -H "Content-Type: application/json" \
  -d '{"M": 5, "cost": 1500}'
```

### 4. firebase（フロントエンド）のデプロイ
**frontendのデプロイ**
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### 5.  モニタリング

**ログの確認**
```bash
# Cloud Runのログを表示
gcloud run services logs read school-menu-optimizer-backend \
  --region asia-northeast1 \
  --limit 50
```

**メトリクスの確認**
- Cloud Consoleの「Cloud Run」セクションでメトリクスを確認
- リクエスト数、レイテンシ、エラー率などを監視
