variable "aws_region" {
  description = "AWS region for every resource. eu-central-1 is where flexi-day-be's RDS instance runs, so the app sits next to its database."
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name (production, staging, ...)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Prefix for resource names"
  type        = string
  default     = "fenro-dashboard"
}

variable "create_service" {
  description = "Set to true once CI has pushed the first image to ECR. App Runner refuses to create a service whose image does not exist yet."
  type        = bool
  default     = false
}

variable "manage_dns_validation_records" {
  description = "Set to true after the apply that created the service. The certificate validation records are only known once the custom domain association exists (see dns.tf)."
  type        = bool
  default     = false
}

variable "redirect_bare_domain" {
  description = "Attach the bare domain to the service too, so it redirects to www. Turn on only once the running image has the redirect (src/proxy.ts); an older image would serve the app there."
  type        = bool
  default     = false
}

variable "manage_bare_domain_validation_records" {
  description = "Set to true after the apply that attached the bare domain, for the same reason as manage_dns_validation_records."
  type        = bool
  default     = false
}

variable "ecr_repository_name" {
  description = "ECR repository the release pipeline pushes to"
  type        = string
  default     = "daniel88dev/fenro-dashboard"
}

variable "ecr_keep_images" {
  description = "How many images the lifecycle policy keeps. Older ones are deleted, so this is also how far back a rollback can go."
  type        = number
  default     = 5
}

variable "docker_image_tag" {
  description = "Tag App Runner deploys. The pipeline moves it to the newest image, then starts a deployment."
  type        = string
  default     = "latest"
}

variable "app_port" {
  description = "Port the container listens on (PORT in the Dockerfile)"
  type        = number
  default     = 3000
}

variable "apprunner_cpu" {
  description = "vCPU per instance (256 = 0.25 vCPU, the smallest)"
  type        = string
  default     = "256"
}

variable "apprunner_memory" {
  description = "Memory per instance in MB (512 = 0.5 GB, the smallest)"
  type        = string
  default     = "512"
}

variable "apprunner_max_size" {
  description = "Maximum instances. Keep 1 until Next.js has a shared cache handler: its cache is per instance (README, More than one instance)."
  type        = number
  default     = 1
}

variable "auto_deployments_enabled" {
  description = "Let App Runner redeploy whenever the tag moves. Off by default: it costs $1 a month and the pipeline starts deployments itself."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Apex domain. Registering it in Route 53 creates the public hosted zone this configuration looks up. The app is served on www.<domain> only, which is APP_URL."
  type        = string
  default     = "fenro-dashboard.com"
}

variable "github_repository" {
  description = "owner/name of the repository whose workflows may deploy"
  type        = string
  default     = "Daniel88dev/fenro-dashboard"
}

variable "github_repository_immutable" {
  description = "The repository as GitHub's immutable-ID OIDC subject spells it, owner@owner_id/name@repo_id. GitHub sends this form instead of owner/name for this repository, so the deploy role trusts both. Empty trusts only github_repository."
  type        = string
  default     = "Daniel88dev@64728456/fenro-dashboard@1377254182"
}

variable "github_deploy_subjects" {
  description = "OIDC subject claims allowed to assume the deploy role, relative to the repository. The default lets only workflows running on main deploy."
  type        = list(string)
  default     = ["ref:refs/heads/main"]
}

variable "github_client_id" {
  description = "Client ID of the production GitHub App (public; plain env var)"
  type        = string
  default     = ""
}

variable "github_app_slug" {
  description = "URL name of the production GitHub App, github.com/apps/<slug> (public; plain env var)"
  type        = string
  default     = ""
}

variable "pictures_noncurrent_days" {
  description = "Days a removed or replaced picture stays recoverable as an old object version"
  type        = number
  default     = 30
}

variable "sentry_dsn" {
  description = "DSN of the Sentry project (Project Settings → Client Keys). Empty sends nothing to Sentry."
  type        = string
  default     = ""
}

variable "sentry_traces_sample_rate" {
  description = "Share of requests traced, 0 to 1. The free plan holds 5M spans a month; health checks are never traced."
  type        = number
  default     = 1

  validation {
    condition     = var.sentry_traces_sample_rate >= 0 && var.sentry_traces_sample_rate <= 1
    error_message = "sentry_traces_sample_rate must be between 0 and 1."
  }
}

variable "rds_instance_identifier" {
  description = "Identifier of flexi-day-be's RDS instance Fenro's schema lives on"
  type        = string
  default     = "flexi-day-be-production-db"
}

variable "db_name" {
  description = "Database on that instance holding the fenro schema; must match scripts/rds-create-fenro-role.sql"
  type        = string
  default     = "flexiday"
}

variable "db_role" {
  description = "Fenro's own login role, owner of the fenro schema. Its password is generated here; the name must match scripts/rds-create-fenro-role.sql."
  type        = string
  default     = "fenro"
}

variable "better_auth_secret" {
  description = "BETTER_AUTH_SECRET. It encrypts the stored GitHub tokens, so changing it makes every stored token unreadable and signs everybody out."
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.better_auth_secret == "" || length(var.better_auth_secret) >= 32
    error_message = "better_auth_secret must be at least 32 characters, as src/shared/config/env.ts requires."
  }
}

variable "github_client_secret" {
  description = "Client secret of the production GitHub App"
  type        = string
  sensitive   = true
  default     = ""
}
