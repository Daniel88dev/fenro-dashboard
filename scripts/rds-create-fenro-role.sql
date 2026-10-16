-- Run once as the RDS master user, connected to `flexiday`, with the password
-- in FENRO_DB_PASSWORD so it never appears on a command line (Terraform's
-- database_bootstrap_command output does this).
--
-- Do not create the `fenro` schema here: the first migration creates it, and
-- fails if it already exists. CREATE on the database is what lets it.
--
-- Connection limit 20 rather than 10: one instance's pool is 10, a deploy
-- briefly runs the old and new instance side by side, and a migration needs
-- one more. RDS's master is not a true superuser, so it needs membership in
-- fenro to inspect and repair Fenro's objects.

\set ON_ERROR_STOP on
-- Unset, :'fenro_password' stays literal text, the CREATE ROLE is a syntax
-- error, and ON_ERROR_STOP ends the run before anything is created.
\getenv fenro_password FENRO_DB_PASSWORD

create role fenro with login password :'fenro_password' connection limit 20;
alter role fenro set search_path = fenro;

grant connect, create on database flexiday to fenro;

grant fenro to current_user;
