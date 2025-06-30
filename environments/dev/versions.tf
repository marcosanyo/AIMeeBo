terraform {
  required_version = ">=1.7.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0" # provider.tf とバージョン指定を合わせる
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0" # provider.tf とバージョン指定を合わせる
    }
  }
}
