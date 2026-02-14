# Python 3.11をベースイメージとして使用
FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# 必要なシステムパッケージをインストール
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 依存関係ファイルをコピー
COPY requirements.txt .

# Python依存関係をインストール
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションファイルをコピー
COPY main.py .
COPY reciept.json .
COPY reciept-cost.json .

# ポート8080を公開
EXPOSE 8080

# 環境変数を設定
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# アプリケーションを起動
CMD ["python", "main.py"]
