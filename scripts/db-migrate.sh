#!/usr/bin/env bash
#
# Apply Drizzle migrations to a database.
#
#   scripts/db-migrate.sh local           the DATABASE_URL in the environment or .env.local
#   scripts/db-migrate.sh prod            RDS, connection string from SSM Parameter Store
#   scripts/db-migrate.sh url             the DATABASE_URL in the environment, treated as production (Neon)
#
#   --status   print the applied ledger and exit, no writes
#   --adopt    move a database migrated before the `fenro` schema into it, then exit
#   --reset    drop Fenro's two schemas first, then migrate (never touches Flexi Day)
#   --yes      skip the confirmation prompt on an ordinary migrate
#
# A PRODUCTION WRITE IS RUN BY A HUMAN, NEVER BY AN AGENT. `prod` and `url`
# refuse to write unless stdin is a terminal, which stops a coding agent or a
# stray script from applying DDL to a live database. CD can set DB_MIGRATE_CI=1
# to opt out once someone has decided that is what they want. --status only
# reads, so it stays open to anyone. --adopt and --reset ask for a typed phrase
# even with --yes.
#
# The connection string is never printed and never passed as a command-line
# argument, where `ps` and /proc would expose it to every other local user.
# psql receives the parts through libpq's PG* environment variables and the
# migrator receives the whole URL through DATABASE_URL.
#
# --adopt is for the database Fenro ran on before this script existed (Neon):
# its 19 tables sit in `public` and its ledger in `drizzle.__drizzle_migrations`,
# after all nine migrations up to 0008_task_skills. The history was then
# squashed into 0000_baseline, which creates the same tables in `fenro`.
# Replaying the baseline there would fail on the first existing table, so
# --adopt moves the tables into `fenro` (data, indexes and constraints move with
# them) and records the baseline as applied, in one transaction. It refuses on
# any database that is not in exactly that state, Flexi Day's included.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

TARGET="${1:-}"
shift || true

DO_STATUS=0
DO_ADOPT=0
DO_RESET=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --status) DO_STATUS=1 ;;
    --adopt) DO_ADOPT=1 ;;
    --reset) DO_RESET=1 ;;
    --yes | -y) ASSUME_YES=1 ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

: "${AWS_REGION:=eu-central-1}"
: "${DB_PARAMETER:=/fenro/production/database-url}"
CA_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/fenro"
CA_PATH="$CA_DIR/rds-global-bundle.pem"

# Must match migrationConfig in src/shared/infrastructure/database/migrations.ts.
DATA_SCHEMA="fenro"
LEDGER_SCHEMA="fenro_migrations"
LEDGER_TABLE="__drizzle_migrations"

PRE_SCHEMA_MIGRATIONS=9
PRE_SCHEMA_LAST_MILLIS=1791137399008
PRE_SCHEMA_TABLES=(
  account agent_access_token github_issue github_pull_request
  github_repository_snapshot github_watched_repository session task
  task_external_reference task_journal_entry task_label task_link task_picture
  task_session task_skill task_skill_label task_skill_revision user
  verification
)

die() {
  echo "error: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but not on PATH"
}

describe_url() {
  sed -E 's#^([a-z]+)://[^@]*@#\1://#; s#\?.*$##' <<<"$1"
}

urldecode() {
  printf '%b' "${1//%/\\x}"
}

export_pg_env() {
  local url="$1" rest query userinfo hostport user pass host port dbname kv k v

  rest="${url#*://}"
  query=""
  if [[ "$rest" == *\?* ]]; then
    query="${rest#*\?}"
    rest="${rest%%\?*}"
  fi

  userinfo=""
  if [[ "$rest" == *@* ]]; then
    userinfo="${rest%%@*}"
    rest="${rest#*@}"
  fi

  hostport="${rest%%/*}"
  dbname="${rest#*/}"
  user="${userinfo%%:*}"
  pass=""
  if [[ "$userinfo" == *:* ]]; then pass="${userinfo#*:}"; fi
  host="${hostport%%:*}"
  port=""
  if [[ "$hostport" == *:* ]]; then port="${hostport#*:}"; fi

  if [[ -n "$host" ]]; then export PGHOST="$(urldecode "$host")"; fi
  if [[ -n "$port" ]]; then export PGPORT="$port"; fi
  if [[ -n "$user" ]]; then export PGUSER="$(urldecode "$user")"; fi
  if [[ -n "$pass" ]]; then export PGPASSWORD="$(urldecode "$pass")"; fi
  if [[ -n "$dbname" ]]; then export PGDATABASE="$(urldecode "$dbname")"; fi

  local IFS='&'
  for kv in $query; do
    k="${kv%%=*}"
    v="${kv#*=}"
    case "$k" in
      sslmode) export PGSSLMODE="$(urldecode "$v")" ;;
      sslrootcert) export PGSSLROOTCERT="$(urldecode "$v")" ;;
    esac
  done

  return 0
}

