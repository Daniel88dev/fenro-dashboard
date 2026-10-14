#!/usr/bin/env bash
#
# Copy every picture on tasks from UploadThing into the S3 bucket, under the
# key the database already holds, so no row changes. Pictures already in the
# bucket with the right size are skipped, which makes a second run cheap: run
# it once before setting serve_pictures_from_s3 = true, and once right after,
# for anything added in between.
#
#   PICTURES_S3_BUCKET=<bucket> scripts/copy-pictures-to-s3.sh            copy
#   PICTURES_S3_BUCKET=<bucket> scripts/copy-pictures-to-s3.sh --dry-run  only say what it would copy
#
# The bucket is the `pictures_bucket` output in terraform/ (the
# `copy_pictures_command` output is this line filled in). DATABASE_URL and
# UPLOADTHING_TOKEN come from SSM Parameter Store, the values App Runner
# uses, unless they are already set in the environment. S3 is written with
# your own AWS credentials (AWS_PROFILE works).
#
# The database is only read. Nothing is deleted from UploadThing.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${AWS_REGION:=eu-central-1}"
: "${SSM_PREFIX:=/fenro/production}"
CA_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/fenro"
CA_PATH="$CA_DIR/rds-global-bundle.pem"

die() {
  echo "error: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but not on PATH"
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) ;;
    *) die "unknown option: $arg" ;;
  esac
done

[[ -n "${PICTURES_S3_BUCKET:-}" ]] ||
  die "set PICTURES_S3_BUCKET (terraform output -raw pictures_bucket)"
need node

parameter() {
  need aws
  aws ssm get-parameter \
    --name "$SSM_PREFIX/$1" \
    --with-decryption \
    --region "$AWS_REGION" \
    --query Parameter.Value \
    --output text || die "could not read $SSM_PREFIX/$1 from SSM Parameter Store"
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(parameter database-url)"
  # RDS enforces TLS; verify it against the RDS CA bundle, as
  # scripts/db-migrate.sh does.
  if [[ ! -s "$CA_PATH" ]]; then
    need curl
    mkdir -p "$CA_DIR"
    curl -fsS -o "$CA_PATH" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem ||
      die "could not download the RDS CA bundle"
  fi
  DATABASE_URL="$(sed -E 's/([?&])(sslmode|sslrootcert)=[^&]*&?/\1/g; s/[?&]$//' <<<"$DATABASE_URL")"
  sep="?"
  [[ "$DATABASE_URL" == *\?* ]] && sep="&"
  DATABASE_URL="${DATABASE_URL}${sep}sslmode=verify-full&sslrootcert=${CA_PATH}"
fi

if [[ -z "${UPLOADTHING_TOKEN:-}" ]]; then
  UPLOADTHING_TOKEN="$(parameter uploadthing-token)"
fi

# Handed over in the environment, never on the command line, where `ps`
# would show them.
DATABASE_URL="$DATABASE_URL" \
  UPLOADTHING_TOKEN="$UPLOADTHING_TOKEN" \
  PICTURES_S3_BUCKET="$PICTURES_S3_BUCKET" \
  PICTURES_S3_REGION="${PICTURES_S3_REGION:-$AWS_REGION}" \
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/copy-pictures-to-s3.mts "$@"
