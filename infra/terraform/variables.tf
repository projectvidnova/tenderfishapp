# ──────────────────────────────────────────────
# General
# ──────────────────────────────────────────────
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "tenderfish"
}

variable "location" {
  description = "IONOS datacenter location"
  type        = string
  default     = "de/fra"
}

# ──────────────────────────────────────────────
# VPS
# ──────────────────────────────────────────────
variable "server_cores" {
  description = "Number of CPU cores for the VPS"
  type        = number
  default     = 4
}

variable "server_ram_mb" {
  description = "RAM in MB for the VPS"
  type        = number
  default     = 8192
}

variable "server_disk_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 80
}

variable "server_image" {
  description = "OS image name or alias for the VPS"
  type        = string
  default     = "ubuntu:latest"
}

variable "ssh_public_key" {
  description = "SSH public key for VPS access"
  type        = string
  sensitive   = true
}

# ──────────────────────────────────────────────
# Database (Managed PostgreSQL)
# ──────────────────────────────────────────────
variable "pg_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "15"
}

variable "pg_instances" {
  description = "Number of PostgreSQL instances (1 = no replicas)"
  type        = number
  default     = 1
}

variable "pg_cores" {
  description = "CPU cores per PostgreSQL instance"
  type        = number
  default     = 2
}

variable "pg_ram_mb" {
  description = "RAM in MB per PostgreSQL instance"
  type        = number
  default     = 4096
}

variable "pg_storage_gb" {
  description = "Storage in GB for PostgreSQL"
  type        = number
  default     = 20
}

variable "pg_admin_username" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "tenderfish_admin"
}

variable "pg_admin_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "pg_db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "tenderfish"
}

# ──────────────────────────────────────────────
# S3 Object Storage
# ──────────────────────────────────────────────
variable "s3_endpoint" {
  description = "IONOS S3 endpoint"
  type        = string
  default     = "https://s3.eu-central-1.ionoscloud.com"
}

variable "s3_region" {
  description = "IONOS S3 region"
  type        = string
  default     = "de"
}

variable "s3_access_key" {
  description = "IONOS S3 access key"
  type        = string
  sensitive   = true
}

variable "s3_secret_key" {
  description = "IONOS S3 secret key"
  type        = string
  sensitive   = true
}

variable "s3_bucket_name" {
  description = "S3 bucket name for file storage"
  type        = string
  default     = "tenderfish-prod-files"
}

# ──────────────────────────────────────────────
# Application
# ──────────────────────────────────────────────
variable "domain" {
  description = "Domain name for the application"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository (org/repo format) for GHCR image pulls"
  type        = string
}
