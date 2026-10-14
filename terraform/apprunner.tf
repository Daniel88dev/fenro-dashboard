# App Runner service running the image from ECR.
#
# Deploys: the pipeline pushes an image, moves docker_image_tag onto it and
# calls `aws apprunner start-deployment` with the deploy role (iam.tf). App
# Runner then pulls whatever the tag points at. Rollback is moving the tag back
# to an older SHA tag and starting a deployment.
#
# Networking: default public egress, as in flexi-day-be. The app reaches RDS
# on its public, TLS-only endpoint, GitHub over the internet, and S3 through
# its public endpoint with the instance role. No VPC connector, so no NAT gateway to pay for.
#
# Created only when create_service is true: App Runner fails to create a
# service whose image is not in ECR yet (README, "First rollout").

# One instance, never more, until Next.js has a shared cache handler.
resource "aws_apprunner_auto_scaling_configuration_version" "app" {
  auto_scaling_configuration_name = local.service_name
  min_size                        = 1
  max_size                        = var.apprunner_max_size
  max_concurrency                 = 100

  tags = {
    Name = "${local.service_name}-autoscaling"
  }
}

resource "aws_apprunner_service" "app" {
  count = var.create_service ? 1 : 0

  service_name = local.service_name

  source_configuration {
    auto_deployments_enabled = var.auto_deployments_enabled

    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_repository_type = "ECR"
      image_identifier      = "${aws_ecr_repository.app.repository_url}:${var.docker_image_tag}"

      image_configuration {
        port = tostring(var.app_port)

        runtime_environment_variables = merge(
          {
            NODE_ENV = "production"
            PORT     = tostring(var.app_port)
            # The Next.js standalone server binds to HOSTNAME; App Runner's
            # health check and proxy reach it on all interfaces.
            HOSTNAME = "0.0.0.0"
            # Better Auth builds the GitHub callback from this, so the GitHub
            # App's callback URL is ${APP_URL}/api/auth/callback/github.
            APP_URL = local.app_url
          },
          var.github_client_id != "" ? { GITHUB_CLIENT_ID = var.github_client_id } : {},
          var.github_app_slug != "" ? { GITHUB_APP_SLUG = var.github_app_slug } : {},
          # Credentials come from the instance role, so these two are all
          # the app needs to keep pictures in S3 (README, "Pictures").
          var.serve_pictures_from_s3 ? {
            PICTURES_S3_BUCKET = aws_s3_bucket.pictures.bucket
            PICTURES_S3_REGION = var.aws_region
          } : {}
        )

        # Resolved at deployment through the instance role; each env var gets
        # the referenced secret's whole value.
        runtime_environment_secrets = {
          for name in local.filled_secrets : name => aws_ssm_parameter.app[name].arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = var.apprunner_cpu
    memory            = var.apprunner_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  # src/app/api/health: no database or GitHub call, so a slow dependency does
  # not get the instance replaced.
  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.app.arn

  # Secret values must exist before the first deployment resolves them.
  depends_on = [
    aws_ssm_parameter.app,
    aws_iam_role_policy.apprunner_secrets,
    aws_iam_role_policy.apprunner_pictures,
    aws_iam_role_policy_attachment.apprunner_ecr_access,
  ]

  lifecycle {
    # A missing secret would put the service into a boot loop that is far
    # harder to read than a failed plan.
    precondition {
      condition     = alltrue([for name in local.required_secrets : contains(local.filled_secrets, name)])
      error_message = "better_auth_secret and github_client_secret must be set before create_service is true (DATABASE_URL is built here)."
    }

    precondition {
      condition     = var.github_client_id != "" && var.github_app_slug != ""
      error_message = "github_client_id and github_app_slug must be set before create_service is true."
    }
  }

  tags = {
    Name = local.service_name
  }
}
