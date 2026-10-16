terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # State is a local file holding every secret value in plain text, so keep
  # the checkout it lives in private and backed up.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "fenro-dashboard"
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}
