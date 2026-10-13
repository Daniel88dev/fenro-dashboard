-- Creates the database role Fenro runs as on the RDS instance it shares with
-- Flexi Day. Run once, as the RDS master user, connected to Flexi Day's
-- database (`flexiday`):
--
--   psql "<master connection string>?sslmode=verify-full&sslrootcert=$HOME/.cache/fenro/rds-global-bundle.pem" \
--     -v fenro_password="$(openssl rand -hex 32)" \
--     -f scripts/rds-create-fenro-role.sql
--
-- Keep the password: it goes into the `fenro-dashboard-production-database-url`
-- secret as postgresql://fenro:<password>@<rds address>:5432/flexiday. A hex
-- password needs no URL encoding.
--
-- Why a role of its own rather than the master user Flexi Day uses: Fenro's
-- credentials then cannot read, change or drop anything of Flexi Day's, and a
-- runaway Fenro cannot take every connection on a small instance.
--
-- What the role can do, and why:
--   * LOGIN with a password, like Flexi Day's app (no IAM token refresh in the
--     app).
--   * CREATE on the database, because the first migration creates the `fenro`
--     schema itself and the migrator creates `fenro_migrations` for its ledger.
--     The role owns both, so it can migrate, and `--reset` can drop them, with
--     nothing granted on Flexi Day's `public` or `drizzle` schemas. Postgres 15
--     and later give PUBLIC no CREATE on `public`, so Fenro cannot add tables
--     there either; Flexi Day's tables grant nothing to PUBLIC, so it cannot
--     read them.
--   * A connection limit, so Fenro's pools leave room for Flexi Day on the
--     instance's small max_connections.
--   * search_path `fenro`, so a hand-typed query in psql lands in Fenro's
--     schema. The app does not rely on it: every query names the schema.
--   * Membership for the master user, so it can inspect and repair Fenro's
--     objects (RDS's master is not a true superuser).

\set ON_ERROR_STOP on

create role fenro with login password :'fenro_password' connection limit 20;
alter role fenro set search_path = fenro;

grant connect, create on database flexiday to fenro;

grant fenro to current_user;