# force=1 means --yes does not apply.
confirm() {
  local prompt="$1" expected="$2" force="${3:-0}" answer
  if [[ "$ASSUME_YES" == "1" && "$force" != "1" ]]; then
    return 0
  fi
  echo
  echo "$prompt"
  read -r -p "Type '$expected' to continue: " answer
  [[ "$answer" == "$expected" ]] || die "aborted"
}

resolve_local_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "$DATABASE_URL"
    return
  fi
  local file line
  for file in .env.local .env; do
    [[ -f "$file" ]] || continue
    line="$(grep -E '^[[:space:]]*DATABASE_URL=' "$file" | head -1 | cut -d= -f2-)" || true
    [[ -n "$line" ]] || continue
    line="${line%%#*}"
    line="$(sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' <<<"$line")"
    echo "$line"
    return
  done
  die "no DATABASE_URL in the environment, .env.local or .env"
}

resolve_env_url() {
  [[ -n "${DATABASE_URL:-}" ]] || die "the url target needs DATABASE_URL in the environment"
  echo "$DATABASE_URL"
}

resolve_prod_url() {
  need aws
  local url
  url="$(aws ssm get-parameter \
    --name "$DB_PARAMETER" \
    --with-decryption \
    --region "$AWS_REGION" \
    --query Parameter.Value \
    --output text)" || die "could not read $DB_PARAMETER from SSM Parameter Store"
  [[ "$url" == postgres* ]] || die "parameter $DB_PARAMETER does not look like a connection string"

  # RDS enforces TLS (rds.force_ssl=1). Verify it properly rather than
  # disabling the check: the global bundle is the CA RDS certificates chain to,
  # and both libpq and node-postgres read these two query parameters. Any
  # sslmode already in the secret is replaced, not doubled.
  if [[ ! -s "$CA_PATH" ]]; then
    need curl
    mkdir -p "$CA_DIR"
    curl -fsS -o "$CA_PATH" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem ||
      die "could not download the RDS CA bundle"
  fi

  url="$(sed -E 's/([?&])(sslmode|sslrootcert)=[^&]*&?/\1/g; s/[?&]$//' <<<"$url")"
  local sep="?"
  [[ "$url" == *\?* ]] && sep="&"
  echo "${url}${sep}sslmode=verify-full&sslrootcert=${CA_PATH}"
}

case "$TARGET" in
  local) DATABASE_URL="$(resolve_local_url)" ;;
  url) DATABASE_URL="$(resolve_env_url)" ;;
  prod) DATABASE_URL="$(resolve_prod_url)" ;;
  *)
    echo "usage: $0 <local|url|prod> [--status] [--adopt] [--reset] [--yes]" >&2
    exit 2
    ;;
esac

echo "target:   $TARGET"
echo "database: $(describe_url "$DATABASE_URL")"

if [[ "$DO_STATUS" == "1" ]]; then
  need psql
  export_pg_env "$DATABASE_URL"
  if [[ "$(psql -tAc "select to_regclass('${LEDGER_SCHEMA}.${LEDGER_TABLE}') is not null")" != "t" ]]; then
    echo "no ledger at ${LEDGER_SCHEMA}.${LEDGER_TABLE}: nothing applied yet"
    exit 0
  fi
  psql -v ON_ERROR_STOP=1 -c "
    select id,
           left(hash, 12) as hash,
           to_timestamp(created_at / 1000) at time zone 'UTC' as migration_written
    from ${LEDGER_SCHEMA}.${LEDGER_TABLE}
    order by created_at;"
  exit 0
fi

