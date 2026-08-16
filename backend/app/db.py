import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "veroai.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            average_height_cm REAL,
            status TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL REFERENCES videos(id),
            timestamp_s REAL NOT NULL,
            height_cm REAL NOT NULL,
            status TEXT NOT NULL,
            color TEXT NOT NULL
        )
        """
    )
    _add_column_if_missing(conn, "videos", "km_inicio", "REAL")
    _add_column_if_missing(conn, "videos", "km_fim", "REAL")
    _add_column_if_missing(conn, "videos", "nome_trecho", "TEXT")
    _add_column_if_missing(conn, "videos", "is_exemplo", "INTEGER NOT NULL DEFAULT 0")
    _add_column_if_missing(conn, "videos", "rocada_solicitada_em", "TEXT")
    _add_column_if_missing(conn, "videos", "rocada_agendada_para", "TEXT")
    conn.commit()
    conn.close()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, col_type: str) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
