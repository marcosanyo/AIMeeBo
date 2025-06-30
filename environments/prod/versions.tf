terraform {
  required_version = ">=1.7.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">=5.2.2"
    }
  }
}
