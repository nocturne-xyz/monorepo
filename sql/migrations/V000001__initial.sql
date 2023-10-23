CREATE USER nocturne_db_user
WITH
  PASSWORD '${nocturne_db_user_password}' NOCREATEDB NOCREATEROLE LOGIN
;

GRANT USAGE
, CREATE ON SCHEMA public TO nocturne_db_user
;

CREATE TABLE
  test (id INT, NAME TEXT, foo TEXT)
;

GRANT
SELECT

, INSERT
, UPDATE
, DELETE ON test TO nocturne_db_user
;
