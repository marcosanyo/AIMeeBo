variable "project_id" {
  description = "The GCP project ID."
  type        = string
}

variable "location" {
  description = "The GCP region for Cloud Run deployment."
  type        = string
}

variable "firebase_database_url" {
  description = "The URL of the Firebase Realtime Database."
  type        = string
}

variable "encryption_key" {
  description = "The encryption key for API keys."
  type        = string
  sensitive   = true
}

variable "llm_model" {
  description = "The name of the LLM model to use."
  type        = string
}
