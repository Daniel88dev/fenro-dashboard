-- Creates the database role Fenro runs as on the RDS instance it shares with
-- Flexi Day. Run once, as the RDS master user, connected to Flexi Day's
-- database (`flexiday`), with the role's password in FENRO_DB_PASSWORD so it
-- never appears on a command line. Terraform generates that password and its
-- `database_bootstrap_command` output runs this file with it:
--
--   FENRO_DB_PASSWORD=... psql "<master connection string>?sslmode=verify-full&sslrootcert=..." \
--     -f scripts/rds-create-fenro-role.sql
--
-- Do not create the `fenro` schema here: the first migration creates it, and
-- fails if it already exists.
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
--     instance's small max_connections. 20 rather than 10: one instance's pool
--     is 10, and a deploy briefly runs the old and new instance side by side,
--     while a migration needs one more.
--   * search_path `fenro`, so a hand-typed query in psql lands in Fenro's
--     schema. The app does not rely on it: every query names the schema.
--   * Membership for the master user, so it can inspect and repair Fenro's
--     objects (RDS's master is not a true superuser).

\set ON_ERROR_STOP on
-- Unset, :'fenro_password' stays literal text, the CREATE ROLE is a syntax
-- error, and ON_ERROR_STOP ends the run before anything is created.
\getenv fenro_password FENRO_DB_PASSWORD

create role fenro with login password :'fenro_password' connection limit 20;
alter role fenro set search_path = fenro;

grant connect, create on database flexiday to fenro;

grant fenro to current_user;
