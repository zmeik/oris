-- ===================================================================
-- ORIS reference app — PostgreSQL initial schema
--
-- The paper §5.2 describes the production storage tier:
--   "PostgreSQL JSONB storage uses two tables — panorama_analysis
--    (the current ORIS document as JSONB) and gt_change_history
--    (time-machine versioning with sequence_num, source field,
--    session_id)."
--
-- This file mirrors that schema for deployments brought up via
-- docker-compose up. The reference SQLite path used by `python3
-- mock_app.py` keeps the historical table names ground_truth +
-- history; both schemas carry the same conceptual columns.
--
-- The Flask app picks the storage tier based on ORIS_DB_URL: if it
-- starts with `postgresql://` we route through psycopg, otherwise
-- we fall back to SQLite at reference-app/data/oris-ref.db.
-- ===================================================================

-- 1. Sandboxes (collections of OPGs) -------------------------------
CREATE TABLE IF NOT EXISTS sandboxes (
    sandbox_id    TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    is_demo       BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Files = one OPG per row ---------------------------------------
CREATE TABLE IF NOT EXISTS files (
    file_id       INTEGER PRIMARY KEY,
    sandbox_id    TEXT NOT NULL REFERENCES sandboxes(sandbox_id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    label         TEXT,
    image_id      INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. panorama_analysis -- the current ORIS document for each file --
--    Paper §5.2: "the current ORIS document as JSONB".
CREATE TABLE IF NOT EXISTS panorama_analysis (
    file_id                   INTEGER PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
    formula                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    bridge_links              JSONB NOT NULL DEFAULT '{}'::jsonb,
    tooth_notes               JSONB NOT NULL DEFAULT '{}'::jsonb,
    root_data                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    crop_overrides            JSONB NOT NULL DEFAULT '{}'::jsonb,
    diagnostic_sites          JSONB NOT NULL DEFAULT '{}'::jsonb,
    anatomical_landmarks      JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_modified             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. gt_change_history -- time-machine versioning ------------------
--    Paper §5.2: "sequence_num, source field, session_id".
CREATE TABLE IF NOT EXISTS gt_change_history (
    id            BIGSERIAL PRIMARY KEY,
    file_id       INTEGER NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    sequence_num  INTEGER NOT NULL,
    fdi           TEXT,
    old_value     TEXT,
    new_value     TEXT,
    change_type   TEXT NOT NULL,
    source        TEXT NOT NULL,                          -- 'manual' | 'ai_prefill' | 'ai_prefill_then_manual' | 'anatomy_update'
    session_id    UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, sequence_num)
);
CREATE INDEX IF NOT EXISTS ix_gt_change_history_file_seq
    ON gt_change_history (file_id, sequence_num DESC);
CREATE INDEX IF NOT EXISTS ix_gt_change_history_source
    ON gt_change_history (source);

-- 5. Uploaded images -----------------------------------------------
CREATE TABLE IF NOT EXISTS uploaded_images (
    id            BIGSERIAL PRIMARY KEY,
    sha256        TEXT UNIQUE NOT NULL,
    mime          TEXT NOT NULL,
    width         INTEGER, height INTEGER,
    bytes         BYTEA NOT NULL,
    privacy_ack   BOOLEAN NOT NULL DEFAULT false,
    source_label  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Algorithm experiments (companion paper A) ---------------------
CREATE TABLE IF NOT EXISTS algorithms (
    id            BIGSERIAL PRIMARY KEY,
    file_id       INTEGER NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    codename      TEXT NOT NULL,
    config        JSONB NOT NULL,
    formula       JSONB NOT NULL,
    confidence    DOUBLE PRECISION,
    score         DOUBLE PRECISION,
    is_champion   BOOLEAN,
    is_alive      BOOLEAN,
    generation    INTEGER,
    branch        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Seed sandbox row so bootstrap can attach files to it -----------
INSERT INTO sandboxes (sandbox_id, label, is_demo)
VALUES ('RUDN', 'Anonymised Demo Cases (RUDN K08.1, PII stripped)', true)
ON CONFLICT (sandbox_id) DO NOTHING;
