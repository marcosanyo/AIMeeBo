# Load .env file if it exists and export its variables
-include .env
export

# GCP_PROJECT_ID will be sourced from .env's PROJECT_ID if set, otherwise fallback to gcloud config or require override.
GCP_PROJECT_ID ?= $(PROJECT_ID)
GCP_PROJECT_ID ?= $(shell gcloud config get-value project 2>/dev/null)

IMAGE_NAME ?= meeting-mate-backend
IMAGE_TAG ?= latest
GCR_HOSTNAME ?= gcr.io
# IMAGE_PATH needs GCP_PROJECT_ID to be resolved first
IMAGE_PATH = $(GCR_HOSTNAME)/$(GCP_PROJECT_ID)/$(IMAGE_NAME):$(IMAGE_TAG)

TF_ENV ?= dev
TF_DIR = environments/$(TF_ENV)

# Default target
.PHONY: all
all: help

# Help target to display available commands
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make build-push         - Build the backend Docker image and push to GCR using Cloud Build"
	@echo "  make tf-init            - Initialize Terraform in $(TF_DIR)"
	@echo "  make tf-plan            - Generate a Terraform execution plan for $(TF_DIR)"
	@echo "  make tf-apply           - Apply the Terraform configuration for $(TF_DIR)"
	@echo "  make tf-destroy         - Destroy Terraform-managed infrastructure in $(TF_DIR)"
	@echo ""
	@echo "Variables sourced from .env or gcloud config (can be overridden):"
	@echo "  GCP_PROJECT_ID (current: $(GCP_PROJECT_ID)) - (from .env: $(PROJECT_ID))"
	@echo "  Other variables from .env like REGION, LLM_MODEL, FIREBASE_DATABASE_URL are also exported."
	@echo ""
	@echo "Other variables that can be overridden:"
	@echo "  IMAGE_NAME (current: $(IMAGE_NAME))"
	@echo "  IMAGE_TAG (current: $(IMAGE_TAG))"
	@echo "  GCR_HOSTNAME (current: $(GCR_HOSTNAME)) - Use 'asia.gcr.io' or other regional GCR if needed"
	@echo "  TF_ENV (current: $(TF_ENV)) - Target environment (dev, stg, prod)"
	@echo "  make deploy-frontend    - Deploy frontend to Firebase Hosting"


# Docker/Cloud Build related targets
.PHONY: build-push
build-push: check-gcp-project
	@echo "Building and pushing Docker image for backend to $(IMAGE_PATH)..."
	@cd meeting-mate-app/server && \
	gcloud builds submit --tag $(IMAGE_PATH) .
	@echo "Image build and push complete: $(IMAGE_PATH)"

# Terraform related targets
.PHONY: tf-init
tf-init: check-tf-dir
	@echo "Initializing Terraform in $(TF_DIR)..."
	@cd $(TF_DIR) && terraform init -upgrade

.PHONY: tf-plan
tf-plan: check-tf-dir check-gcp-project
	@echo "Planning Terraform changes in $(TF_DIR)..."
	@cd $(TF_DIR) && terraform plan -var="project_id=$(GCP_PROJECT_ID)"

.PHONY: tf-apply
tf-apply: check-tf-dir check-gcp-project
	@echo "Applying Terraform changes in $(TF_DIR)..."
	@cd $(TF_DIR) && terraform apply -var="project_id=$(GCP_PROJECT_ID)" -auto-approve

.PHONY: tf-destroy
tf-destroy: check-tf-dir check-gcp-project
	@echo "Destroying Terraform-managed infrastructure in $(TF_DIR)..."
	@cd $(TF_DIR) && terraform destroy -var="project_id=$(GCP_PROJECT_ID)" -auto-approve

# Firebase Hosting deploy target
.PHONY: deploy-frontend
deploy-frontend: check-gcp-project # GCP_PROJECT_IDはFirebaseプロジェクトにも関連するためチェック
	@echo "Building Next.js frontend for static export..."
	@cd meeting-mate-app && npm install && npm run export
	@echo "Deploying frontend to Firebase Hosting..."
	@cd meeting-mate-app && npx firebase deploy --only hosting --project $(GCP_PROJECT_ID)
	@echo "Frontend deployment complete."

# プレビューチャンネルでhosting
.PHONY: deploy-frontend-preview
deploy-frontend-preview: check-gcp-project
	@cd meeting-mate-app && npx firebase hosting:channel:deploy preview --project $(GCP_PROJECT_ID)
	@echo "Frontend preview deployment complete."

# プレビューチャンネルのhostingを削除
.PHONY: delete-frontend-preview
delete-frontend-preview: check-gcp-project
	@echo "Deleting Firebase Hosting preview channel..."
	@cd meeting-mate-app && npx firebase hosting:channel:delete preview --project $(GCP_PROJECT_ID)
	@echo "Frontend preview channel deleted."

# Helper targets
.PHONY: check-gcp-project
check-gcp-project:
ifndef GCP_PROJECT_ID
	$(error GCP_PROJECT_ID is not set. Please set it in .env, via 'gcloud config set project YOUR_PROJECT_ID', or pass it as a make variable, e.g., 'make build-push GCP_PROJECT_ID=your-project')
endif

.PHONY: check-tf-dir
check-tf-dir:
	@if [ ! -d "$(TF_DIR)" ]; then \
		echo "Error: Terraform directory $(TF_DIR) does not exist."; \
		exit 1; \
	fi
