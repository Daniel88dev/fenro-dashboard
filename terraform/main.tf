# The RDS instance, its VPC and its security group belong to flexi-day-be's
# Terraform and are only read here (data.tf). Creating the database role and
# running migrations happen by hand (database_bootstrap_command output and
# pnpm db:migrate:prod).
