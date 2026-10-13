# Plan-level checks with a mocked AWS provider: no credentials, no account.
# Run with `terraform init && terraform test` in terraform/.

mock_provider "aws" {
  mock_data "aws_caller_identity" { defaults = { account_id = "123456789012" } }
  mock_data "aws_iam_openid_connect_provider" { defaults = { arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" } }
  mock_data "aws_route53_zone" { defaults = { zone_id = "Z123", name_servers = ["ns-1"] } }
  mock_data "aws_db_instance" { defaults = { address = "flexi-day-be-production-db.abc.eu-central-1.rds.amazonaws.com", port = 5432 } }
  mock_resource "aws_iam_role" { defaults = { arn = "arn:aws:iam::123456789012:role/x" } }
  mock_resource "aws_ecr_repository" { defaults = { arn = "arn:aws:ecr:eu-central-1:123456789012:repository/daniel88dev/fenro-dashboard", repository_url = "123456789012.dkr.ecr.eu-central-1.amazonaws.com/daniel88dev/fenro-dashboard" } }
  mock_resource "aws_ssm_parameter" { defaults = { arn = "arn:aws:ssm:eu-central-1:123456789012:parameter/fenro/production/x" } }
  mock_resource "aws_apprunner_auto_scaling_configuration_version" { defaults = { arn = "arn:aws:apprunner:eu-central-1:123456789012:autoscalingconfiguration/fenro/1/abc" } }
  mock_resource "aws_apprunner_service" { defaults = { arn = "arn:aws:apprunner:eu-central-1:123456789012:service/fenro-dashboard-production/abc", service_url = "abc.eu-central-1.awsapprunner.com" } }
  mock_resource "aws_apprunner_custom_domain_association" { defaults = { dns_target = "abc.eu-central-1.awsapprunner.com", certificate_validation_records = [{ name = "_x.www.fenro-dashboard.com.", type = "CNAME", value = "_y.acm-validations.aws.", status = "PENDING_VALIDATION" }] } }
}

run "bootstrap" {
  command = apply
  assert {
    condition     = length(aws_apprunner_service.app) == 0 && join(",", keys(aws_ssm_parameter.app)) == "DATABASE_URL"
    error_message = "bootstrap: no service, only the generated DATABASE_URL parameter"
  }
  assert {
    condition     = startswith(nonsensitive(aws_ssm_parameter.app["DATABASE_URL"].value), "postgresql://fenro:") && endswith(nonsensitive(aws_ssm_parameter.app["DATABASE_URL"].value), "@flexi-day-be-production-db.abc.eu-central-1.rds.amazonaws.com:5432/flexiday?sslmode=verify-full")
    error_message = "database url shape"
  }
  assert {
    condition     = strcontains(output.database_bootstrap_command, "create role fenro login password :'fenro_password'")
    error_message = "bootstrap sql"
  }
}

run "service_without_secrets_fails" {
  command = plan
  variables { create_service = true }
  expect_failures = [aws_apprunner_service.app]
}

run "service" {
  command = apply
  variables {
    create_service       = true
    better_auth_secret   = "0123456789abcdef0123456789abcdef"
    github_client_secret = "s"
    github_client_id     = "Iv1.abc"
    github_app_slug      = "fenro"
  }
  assert {
    condition     = join(",", keys(aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_secrets)) == "BETTER_AUTH_SECRET,DATABASE_URL,GITHUB_CLIENT_SECRET"
    error_message = "secrets injected"
  }
  assert {
    condition     = aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables["APP_URL"] == "https://www.fenro-dashboard.com" && aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].port == "3000"
    error_message = "app url / port"
  }
  assert {
    condition     = aws_apprunner_custom_domain_association.app[0].domain_name == "www.fenro-dashboard.com" && !aws_apprunner_custom_domain_association.app[0].enable_www_subdomain
    error_message = "www only"
  }
  assert {
    condition     = length(aws_route53_record.cert_validation) == 0 && length(aws_route53_record.www) == 1
    error_message = "records"
  }
}

run "dns" {
  command = apply
  variables {
    create_service                = true
    manage_dns_validation_records = true
    better_auth_secret            = "0123456789abcdef0123456789abcdef"
    github_client_secret          = "s"
    github_client_id              = "Iv1.abc"
    github_app_slug               = "fenro"
    uploadthing_token             = "u"
  }
  assert {
    condition     = length(aws_route53_record.cert_validation) == 1 && length(aws_ssm_parameter.app) == 4
    error_message = "validation records / params"
  }
  assert {
    condition     = jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"][0] == "repo:Daniel88dev/fenro-dashboard:ref:refs/heads/main"
    error_message = "oidc subject"
  }
  assert {
    condition     = strcontains(output.github_actions_variables_commands, "APP_RUNNER_SERVICE_ARN")
    error_message = "service arn variable"
  }
}
