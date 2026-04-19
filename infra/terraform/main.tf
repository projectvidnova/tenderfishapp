terraform {
  required_version = ">= 1.5"

  required_providers {
    ionoscloud = {
      source  = "ionos-cloud/ionoscloud"
      version = "~> 6.6"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    # Terraform state stored in IONOS S3
    # Configured via -backend-config in CI
    key                         = "tenderfish/terraform.tfstate"
    region                      = "de"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

provider "ionoscloud" {
  # Credentials via IONOS_USERNAME + IONOS_PASSWORD env vars
  # or IONOS_TOKEN for token-based auth
}

# AWS provider configured to talk to IONOS S3
provider "aws" {
  region     = var.s3_region
  access_key = var.s3_access_key
  secret_key = var.s3_secret_key

  endpoints {
    s3  = var.s3_endpoint
    sts = "https://sts.eu-central-1.ionoscloud.com"
    iam = "https://iam.eu-central-1.ionoscloud.com"
  }

  # Required for IONOS S3 compatibility
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
}
