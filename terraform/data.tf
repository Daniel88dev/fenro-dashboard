# Things that exist already and are only read: Terraform never changes them.

data "aws_caller_identity" "current" {}

# flexi-day-be's instance, managed by flexi-day-be's Terraform. Only its
# address is used, to build DATABASE_URL.
data "aws_db_instance" "shared" {
  db_instance_identifier = var.rds_instance_identifier
}

# Created by registering the domain in Route 53. Looking it up, rather than
# creating a zone, keeps the name servers the registration points at.
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# The account holds one GitHub OIDC provider, already used by flexi-day-be's
# deploy role.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}
