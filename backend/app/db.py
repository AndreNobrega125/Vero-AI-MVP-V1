import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

# Sem DATABASE_URL o backend usa SQLite local (backend/data/veroai.db), para
# rodar offline sem Supabase. Com DATABASE_URL, usa PostgreSQL (produção).
USE_SQLITE = not DATABASE_URL
SQLITE_PATH = Path(__file__).resolve().parent.parent / "data" / "veroai.db"

if USE_SQLITE:
    _SERIAL = "INTEGER PRIMARY KEY AUTOINCREMENT"
    _NOW = "(datetime('now', 'localtime'))"
else:
    import psycopg2
    import psycopg2.extras

    _SERIAL = "SERIAL PRIMARY KEY"
    _NOW = "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"


class _CursorWrapper:
    """Cursor com fetchone/fetchall em formato dict (RealDictCursor),
    compatível com o padrão dict(row) / row["coluna"] usado no resto do
    código (herdado da época do sqlite3.Row)."""

    def __init__(self, cursor):
        self._cursor = cursor

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def __iter__(self):
        return iter(self._cursor)


class _ConnectionWrapper:
    """Compatibilidade com o padrão conn.execute(...) usado em todo o
    main.py (herdado do sqlite3) — evita reescrever cada call site para
    abrir cursor manualmente ao trocar para psycopg2."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, query: str, params=()) -> _CursorWrapper:
        if USE_SQLITE:
            return _CursorWrapper(self._conn.execute(query.replace("%s", "?"), params))
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(query, params)
        return _CursorWrapper(cur)

    def executemany(self, query: str, seq_of_params) -> None:
        if USE_SQLITE:
            self._conn.executemany(query.replace("%s", "?"), seq_of_params)
            return
        cur = self._conn.cursor()
        cur.executemany(query, seq_of_params)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def get_connection() -> _ConnectionWrapper:
    if USE_SQLITE:
        SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = lambda cur, row: {
            col[0]: row[i] for i, col in enumerate(cur.description)
        }
        return _ConnectionWrapper(conn)
    conn = psycopg2.connect(DATABASE_URL)
    return _ConnectionWrapper(conn)


def init_db() -> None:
    conn = get_connection()
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS videos (
            id {_SERIAL},
            filename TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT {_NOW},
            average_height_cm REAL,
            status TEXT
        )
        """
    )
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS readings (
            id {_SERIAL},
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
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS mensagens (
            id {_SERIAL},
            video_id INTEGER NOT NULL REFERENCES videos(id),
            destinatario TEXT NOT NULL,
            cargo TEXT,
            mensagem TEXT NOT NULL,
            enviada_em TEXT NOT NULL DEFAULT {_NOW}
        )
        """
    )
    _add_column_if_missing(conn, "mensagens", "remetente", "TEXT NOT NULL DEFAULT 'gestor'")
    _add_column_if_missing(conn, "mensagens", "tipo", "TEXT NOT NULL DEFAULT 'texto'")
    _add_column_if_missing(conn, "mensagens", "data_solicitada", "TEXT")
    _add_column_if_missing(conn, "mensagens", "is_exemplo", "INTEGER NOT NULL DEFAULT 0")

    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS usuarios (
            id {_SERIAL},
            nome TEXT NOT NULL,
            papel TEXT NOT NULL,
            cargo_detalhe TEXT,
            rodovia TEXT,
            created_at TEXT NOT NULL DEFAULT {_NOW}
        )
        """
    )
    _seed_usuarios_padrao(conn)

    conn.commit()
    conn.close()


def _seed_usuarios_padrao(conn: _ConnectionWrapper) -> None:
    """Garante as 2 contas fixas de demonstração (login sem senha — não é
    autenticação real, só identifica 'entrar como gestor/encarregado' para
    a simulação de mensagens). Idempotente: só insere se a tabela estiver
    vazia, não sobrescreve edições feitas depois."""
    existentes = conn.execute("SELECT COUNT(*) AS total FROM usuarios").fetchone()
    if existentes["total"] > 0:
        return
    conn.execute(
        "INSERT INTO usuarios (nome, papel, cargo_detalhe, rodovia) VALUES (%s, %s, %s, %s)",
        ("Ana Ribeiro", "gestor", "Gestora de conservação — Motiva", None),
    )
    conn.execute(
        "INSERT INTO usuarios (nome, papel, cargo_detalhe, rodovia) VALUES (%s, %s, %s, %s)",
        ("Carlos Andrade", "encarregado", "Encarregado de roçada — SP-330 (Anhanguera)", "SP-330"),
    )


def _add_column_if_missing(conn: _ConnectionWrapper, table: str, column: str, col_type: str) -> None:
    if USE_SQLITE:
        existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    else:
        existing = {
            row["column_name"]
            for row in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
                (table,),
            ).fetchall()
        }
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
