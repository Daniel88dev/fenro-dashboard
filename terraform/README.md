# Terraform

Everything Fenro runs on in AWS: the ECR repository, the App Runner service,
the SSM parameters it injects, the custom domain `www.fenro-dashboard.com`,
and the role GitHub Actions deploys with. Applies run from a person's machine,
never from CI or an agent.

The layout follows flexi-day-be's `terraform/` folder: region `eu-central-1`,
one file per area (listed in `main.tf`), tags from `default_tags`, one value
per env var, local state. The one departure is secrets: SSM Parameter Store
`SecureString` parameters, which are free, instead of Secrets Manager at $0.40
each a month.

## What is not here

- **The database server.** Fenro uses flexi-day-be's RDS instance, which
  flexi-day-be's Terraform owns. `data.tf` only reads its address. Like
  flexi-day-be, App Runner reaches RDS on its public endpoint over TLS, so
  there is no VPC connector and no NAT gateway.
- **The fenro role, schema and migrations.** Terraform generates the role's
  password and builds `DATABASE_URL` from it. Creating the role and schema is
  a one-off by hand (`database_bootstrap_command` output); migrations run with
  `pnpm db:migrate:prod`.
- **The release workflow.** It lives in `.github/workflows/` and uses the
  outputs below.

## State

State is a local `terraform.tfstate` next to these files, gitignored, as in
flexi-day-be. It holds every secret value in plain text, including the
generated database password, so keep the checkout private and backed up.
`provider.tf` has a commented S3 backend for when it needs sharing.

## First rollout

Do these in order. Each `terraform apply` shows a plan and waits for `yes`.
Use the AWS profile of the account flexi-day-be runs in.

1. **Buy the domain.** In the Route 53 console, Registered domains → Register
   domains, register `fenro-dashboard.com` and confirm the contact email AWS
   sends. Registration creates the hosted zone this configuration looks up.
2. **Configure.** `cp terraform.tfvars.example terraform.tfvars`, then
   `terraform init`. The GitHub and Better Auth values can stay empty for now.
3. **First apply.** `terraform apply` with `create_service = false` creates
   the ECR repository, the IAM roles, the database password and the
   `DATABASE_URL` parameter.
4. **Create the database role and schema.** Run the commands printed by
   `terraform output -raw database_bootstrap_command` (they connect as
   flexi-day-be's master user and expect the RDS CA bundle where
   flexi-day-be's migrate script keeps it,
   `~/.cache/flexi-day/rds-global-bundle.pem`), then `pnpm db:migrate:prod`
   from the repository root.
5. **Hand the pipeline its variables.** Run the commands printed by
   `terraform output -raw github_actions_variables_commands`, then let the
   release workflow push the first image to ECR. Its deploy step fails until
   step 8; the push is what matters here.
6. **Fill in the secrets.** Set `better_auth_secret` (the value from Vercel
   production), `github_client_secret`, `github_client_id`, `github_app_slug`
   and, optionally, `uploadthing_token` in `terraform.tfvars`. The plan
   refuses to create the service without the required ones.
7. **Create the service.** Set `create_service = true` and apply. App Runner
   pulls the image and starts on the URL in the `apprunner_service_url`
   output. The same apply attaches `www.fenro-dashboard.com` and writes its
   CNAME.
8. **Validate the certificate.** Set `manage_dns_validation_records = true`
   and apply again. Those records only exist once step 7 has run (see
   `dns.tf`). Wait until `terraform output custom_domain_status` reads
   `active`, then run the `github_actions_variables_commands` output again; it
   now also sets `APP_RUNNER_SERVICE_ARN`.

After that every change is a normal `terraform apply`.

## Secrets

Parameters live under `/fenro/production/`: `database-url`,
`database-password`, `better-auth-secret`, `github-client-secret` and
`uploadthing-token`. App Runner injects each one as the env var of the same
name in capitals, except `database-password`, which only the bootstrap reads.
App Runner resolves them when it deploys, so after changing one, run the
`start_deployment_command` output or the old value stays live.

`better_auth_secret` must be the production value from Vercel. It encrypts
the GitHub tokens stored in the database, so a new value makes every migrated
token unreadable and signs everybody out.

Adding a setting means `src/shared/config/env.ts`, `.env.example`,
`variables.tf`, `terraform.tfvars.example`, and either
`runtime_environment_variables` in `apprunner.tf` (public values) or the two
maps in `ssm.tf` (secrets).

## Deploying

The release workflow assumes `github_deploy_role_arn` through GitHub OIDC
(only from `main`, see `github_deploy_subjects`), pushes the image with its
commit SHA as the tag, moves the `latest` tag onto it and runs
`aws apprunner start-deployment`. Automatic deployments on a tag push are off:
they cost $1 a month and the workflow already starts them. To roll back, point
`latest` at an older SHA tag and start a deployment; the ECR lifecycle policy
keeps the newest 5 images.

## Domain

Only `www.fenro-dashboard.com` is attached to the service, and App Runner
renews its certificate itself. The bare domain has no record: a sign-in
started there would set cookies the `www` callback never sees. A redirect to
`www` can be added later without touching the service.

## Checking a change

`terraform fmt -check -recursive`, `terraform validate`, and `terraform test`,
which plans the rollout stages against a mocked AWS provider (no credentials
needed). Then `terraform plan` against the real account, and apply only what
you meant to change.

## Cost

About $5.40 a month in `eu-central-1` including the domain: App Runner's
provisioned 0.5 GB (about $3), a little vCPU while serving, the hosted zone
($0.50), ECR storage (cents) and the domain (about $16 a year). SSM standard
parameters are free and the database is already paid for by flexi-day-be.
