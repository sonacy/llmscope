CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  ts_start        INTEGER NOT NULL,
  ts_end          INTEGER NOT NULL,
  transport       TEXT NOT NULL CHECK(transport IN ('http','sse','ws')),
  method          TEXT NOT NULL,
  url             TEXT NOT NULL,
  host            TEXT NOT NULL,
  status          INTEGER,
  source_kind     TEXT NOT NULL,
  source_label    TEXT NOT NULL,
  source_confidence REAL NOT NULL,
  provider        TEXT NOT NULL,
  model           TEXT,
  prompt_tokens   INTEGER,
  completion_tokens INTEGER,
  total_tokens    INTEGER,
  cost_usd        REAL,
  latency_ms      INTEGER NOT NULL,
  request_headers TEXT NOT NULL,
  response_headers TEXT NOT NULL,
  request_body    TEXT,
  response_body   TEXT,
  request_body_truncated INTEGER NOT NULL DEFAULT 0,
  response_body_truncated INTEGER NOT NULL DEFAULT 0,
  reassembled_meta TEXT,
  error           TEXT,
  parent_id       TEXT REFERENCES events(id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS events_ts_start_idx ON events(ts_start);
CREATE INDEX IF NOT EXISTS events_provider_idx ON events(provider);
CREATE INDEX IF NOT EXISTS events_source_kind_idx ON events(source_kind);
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
CREATE INDEX IF NOT EXISTS events_model_idx ON events(model);
CREATE INDEX IF NOT EXISTS events_parent_idx ON events(parent_id);

CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
  request_body,
  response_body,
  content='events',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(rowid, request_body, response_body)
  VALUES (new.rowid, new.request_body, new.response_body);
END;

CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON events BEGIN
  INSERT INTO events_fts(events_fts, rowid, request_body, response_body)
  VALUES ('delete', old.rowid, old.request_body, old.response_body);
END;

CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON events BEGIN
  INSERT INTO events_fts(events_fts, rowid, request_body, response_body)
  VALUES ('delete', old.rowid, old.request_body, old.response_body);
  INSERT INTO events_fts(rowid, request_body, response_body)
  VALUES (new.rowid, new.request_body, new.response_body);
END;

CREATE TABLE IF NOT EXISTS source_fingerprints (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  match_type    TEXT NOT NULL CHECK(match_type IN ('ua_exact','ua_prefix','ua_regex','host','shape')),
  pattern       TEXT NOT NULL,
  kind          TEXT NOT NULL,
  label         TEXT NOT NULL,
  confidence    REAL NOT NULL,
  user_defined  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(match_type, pattern, user_defined)
);

CREATE INDEX IF NOT EXISTS sf_match_idx ON source_fingerprints(match_type, user_defined);

CREATE TABLE IF NOT EXISTS replays (
  child_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  parent_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (child_id, parent_id)
);
