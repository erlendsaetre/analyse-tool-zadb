"""
Database migration utility.
Runs safe ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS statements
so existing data is never lost and new columns are added automatically on deploy.
"""
from sqlalchemy import text
from database import engine


def run_migrations():
    with engine.connect() as conn:

        # ── tenders table: add new columns ──────────────────────────────────
        tender_cols = [
            ("customer",    "VARCHAR"),
            ("tender_url",  "VARCHAR"),
            ("valid_from",  "TIMESTAMP"),
            ("valid_until", "TIMESTAMP"),
        ]
        for col, col_type in tender_cols:
            try:
                conn.execute(text(
                    f"ALTER TABLE tenders ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass  # column may already exist in some DB dialects

        # ── tender_imports table: create if not exists ───────────────────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tender_imports (
                id          SERIAL PRIMARY KEY,
                tender_id   INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
                filename    VARCHAR NOT NULL,
                format_type VARCHAR DEFAULT 'kn_row_based',
                imported_at TIMESTAMP DEFAULT NOW(),
                lane_count  INTEGER DEFAULT 0,
                notes       VARCHAR
            )
        """))

        # ── tender_rates table: add new columns ─────────────────────────────
        rate_cols = [
            ("tender_import_id", "INTEGER"),
            ("lane_id",          "VARCHAR"),
            ("routing",          "VARCHAR"),
            ("terms",            "VARCHAR"),
            ("valid_from",       "TIMESTAMP"),
            ("valid_until",      "TIMESTAMP"),
            ("is_selected",      "BOOLEAN DEFAULT FALSE"),
            ("sort_order",       "INTEGER DEFAULT 0"),
        ]
        for col, col_type in rate_cols:
            try:
                conn.execute(text(
                    f"ALTER TABLE tender_rates ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass

        conn.commit()
        print("✅ Migrations complete")