if [[ "$TARGET" != "local" && ! -t 0 && "${DB_MIGRATE_CI:-0}" != "1" ]]; then
  echo "error: a production migration must be started by a person at a terminal." >&2
  echo "       If you are an agent, stop here and hand these commands to the user." >&2
  echo "       CD may set DB_MIGRATE_CI=1 to run unattended." >&2
  exit 3
fi

if [[ "$DO_ADOPT" == "1" ]]; then
  need psql
  need node
  export_pg_env "$DATABASE_URL"

  # Drizzle records a migration as the sha256 of its file and the `when` of its
  # journal entry; the baseline row must match what the migrator would write.
  BASELINE_TAG="$(node -p "require('./drizzle/meta/_journal.json').entries[0].tag")"
  BASELINE_MILLIS="$(node -p "require('./drizzle/meta/_journal.json').entries[0].when")"
  BASELINE_HASH="$(node -e "
    const c = require('node:crypto'), f = require('node:fs');
    process.stdout.write(c.createHash('sha256').update(f.readFileSync('drizzle/${BASELINE_TAG}.sql', 'utf8')).digest('hex'));
  ")"

  state="$(psql -tA -v ON_ERROR_STOP=1 <<SQL
select to_regnamespace('${DATA_SCHEMA}') is null
   and to_regclass('public.task_skill_revision') is not null
   and to_regclass('drizzle.__drizzle_migrations') is not null;
SQL
)"
  [[ "$state" == "t" ]] ||
    die "not a pre-schema Fenro database: it needs public.task_skill_revision and drizzle.__drizzle_migrations, and no '${DATA_SCHEMA}' schema yet"

  ledger="$(psql -tAc "select count(*) || ' ' || coalesce(max(created_at), 0) from drizzle.__drizzle_migrations")"
  [[ "$ledger" == "${PRE_SCHEMA_MIGRATIONS} ${PRE_SCHEMA_LAST_MILLIS}" ]] ||
    die "the old ledger is not at 0008_task_skills (rows and newest: $ledger); migrate it with the previous release first"

  moves=""
  for table in "${PRE_SCHEMA_TABLES[@]}"; do
    moves+="alter table public.\"${table}\" set schema ${DATA_SCHEMA};"$'\n'
  done

  echo
  echo "Adopt: move ${#PRE_SCHEMA_TABLES[@]} tables from public into ${DATA_SCHEMA}, record ${BASELINE_TAG} as applied."
  confirm "The running app loses its tables until code that reads '${DATA_SCHEMA}' is deployed." "adopt" 1

  psql -v ON_ERROR_STOP=1 -1 <<SQL
create schema ${DATA_SCHEMA};
${moves}
create schema if not exists ${LEDGER_SCHEMA};
create table if not exists ${LEDGER_SCHEMA}.${LEDGER_TABLE} (
  id serial primary key,
  hash text not null,
  created_at bigint
);
insert into ${LEDGER_SCHEMA}.${LEDGER_TABLE} (hash, created_at)
values ('${BASELINE_HASH}', ${BASELINE_MILLIS});
SQL
  echo "adopted; drizzle.__drizzle_migrations is no longer read and can be dropped once you are happy"
  exit 0
fi

if [[ "$DO_RESET" == "1" ]]; then
  need psql
  reset_force=0
  if [[ "$TARGET" != "local" ]]; then reset_force=1; fi
  confirm "This DROPS the '${DATA_SCHEMA}' and '${LEDGER_SCHEMA}' schemas: every Fenro table, row and the ledger. Flexi Day's schemas are not touched." \
    "drop fenro data" "$reset_force"
  export_pg_env "$DATABASE_URL"
  psql -v ON_ERROR_STOP=1 -1 <<SQL
drop schema if exists ${DATA_SCHEMA} cascade;
drop schema if exists ${LEDGER_SCHEMA} cascade;
SQL
  echo "fenro schemas dropped"
fi

if [[ "$TARGET" != "local" && "$DO_RESET" != "1" ]]; then
  confirm "About to apply pending migrations to PRODUCTION." "yes"
fi

# migrations.ts, which the migrator imports, is ESM in a package without
# "type": "module". Node loads it fine and says so on every run.
DATABASE_URL="$DATABASE_URL" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/drizzle-migrate.mts
