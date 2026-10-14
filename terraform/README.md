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
  password and builds `DATABASE_URL` from it. Creating the role is a one-off
  by hand: the `database_bootstrap_command` output runs
  `scripts/rds-create-fenro-role.sql` with that password. The first migration
  (`pnpm db:migrate:prod`, which reads `DATABASE_URL` from SSM) creates the
  `fenro` schema and its ledger.
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
4. **Create the database role, then migrate.** From the repository root, run
   the commands printed by `terraform output -raw database_bootstrap_command`.
   They download the RDS CA bundle if needed, connect as flexi-day-be's master
   user and run `scripts/rds-create-fenro-role.sql` with the generated
   password. Then run `pnpm db:migrate:prod`, which creates the `fenro`
   schema and its ledger.
5. **Hand the pipeline its variables.** Run the commands printed by
   `terraform output -raw github_actions_variables_commands`, then let the
   release workflow push the first image to ECR. Its deploy step fails until
   step 8; the push is what matters here.
6. **Fill in the secrets.** Set `better_auth_secret` (the value from Vercel
   production), `github_client_secret`, `github_client_id`, `github_app_slug`
   in `terraform.tfvars`. The plan
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
`database-password`, `better-auth-secret`, `github-client-secret` and, while
pictures move to S3, `uploadthing-token`. App Runner injects each one as the env var of the same
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

## Pictures

Pictures on tasks live in a private bucket, `s3.tf`: Block Public Access on,
no ACLs, TLS only, encrypted, versioned so a removed picture can be restored
for `pictures_noncurrent_days` (30). The App Runner instance role may get, put
and delete objects in it and nothing else, so the app holds no access keys.
Browsers never reach the bucket: `/api/pictures/<id>` sends the bytes. At
about 0.5 MB a picture, a thousand of them cost about a cent a month.

### Moving pictures from UploadThing

Run from `terraform/` unless a step says otherwise, with the same AWS profile
as always. The copy keeps every picture's key, so no database row changes.

1. **Release the code first.** Merge the change that added this section and
   let the release workflow deploy it. Until step 4 it keeps reading
   UploadThing, now through the app.
2. **Create the bucket.** Leave `serve_pictures_from_s3 = false` and keep
   `uploadthing_token` filled in, then `terraform apply`. It adds the bucket,
   its settings and the role's access, and changes nothing the app sees.
3. **Copy, first pass.** From the repository root run the command printed by
   `terraform -chdir=terraform output -raw copy_pictures_command`. Add
   `--dry-run` first to see the count. It reads the database and the token from
   SSM, copies each picture and ends with `failed: 0`. A failure lists the
   picture; run it again, finished ones are skipped.
4. **Switch the app.** Set `serve_pictures_from_s3 = true` and apply. App
   Runner redeploys with `PICTURES_S3_BUCKET` and `PICTURES_S3_REGION` set,
   and from then on new pictures go to S3.
5. **Copy, second pass.** Run the same command again for anything added
   between steps 3 and 4. It should report `copied: 0` or a few.
6. **Check.** Open a task with pictures on www.fenro-dashboard.com, and add
   and remove one.
7. **Drop UploadThing.** Empty `uploadthing_token` and apply: that deletes the
   `uploadthing-token` parameter and the env var. Then delete the app at
   uploadthing.com once you no longer want it as a fallback.

Rolling back before step 7 is setting `serve_pictures_from_s3 = false`:
pictures added in S3 meanwhile would then be missing until switched back.

## Deploying

The release workflow assumes `github_deploy_role_arn` through GitHub OIDC
(only from `main`, see `github_deploy_subjects`; GitHub names this repository
`Daniel88dev@64728456/fenro-dashboard@1377254182` in the token's subject, which
`github_repository_immutable` covers), pushes the image with its
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
($0.50), ECR storage (cents) and the domain (about $16 a year). Pictures in S3 cost
cents. SSM standard parameters are free and the database is already paid for by flexi-day-be.
