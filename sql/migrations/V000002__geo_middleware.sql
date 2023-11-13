CREATE TABLE
  requests (
    id BIGSERIAL PRIMARY KEY
  , request JSONB NOT NULL
  , is_flagged BOOLEAN NOT NULL DEFAULT FALSE
  , created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
;

GRANT
SELECT

, INSERT
, UPDATE
, DELETE ON requests TO nocturne_db_user
;

GRANT USAGE
, SELECT
  ON SEQUENCE requests_id_seq TO nocturne_db_user
;
