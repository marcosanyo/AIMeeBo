terraform {
  backend "gcs" {
    bucket = "bucket-name"
    prefix = "state/app-name/dev"
  }
}
