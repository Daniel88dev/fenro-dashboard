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

  # State is a local file (terraform.tfstate, gitignored), the same as
  # flexi-day-be. It holds every secret value in plain text, so keep the
  # checkout it lives in private and backed up. To share it later, create a
  # bucket and uncomment:
  # backend "s3" {
  #   bucket       = "your-terraform-state-bucket"
  #   key          = "fenro-dashboard/terraform.tfstate"
  #   region       = "eu-central-1"
  #   use_lockfile = true
  # }
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
