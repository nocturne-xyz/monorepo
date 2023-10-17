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
