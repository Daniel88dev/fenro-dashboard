# Fenro on AWS: App Runner serving the image CI pushes to ECR, on
# www.fenro-dashboard.com, with its database on flexi-day-be's RDS instance.
#
# The RDS instance, its VPC and its security group belong to flexi-day-be's
# Terraform and are only read here (data.tf). Like flexi-day-be, the service uses
# App Runner's default public egress and reaches RDS on its public, TLS-only
# endpoint, so there is no VPC connector. Terraform generates Fenro's
# database password and connection string; creating the role and schema and
# running migrations happen by hand (database_bootstrap_command output and
# pnpm db:migrate:prod).
#
# One file per area:
# - provider.tf: AWS provider, default tags, state
# - variables.tf: input variables
# - data.tf: existing resources read, never managed (RDS, zone, OIDC provider)
# - ecr.tf: image repository and its lifecycle policy
# - ssm.tf: SecureString parameters App Runner injects, database password
# - iam.tf: App Runner roles and the GitHub Actions deploy role (OIDC)
# - s3.tf: private bucket for pictures on tasks
# - apprunner.tf: App Runner service and autoscaling
# - dns.tf: custom domain association (www) and Route 53 records
# - outputs.tf: output values
