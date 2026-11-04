-- One database per app, made the first time Postgres starts (an empty data
-- volume). POSTGRES_DB in compose.yml makes the first one, kairos.
CREATE DATABASE milo;
CREATE DATABASE hygeia;
