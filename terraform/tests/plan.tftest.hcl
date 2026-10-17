mock_provider "aws" {
  mock_data "aws_caller_identity" { defaults = { account_id = "123456789012" } }
  mock_data "aws_iam_openid_connect_provider" { defaults = { arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" } }
  mock_data "aws_route53_zone" { defaults = { zone_id = "Z123", name_servers = ["ns-1"] } }
  mock_data "aws_apprunner_hosted_zone_id" { defaults = { id = "ZAPPRUNNER" } }
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
    condition     = strcontains(output.database_bootstrap_command, "-f scripts/rds-create-fenro-role.sql") && strcontains(output.database_bootstrap_command, "--name /fenro/production/database-password")
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
  assert {
    condition     = length(aws_apprunner_custom_domain_association.bare) == 0 && length(aws_route53_record.bare) == 0
    error_message = "the bare domain stays detached until redirect_bare_domain is set"
  }
  assert {
    condition     = contains(keys(aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables), "PICTURES_S3_BUCKET")
    error_message = "the app always keeps pictures in S3"
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
  }
  assert {
    condition     = length(aws_route53_record.cert_validation) == 1 && length(aws_ssm_parameter.app) == 3
    error_message = "validation records / params"
  }
  assert {
    condition     = join(",", jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"]) == "repo:Daniel88dev/fenro-dashboard:ref:refs/heads/main,repo:Daniel88dev@64728456/fenro-dashboard@1377254182:ref:refs/heads/main"
    error_message = "oidc subject"
  }
  assert {
    condition     = strcontains(output.github_actions_variables_commands, "APP_RUNNER_SERVICE_ARN")
    error_message = "service arn variable"
  }
}

run "pictures" {
  command = apply
  variables {
    create_service       = true
    better_auth_secret   = "0123456789abcdef0123456789abcdef"
    github_client_secret = "s"
    github_client_id     = "Iv1.abc"
    github_app_slug      = "fenro"
  }
  assert {
    condition     = aws_s3_bucket.pictures.bucket == "fenro-dashboard-production-pictures-123456789012"
    error_message = "bucket name"
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.pictures.block_public_acls && aws_s3_bucket_public_access_block.pictures.block_public_policy && aws_s3_bucket_public_access_block.pictures.ignore_public_acls && aws_s3_bucket_public_access_block.pictures.restrict_public_buckets
    error_message = "bucket must stay private"
  }
  assert {
    condition     = aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables["PICTURES_S3_BUCKET"] == "fenro-dashboard-production-pictures-123456789012" && aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables["PICTURES_S3_REGION"] == "eu-central-1"
    error_message = "app points at the bucket"
  }
  assert {
    condition     = jsondecode(aws_iam_role_policy.apprunner_pictures.policy).Statement[0].Resource == "${aws_s3_bucket.pictures.arn}/*" && join(",", jsondecode(aws_iam_role_policy.apprunner_pictures.policy).Statement[0].Action) == "s3:GetObject,s3:PutObject,s3:DeleteObject"
    error_message = "instance role reaches only this bucket's objects"
  }
  assert {
    condition     = jsondecode(aws_s3_bucket_policy.pictures.policy).Statement[0].Effect == "Deny" && jsondecode(aws_s3_bucket_policy.pictures.policy).Statement[0].Condition.Bool["aws:SecureTransport"] == "false"
    error_message = "TLS only"
  }
}

run "sentry" {
  command = apply
  variables {
    create_service            = true
    better_auth_secret        = "0123456789abcdef0123456789abcdef"
    github_client_secret      = "s"
    github_client_id          = "Iv1.abc"
    github_app_slug           = "fenro"
    sentry_dsn                = "https://public@o1.ingest.de.sentry.io/2"
    sentry_traces_sample_rate = 0.5
  }
  assert {
    condition     = aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables["SENTRY_DSN"] == "https://public@o1.ingest.de.sentry.io/2" && aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables["SENTRY_ENVIRONMENT"] == "production" && aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables["SENTRY_TRACES_SAMPLE_RATE"] == "0.5"
    error_message = "sentry settings"
  }
}

run "bare_domain" {
  command = apply
  variables {
    create_service                = true
    manage_dns_validation_records = true
    redirect_bare_domain          = true
    better_auth_secret            = "0123456789abcdef0123456789abcdef"
    github_client_secret          = "s"
    github_client_id              = "Iv1.abc"
    github_app_slug               = "fenro"
  }
  assert {
    condition     = aws_apprunner_custom_domain_association.bare[0].domain_name == "fenro-dashboard.com" && !aws_apprunner_custom_domain_association.bare[0].enable_www_subdomain
    error_message = "bare domain attached on its own"
  }
  assert {
    condition     = aws_route53_record.bare[0].type == "A" && aws_route53_record.bare[0].name == "fenro-dashboard.com" && one(aws_route53_record.bare[0].alias).zone_id == "ZAPPRUNNER" && one(aws_route53_record.bare[0].alias).name == "abc.eu-central-1.awsapprunner.com"
    error_message = "apex alias to App Runner"
  }
  assert {
    condition     = length(aws_route53_record.bare_cert_validation) == 0 && aws_apprunner_service.app[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables["APP_URL"] == "https://www.fenro-dashboard.com"
    error_message = "validation records wait for their own switch; APP_URL stays www"
  }
}

run "bare_domain_validation" {
  command = apply
  variables {
    create_service                        = true
    manage_dns_validation_records         = true
    redirect_bare_domain                  = true
    manage_bare_domain_validation_records = true
    better_auth_secret                    = "0123456789abcdef0123456789abcdef"
    github_client_secret                  = "s"
    github_client_id                      = "Iv1.abc"
    github_app_slug                       = "fenro"
  }
  assert {
    condition     = length(aws_route53_record.bare_cert_validation) == 1 && length(aws_route53_record.cert_validation) == 1
    error_message = "both certificates validated"
  }
}
