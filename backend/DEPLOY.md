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
  --cpu 2 \
  --timeout 300 \
  --max-instances 2

# 更新時は同じコマンドを実行
```

#### 3. 環境変数の設定（必須）

アプリケーションは `AMPLIFY_TOKEN` 環境変数を必要とします。以下のいずれかの方法で設定してください。

##### 方法A: 環境変数として設定（開発・テスト環境向け）
```bash
gcloud run services update school-menu-optimizer-backend \
  --region asia-northeast1 \
  --set-env-vars AMPLIFY_TOKEN=YOUR_TOKEN_HERE
```

##### 方法B: Secret Manager を使用（本番環境推奨）
Secret Managerを使用すると、トークンを安全に管理できます。

```bash
# 1. Secret Manager APIを有効化
gcloud services enable secretmanager.googleapis.com

# 2. シークレットを作成
echo -n "YOUR_AMPLIFY_TOKEN" | gcloud secrets create amplify-token --data-file=-

# 3. Cloud RunサービスアカウントにSecret Managerへのアクセス権を付与
gcloud secrets add-iam-policy-binding amplify-token \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 4. Cloud Runにシークレットを環境変数として設定
gcloud run services update school-menu-optimizer-backend \
  --region asia-northeast1 \
  --update-secrets AMPLIFY_TOKEN=amplify-token:latest
```

##### ローカル開発環境での設定

Windowsの場合:
```bash
set AMPLIFY_TOKEN=YOUR_TOKEN_HERE
python main.py
```

Linux/Macの場合:
```bash
export AMPLIFY_TOKEN=YOUR_TOKEN_HERE
python main.py
```

または、`.env` ファイルを作成（backend3ディレクトリ内）:
```
AMPLIFY_TOKEN=YOUR_TOKEN_HERE
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
