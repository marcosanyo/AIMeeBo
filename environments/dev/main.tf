locals {
  # project_id は var.project_id を介して供給
  # location も var.location を介して供給されるため、ここでの直接定義は不要
  cloud_run_service_name = "service-name"
  cloud_run_sa_name      = "cr-sa-${local.cloud_run_service_name}" # これは project_id に依存しない
}

# FirebaseプロジェクトをGCPプロジェクトに紐付ける (Firebaseを有効化)
resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id
  # google_firebase_project リソースが firebase.googleapis.com を有効化することを期待
  # depends_on = [google_project_service.firebase_api] # 必要に応じてAPI有効化の依存関係を追加
}

# 必要なAPIを有効化
resource "google_project_service" "firebase_apis" {
  provider = google-beta # API有効化もベータプロバイダー経由が安全か確認
  project  = var.project_id
  for_each = toset([
    "firebase.googleapis.com", # Firebase Management API
    # "firebasedatabase.googleapis.com",   # Firebase Realtime Database API (手動管理のためコメントアウト)
    "identitytoolkit.googleapis.com",      # Firebase Authentication (Identity Platform)
    "cloudresourcemanager.googleapis.com", # Project連携に必要
    "serviceusage.googleapis.com"          # サービス利用状況の確認等
    # 他に必要なAPIがあれば追加
  ])
  service                    = each.key
  disable_dependent_services = false # trueにすると依存サービスも無効化されるので注意
  disable_on_destroy         = false # trueにするとdestroy時にAPIが無効化される
}


# Cloud Run Service Account
resource "google_service_account" "cloud_run_sa" {
  account_id   = local.cloud_run_sa_name
  display_name = "Cloud Run Service Account for Meeting Mate Backend"
  project      = var.project_id # local.project_id の代わりに var.project_id を使用
}

# Grant Service Account access to Firebase Realtime Database (as Firebase Admin)
resource "google_project_iam_member" "cloud_run_sa_firebase_admin" {
  project = var.project_id         # local.project_id の代わりに var.project_id を使用
  role    = "roles/firebase.admin" # Admin SDKがDBにアクセスするために必要な広範な権限
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant Service Account access to Vertex AI User
resource "google_project_iam_member" "cloud_run_sa_vertex_ai_user" {
  project = var.project_id          # local.project_id の代わりに var.project_id を使用
  role    = "roles/aiplatform.user" # Vertex AIを利用するために必要
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Cloud Run Service (FastAPI Backend)
resource "google_cloud_run_v2_service" "backend" {
  name     = local.cloud_run_service_name
  location = var.location # local.location の代わりに var.location を使用
  project  = var.project_id

  template {
    service_account = google_service_account.cloud_run_sa.email
    containers {
      image = "gcr.io/${var.project_id}/${local.cloud_run_service_name}:latest" # local.project_id の代わりに var.project_id を使用
      ports {
        container_port = 8000 # FastAPIがリッスンするポート (DockerfileでEXPOSEするポート)
      }
      env {
        name  = "FIREBASE_DATABASE_URL"
        value = var.firebase_database_url
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "REGION"
        value = var.location
      }
      env {
        name  = "ENCRYPTION_KEY"
        value = var.encryption_key
      }
      env {
        name  = "LLM_MODEL"
        value = var.llm_model
      }
    }
    scaling {
      min_instance_count = 0 # リクエストがない場合は0にスケールダウン (コスト削減)
      max_instance_count = 1 # 最大インスタンス数を1に制限 (開発環境でのコスト削減)
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "allow_unauthenticated" {
  project  = google_cloud_run_v2_service.backend.project
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
