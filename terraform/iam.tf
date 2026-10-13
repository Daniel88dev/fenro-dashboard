# Three roles:
#
# 1. ECR access role: assumed by App Runner's build service to pull the image.
# 2. Instance role: assumed by the running app; it only reads the SSM
#    parameters injected as env vars.
# 3. Deploy role: assumed by GitHub Actions through OIDC to push images and
#    start deployments. No long-lived AWS keys live in GitHub.

locals {
  service_name = "${var.project_name}-${var.environment}"

  # Known before the service exists, so the deploy role can be created and
  # used by the pipeline's first image push on the very first apply.
  service_arn_pattern = "arn:aws:apprunner:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${local.service_name}/*"
}

# --- 1. ECR access role -----------------------------------------------------
resource "aws_iam_role" "apprunner_ecr_access" {
  name = "${local.service_name}-apprunner-ecr-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "build.apprunner.amazonaws.com" }
      }
    ]
  })

  tags = {
    Name = "${local.service_name}-apprunner-ecr-access"
  }
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# --- 2. Instance role -------------------------------------------------------
resource "aws_iam_role" "apprunner_instance" {
  name = "${local.service_name}-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "tasks.apprunner.amazonaws.com" }
      }
    ]
  })

  tags = {
    Name = "${local.service_name}-apprunner-instance"
  }
}

# App Runner cannot start an instance whose secrets the role cannot read.
# SecureString values are encrypted with the AWS managed aws/ssm key. That
# key is only created on first use, so it cannot be looked up here; the
# condition limits the grant to decrypting through SSM.
resource "aws_iam_role_policy" "apprunner_secrets" {
  name = "${local.service_name}-apprunner-secrets"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameters"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_prefix}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:key/*"
        Condition = {
          StringEquals = { "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com" }
        }
      }
    ]
  })
}

# --- 3. GitHub Actions deploy role -------------------------------------------
resource "aws_iam_role" "github_deploy" {
  name = "${local.service_name}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRoleWithWebIdentity"
        Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          # Only this repository, and only the listed refs: a workflow on a
          # fork or a feature branch cannot deploy.
          StringLike = {
            "token.actions.githubusercontent.com:sub" = [
              for subject in var.github_deploy_subjects : "repo:${var.github_repository}:${subject}"
            ]
          }
        }
      }
    ]
  })

  tags = {
    Name = "${local.service_name}-github-deploy"
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "${local.service_name}-github-deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Registry login; this action has no resource-level scoping.
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        # Push, plus the reads buildx imagetools needs to move a tag.
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = aws_ecr_repository.app.arn
      },
      {
        Effect = "Allow"
        Action = [
          "apprunner:StartDeployment",
          "apprunner:DescribeService",
          "apprunner:ListOperations"
        ]
        Resource = local.service_arn_pattern
      }
    ]
  })
}
