# Terraformによるインフラ構成管理

このディレクトリ (`environments/`) には、`meeting-mate-app` のインフラストラクチャをTerraformを使用して管理するための設定ファイルが格納されています。各環境 (dev, stg, prod) ごとにサブディレクトリが分かれています。

## 対象環境

*   `dev/`: 開発環境用のTerraform構成
*   `stg/`: ステージング環境用のTerraform構成
*   `prod/`: 本番環境用のTerraform構成

## 管理対象リソース (予定)

Terraformによってプロビジョニングおよび管理される主要なGoogle Cloudリソースは以下の通りです。

*   **Firebase Hosting:** フロントエンド (Next.js SPA) のホスティング。
*   **Firebase Realtime Database:** アプリケーションのデータストア。
    *   **セキュリティルール:** Cloud Runのサービスアカウントからのアクセスのみを許可し、クライアントからの直接アクセスはすべて拒否します。
*   **Google Cloud Run:** バックエンド (FastAPIアプリケーション) の実行環境。
    *   サービスアカウントの作成と適切なIAM権限の付与。
*   **Google Secret Manager:** APIキーやデータベース接続情報などの機密情報を管理。
*   **Google Cloud Build:** CI/CDパイプラインのトリガーと実行設定 (リポジトリ連携など)。
*   **IAM (Identity and Access Management):** 各サービスが必要とする最小限の権限を持つサービスアカウントの作成と、リソースへのアクセス許可設定。

## デプロイアーキテクチャ概要

詳細なアーキテクチャ図と説明は、プロジェクトルートの [README.md](../../README.md#️-デプロイアーキテクチャ) を参照してください。

## プロビジョニング手順 (一般的な流れ)

各環境ディレクトリ (`dev/`, `stg/`, `prod/`) に移動し、標準的なTerraformコマンドを実行します。

1.  **初期化:**
    ```bash
    terraform init
    ```
2.  **プランニング:**
    ```bash
    terraform plan
    ```
3.  **適用:**
    ```bash
    terraform apply
    ```

**注意:**
*   事前にGoogle Cloud SDKの認証設定 (`gcloud auth application-default login` など) が完了している必要があります。
*   Terraformのバックエンド設定 (例: GCSバケット) が各環境の `backend.tf` などで適切に構成されていることを確認してください。
*   各環境の `.tfvars` ファイル (存在する場合) に、環境固有の変数が設定されていることを確認してください。

## Firebase Realtime Database セキュリティルールの方針

Firebase Realtime Databaseのセキュリティルールは、Terraform経由で設定することを想定しています。基本的な方針は以下の通りです。

```json
{
  "rules": {
    // デフォルトではすべての読み書きを拒否
    ".read": false,
    ".write": false,
    "rooms": {
      "$roomId": {
        // Cloud Run上のFastAPIバックエンド (Admin SDKを使用) からのアクセスは
        // これらのルールをバイパスするため、クライアントからの直接アクセスを
        // 防ぐ目的でfalseに設定します。
        ".read": false,
        ".write": false
      }
    }
  }
}
```
これにより、データベースへのすべての正当な操作は、Cloud Run上で実行されるFastAPIアプリケーションを経由することになります。
