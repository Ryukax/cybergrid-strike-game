from __future__ import annotations

import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

PRESENCE_TTL_SECONDS = 30
CORE_MIN = 0
CORE_MAX = 1_000
INITIAL_CORE_UNITS = 540

DATA_DIR = Path(os.environ.get("CYBERGRID_DATA_DIR", Path(__file__).parent))
DATABASE_PATH = DATA_DIR / "cybergrid_presence.sqlite3"

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/ecosystem/*": {
            "origins": [
                "https://ryukax.github.io",
                "http://127.0.0.1:*",
                "http://localhost:*",
            ],
            "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        }
    },
)


@contextmanager
def database():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=10000")
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database() -> None:
    with database() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS presence (
                session_id TEXT PRIMARY KEY,
                last_seen REAL NOT NULL,
                integrity_work INTEGER NOT NULL,
                node_integrity REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS construct (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                core_units INTEGER NOT NULL
            );
            INSERT OR IGNORE INTO construct (id, core_units) VALUES (1, 540);
            """
        )


def clean_presence(connection: sqlite3.Connection, now: float) -> None:
    connection.execute(
        "DELETE FROM presence WHERE last_seen < ?",
        (now - PRESENCE_TTL_SECONDS,),
    )


def snapshot(connection: sqlite3.Connection, core_delta: int = 0) -> dict:
    now = time.time()
    clean_presence(connection, now)
    active_players = connection.execute(
        "SELECT COUNT(*) AS count FROM presence"
    ).fetchone()["count"]
    core_units = connection.execute(
        "SELECT core_units FROM construct WHERE id = 1"
    ).fetchone()["core_units"]
    return {
        "activePlayers": active_players,
        "coreUnits": core_units,
        "coreDelta": core_delta,
        "sampledAt": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "cybergrid-integrity-presence"})


@app.get("/api/ecosystem/presence")
def get_presence():
    with database() as connection:
        return jsonify(snapshot(connection))


@app.post("/api/ecosystem/presence/heartbeat")
def heartbeat():
    body = request.get_json(silent=True) or {}
    session_id = body.get("sessionId")
    metrics = body.get("metrics") or {}
    if not isinstance(session_id, str) or not session_id or len(session_id) > 128:
        return jsonify({"error": "A valid sessionId is required"}), 400

    try:
        integrity_work = int(metrics["integrityWork"])
        node_integrity = float(metrics["nodeIntegrity"])
        wave = int(metrics["wave"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Valid match metrics are required"}), 400

    if integrity_work < 0 or not 0 <= node_integrity <= 100 or wave < 1:
        return jsonify({"error": "Presence metrics are outside the accepted envelope"}), 400

    now = time.time()
    with database() as connection:
        connection.execute("BEGIN IMMEDIATE")
        clean_presence(connection, now)
        previous = connection.execute(
            "SELECT integrity_work, node_integrity FROM presence WHERE session_id = ?",
            (session_id,),
        ).fetchone()

        core_delta = 0
        if previous is not None:
            work_gain = max(0, min(250, integrity_work - previous["integrity_work"]))
            integrity_change = max(
                -10.0,
                min(10.0, node_integrity - previous["node_integrity"]),
            )
            core_delta = max(
                -16,
                min(16, work_gain // 25 + round(integrity_change * 1.5)),
            )
            current = connection.execute(
                "SELECT core_units FROM construct WHERE id = 1"
            ).fetchone()["core_units"]
            next_units = max(CORE_MIN, min(CORE_MAX, current + core_delta))
            connection.execute(
                "UPDATE construct SET core_units = ? WHERE id = 1",
                (next_units,),
            )

        connection.execute(
            """
            INSERT INTO presence (session_id, last_seen, integrity_work, node_integrity)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                last_seen = excluded.last_seen,
                integrity_work = excluded.integrity_work,
                node_integrity = excluded.node_integrity
            """,
            (session_id, now, integrity_work, node_integrity),
        )
        return jsonify(snapshot(connection, core_delta))


@app.delete("/api/ecosystem/presence/<session_id>")
def leave(session_id: str):
    with database() as connection:
        connection.execute("DELETE FROM presence WHERE session_id = ?", (session_id,))
        return jsonify(snapshot(connection))


initialize_database()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")))
