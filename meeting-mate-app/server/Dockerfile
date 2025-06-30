# Pythonの公式イメージをベースとして使用
FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# 必要なライブラリをインストールするためのrequirements.txtをコピー
COPY requirements.txt .

# pipをアップグレードし、requirements.txtに記載されたライブラリをインストール
# hadolint ignore=DL3013
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# アプリケーションのソースコードをコピー
COPY . .

# FastAPIアプリケーションがリッスンするポートを指定 (Uvicornのデフォルトは8000)
EXPOSE 8000

# アプリケーションを起動するコマンド
# GOOGLE_APPLICATION_CREDENTIALS はCloud Runのサービスアカウントによって自動的に設定される想定
# PROJECT_ID, REGION, LLM_MODEL, FIREBASE_DATABASE_URL はCloud Runの環境変数から供給される想定
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT} --app-dir /app
