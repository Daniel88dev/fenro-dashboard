# SSM Parameter Store rather than Secrets Manager: standard parameters are
# free, where Secrets Manager charges $0.40 a secret each month.
#
# A tfvars secret gets a parameter only once it is filled in, so the first
# apply (create_service = false) runs before the GitHub App values are at hand.
#
# App Runner resolves parameters when it deploys. After changing a value,
# start a deployment (start_deployment_command output) or the old one stays
# live.

locals {
  ssm_prefix = "/fenro/${var.environment}"

  # Letters and digits only, so it needs no escaping in the URL, in SQL or in
  # a shell.
  database_url = "postgresql://${var.db_role}:${random_password.database.result}@${data.aws_db_instance.shared.address}:${data.aws_db_instance.shared.port}/${var.db_name}?sslmode=verify-full"

  secret_slugs = {
    DATABASE_URL         = "database-url"
    BETTER_AUTH_SECRET   = "better-auth-secret"
    GITHUB_CLIENT_SECRET = "github-client-secret"
  }

  secret_values = {
    DATABASE_URL         = local.database_url
    BETTER_AUTH_SECRET   = var.better_auth_secret
    GITHUB_CLIENT_SECRET = var.github_client_secret
  }

  required_secrets = ["DATABASE_URL", "BETTER_AUTH_SECRET", "GITHUB_CLIENT_SECRET"]

  # Which secrets are filled in is not itself secret, and for_each cannot take
  # a sensitive value. Only these reach the service.
  filled_secrets = toset([
    for name in keys(local.secret_slugs) : name
    if nonsensitive(local.secret_values[name] != "")
  ])
}

resource "random_password" "database" {
  length  = 40
  special = false
}

resource "aws_ssm_parameter" "database_password" {
  name        = "${local.ssm_prefix}/database-password"
  description = "Password of the ${var.db_role} role on ${var.rds_instance_identifier}"
  type        = "SecureString"
  value       = random_password.database.result

  tags = {
    Name = "${local.ssm_prefix}/database-password"
  }
}

resource "aws_ssm_parameter" "app" {
  for_each = local.filled_secrets

  name        = "${local.ssm_prefix}/${local.secret_slugs[each.key]}"
  description = "${each.key} for ${var.project_name}"
  type        = "SecureString"
  value       = local.secret_values[each.key]

  tags = {
    Name = "${local.ssm_prefix}/${local.secret_slugs[each.key]}"
  }
}
