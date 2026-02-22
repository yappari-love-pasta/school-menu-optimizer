# GCPデプロイ手順

## 前提条件
- Google Cloud SDKがインストールされていること
- GCPプロジェクトが作成されていること
- 必要なAPIが有効化されていること

## デプロイ方法

### 方法1: Cloud Run（推奨）

#### 1. 初期設定
```bash
# GCPにログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project q-quest-project

# APIを有効化
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

#### 2. デプロイ
```bash
# backend3ディレクトリに移動
cd backend3

# Cloud Runにデプロイ（初回）
gcloud run deploy school-menu-optimizer-backend \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 1

# 更新時は同じコマンドを実行
```

#### 3. 環境変数の設定（必須）

アプリケーションは以下の環境変数を必要とします。

**必須の環境変数:**
- `AMPLIFY_TOKEN`: Amplify AEのAPIトークン
- **Cloud SQL接続の場合（推奨）:**
  - `CLOUD_SQL_CONNECTION_NAME`: Cloud SQL接続名（例: `q-quest-project:asia-northeast1:kyushoku-db`）
  - `DB_USER`: データベースユーザー名（デフォルト: postgres）
  - `DB_PASSWORD`: データベースパスワード
  - `DB_NAME`: データベース名（デフォルト: school_menu_db）
- **TCP/IP接続の場合（VPC Connector必要）:**
  - `DB_HOST`: PostgreSQLのホスト名（デフォルト: localhost）
  - `DB_PORT`: PostgreSQLのポート番号（デフォルト: 5432）
  - `DB_NAME`: データベース名（デフォルト: school_menu_db）
  - `DB_USER`: データベースユーザー名（デフォルト: postgres）
  - `DB_PASSWORD`: データベースパスワード

##### 方法A: Cloud SQL Proxy を使用（推奨・VPC Connector不要・無料）

**メリット:**
- ✅ VPC Connector 不要（月額$18-20節約）
- ✅ 自動的に暗号化された接続
- ✅ IAM認証をサポート

**手順:**

1. Cloud SQL の接続名を確認:
```bash
# Cloud SQL インスタンス一覧を取得
gcloud sql instances list

# 接続名の形式: PROJECT_ID:REGION:INSTANCE_NAME
# 例: q-quest-project:asia-northeast1:kyushoku-db
```

2. 環境変数を設定:
```bash
gcloud run services update school-menu-optimizer-backend \
  --region asia-northeast1 \
  --set-env-vars AMPLIFY_TOKEN=YOUR_TOKEN_HERE,\
CLOUD_SQL_CONNECTION_NAME=q-quest-project:asia-northeast1:kyushoku-db,\
DB_NAME=school_menu_db,\
DB_USER=postgres,\
DB_PASSWORD=YOUR_DB_PASSWORD
```

##### 方法B: TCP/IP接続（VPC Connector必要・月額約$18-20）

**VPC Connector が必要です。**

```bash
gcloud run services update school-menu-optimizer-backend \
  --region asia-northeast1 \
  --set-env-vars AMPLIFY_TOKEN=YOUR_TOKEN_HERE,\
DB_HOST=34.55.21.215,\
DB_PORT=5432,\
DB_NAME=school_menu_db,\
DB_USER=postgres,\
DB_PASSWORD=YOUR_DB_PASSWORD
```

##### 方法C: Secret Manager を使用（本番環境推奨）

Secret Managerを使用すると、パスワードを安全に管理できます。

```bash
# 1. Secret Manager APIを有効化
gcloud services enable secretmanager.googleapis.com

