output "app_url" {
  description = "Public URL of the app (APP_URL)"
  value       = local.app_url
}

output "github_callback_url" {
  description = "Callback URL to set on the production GitHub App"
  value       = "${local.app_url}/api/auth/callback/github"
}

# Release pipeline
output "ecr_repository_url" {
  description = "Registry and repository the pipeline pushes to"
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.app.name
}

output "github_deploy_role_arn" {
  description = "Role the GitHub Actions workflow assumes through OIDC"
  value       = aws_iam_role.github_deploy.arn
}

output "github_actions_variables_commands" {
  description = "Run once to give the release workflow its repository variables (none of them is a secret)"
  value = join("\n", concat(
    [
      "gh variable set AWS_REGION --body ${var.aws_region} -R ${var.github_repository}",
      "gh variable set AWS_ROLE_ARN --body ${aws_iam_role.github_deploy.arn} -R ${var.github_repository}",
      "gh variable set ECR_REPOSITORY --body ${aws_ecr_repository.app.name} -R ${var.github_repository}",
    ],
    var.create_service ? [
      "gh variable set APP_RUNNER_SERVICE_ARN --body ${aws_apprunner_service.app[0].arn} -R ${var.github_repository}",
    ] : []
  ))
}

# Service (null until create_service is true)
output "apprunner_service_arn" {
  description = "App Runner service ARN"
  value       = one(aws_apprunner_service.app[*].arn)
}

output "apprunner_service_url" {
  description = "Default App Runner URL, which works before DNS and the certificate are ready"
  value       = var.create_service ? "https://${aws_apprunner_service.app[0].service_url}" : null
}

output "custom_domain_status" {
  description = "Custom domain association status; wait for 'active'"
  value       = one(aws_apprunner_custom_domain_association.app[*].status)
}

output "start_deployment_command" {
  description = "Redeploy the current image tag, for example after changing a secret"
  value       = var.create_service ? "aws apprunner start-deployment --service-arn ${aws_apprunner_service.app[0].arn} --region ${var.aws_region}" : null
}

# Secrets and database
output "ssm_parameter_names" {
  description = "SecureString parameters App Runner injects, by env var"
  value       = { for name, parameter in aws_ssm_parameter.app : name => parameter.name }
}

output "database_host" {
  description = "Address of the shared RDS instance DATABASE_URL points at"
  value       = data.aws_db_instance.shared.address
}

# One-off, run by a person before the first migration. It connects as
# flexi-day-be's master user (its Secrets Manager entry) and creates Fenro's
# role and schema with the password generated in ssm.tf. psql's \getenv keeps
# the password off the command line. The CA bundle path is flexi-day-be's
# (scripts/db-migrate.sh downloads it there).
output "database_bootstrap_command" {
  description = "Creates the fenro role and schema on the shared instance (run once, by hand)"
  value       = <<-EOT
    export FENRO_DB_PASSWORD="$(aws ssm get-parameter --name ${aws_ssm_parameter.database_password.name} --with-decryption --query Parameter.Value --output text --region ${var.aws_region})"
    psql "$(aws secretsmanager get-secret-value --secret-id flexi-day-be-production-database-url --region ${var.aws_region} --query SecretString --output text)?sslmode=verify-full&sslrootcert=$HOME/.cache/flexi-day/rds-global-bundle.pem" -v ON_ERROR_STOP=1 <<'SQL'
    \getenv fenro_password FENRO_DB_PASSWORD
    create role ${var.db_role} login password :'fenro_password' connection limit 10;
    create schema ${var.db_role} authorization ${var.db_role};
    alter role ${var.db_role} set search_path = ${var.db_role};
    SQL
    unset FENRO_DB_PASSWORD
  EOT
}

output "route53_name_servers" {
  description = "Name servers of the hosted zone; must match the domain registration"
  value       = data.aws_route53_zone.main.name_servers
}