# 2. シークレットを作成（各変数ごとに実行）
echo -n "YOUR_AMPLIFY_TOKEN" | gcloud secrets create amplify-token --data-file=-
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# 3. プロジェクト番号を取得
PROJECT_NUMBER=$(gcloud projects describe q-quest-project --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# 4. Cloud RunサービスアカウントにSecret Managerへのアクセス権を付与
gcloud secrets add-iam-policy-binding amplify-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 5. Cloud Runにシークレットと環境変数を設定（Cloud SQL Proxy使用）
gcloud run services update school-menu-optimizer-backend \
  --region asia-northeast1 \
  --set-env-vars CLOUD_SQL_CONNECTION_NAME=q-quest-project:asia-northeast1:kyushoku-db,\
DB_NAME=school_menu_db,\
DB_USER=postgres \
  --update-secrets AMPLIFY_TOKEN=amplify-token:latest,DB_PASSWORD=db-password:latest
```

##### ローカル開発環境での設定

Windowsの場合:
```bash
set AMPLIFY_TOKEN=YOUR_TOKEN_HERE
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=school_menu_db
set DB_USER=postgres
set DB_PASSWORD=YOUR_PASSWORD
python main.py
```

Linux/Macの場合:
```bash
export AMPLIFY_TOKEN=YOUR_TOKEN_HERE
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=school_menu_db
export DB_USER=postgres
export DB_PASSWORD=YOUR_PASSWORD
python main.py
```

または、`.env` ファイルを作成（backendディレクトリ内）:
```
AMPLIFY_TOKEN=YOUR_TOKEN_HERE
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_menu_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
```

#### 4. URLの確認
デプロイが完了すると、以下のようなURLが表示されます：
```
https://school-menu-optimizer-backend-xxxxx-an.a.run.app
```

#### 5. 動作確認
```bash
curl -X POST https://YOUR_CLOUD_RUN_URL/optimize \
  -H "Content-Type: application/json" \
  -d '{"M": 5, "cost": 1500}'
```

### 方法2: App Engine Standard

#### 1. app.yamlの作成
```yaml
runtime: python311
entrypoint: python main.py

instance_class: F2

env_variables:
  PORT: '8080'
  AMPLIFY_TOKEN: 'YOUR_TOKEN_HERE'  # 本番環境ではSecret Managerを推奨

automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.65
```

#### 2. デプロイ
```bash
cd backend3
gcloud app deploy
```

### 方法3: Cloud Functions (2nd gen)

Cloud Functions 2nd genはCloud Runベースなので、方法1が推奨されます。

## 料金の目安

### Cloud Run
- リクエスト: 1リクエスト約10秒実行として月1000リクエストで約$10-20
- メモリ: 2GiB
- CPU: 2コア
- 無料枠: 月180万リクエスト秒まで無料

### App Engine
- インスタンス時間に基づく課金
- F2クラス: 約$0.11/時間

## セキュリティ設定

### 1. 認証を有効化する場合
```bash
gcloud run services update school-menu-optimizer-backend \
  --region asia-northeast1 \
  --no-allow-unauthenticated
```

### 2. CORS設定の調整
main.pyの `CORS_ORIGIN` を特定のドメインに変更：
```python
CORS_ORIGIN = "https://your-frontend-domain.com"
```

### 3. シークレット管理
Amplify APIトークンなどの機密情報は、環境変数ではなくSecret Managerを使用することを推奨します。

詳細は「#### 3. 環境変数の設定（必須）」の「方法B: Secret Manager を使用」を参照してください。

main.pyでは以下のように環境変数から読み込みます：
```python
token = os.getenv("AMPLIFY_TOKEN")
```

## モニタリング

### ログの確認
```bash
# Cloud Runのログを表示
gcloud run services logs read school-menu-optimizer-backend \
  --region asia-northeast1 \
  --limit 50
```

### メトリクスの確認
- Cloud Consoleの「Cloud Run」セクションでメトリクスを確認
- リクエスト数、レイテンシ、エラー率などを監視

## トラブルシューティング

### デプロイエラー
1. ログを確認: `gcloud run services logs read ...`
2. ビルドログを確認: Cloud Consoleの「Cloud Build」セクション
3. requirements.txtの依存関係を確認

### タイムアウトエラー
- タイムアウト時間を延長: `--timeout 600`
- メモリを増やす: `--memory 4Gi`

### CORS エラー
- main.pyのCORS設定を確認
- preflightリクエスト（OPTIONS）が正しく処理されているか確認

## 本番環境の推奨設定

```bash
gcloud run deploy school-menu-optimizer-backend \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --memory 4Gi \
  --cpu 4 \
  --timeout 600 \
  --max-instances 20 \
  --min-instances 1 \
  --no-allow-unauthenticated \
  --vpc-connector YOUR_VPC_CONNECTOR \
  --service-account YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com
```

## CI/CD設定（Cloud Build）

cloudbuild.yamlの例：
```yaml
steps:
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'school-menu-optimizer-backend'
      - '--source=./backend3'
      - '--platform=managed'
      - '--region=asia-northeast1'
      - '--allow-unauthenticated'

options:
  logging: CLOUD_LOGGING_ONLY
```
