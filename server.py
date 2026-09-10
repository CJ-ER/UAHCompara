import json
import hashlib
import hmac
import os
import sqlite3
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).parent
DATABASE = ROOT / "uah-compara.sqlite3"
ADMIN_COOKIE = "uah_admin_session"
DEPARTMENTS = {
    "Informática": ["computadores", "sistemas-informacion", "informatica", "mates-computacion"],
    "Industriales": ["electronica-automatica", "tecnologias-industriales"],
    "Telecomunicación": ["electronica-comunicaciones", "sistemas-telecomunicacion", "tecnologias-telecomunicacion", "telematica"],
}


def connection():
    database = sqlite3.connect(DATABASE)
    database.row_factory = sqlite3.Row
    return database


def initialize_database():
    with connection() as database:
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS professor_scores (
                degree_id TEXT NOT NULL,
                professor_name TEXT NOT NULL,
                votes INTEGER NOT NULL DEFAULT 0,
                wins INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (degree_id, professor_name)
            )
            """
        )


def scores_for(degree_id):
    with connection() as database:
        return [dict(row) for row in database.execute(
            "SELECT professor_name, votes, wins FROM professor_scores WHERE degree_id = ?",
            (degree_id,),
        )]


def save_match(degree_id, winner, loser, is_final):
    with connection() as database:
        database.execute(
            "INSERT INTO professor_scores (degree_id, professor_name) VALUES (?, ?) "
            "ON CONFLICT(degree_id, professor_name) DO NOTHING",
            (degree_id, winner),
        )
        database.execute(
            "INSERT INTO professor_scores (degree_id, professor_name) VALUES (?, ?) "
            "ON CONFLICT(degree_id, professor_name) DO NOTHING",
            (degree_id, loser),
        )
        database.execute(
            "UPDATE professor_scores SET votes = votes + 1, wins = wins + ? "
            "WHERE degree_id = ? AND professor_name = ?",
            (1 if is_final else 0, degree_id, winner),
        )
        score = database.execute(
            "SELECT professor_name, votes, wins FROM professor_scores "
            "WHERE degree_id = ? AND professor_name = ?",
            (degree_id, winner),
        ).fetchone()
        return dict(score)


def admin_signature(value):
    password = os.environ.get("ADMIN_PASSWORD", "")
    return hmac.new(password.encode(), value.encode(), hashlib.sha256).hexdigest()


def is_admin(request):
    password = os.environ.get("ADMIN_PASSWORD", "")
    cookie = request.headers.get("Cookie", "")
    session = next((part.split("=", 1)[1] for part in cookie.split("; ") if part.startswith(f"{ADMIN_COOKIE}=")), "")
    if not password or "." not in session:
        return False
    issued, signature = session.split(".", 1)
    return issued.isdigit() and time.time() - int(issued) < 86400 and hmac.compare_digest(signature, admin_signature(issued))


def admin_scores():
    with connection() as database:
        rows = [dict(row) for row in database.execute(
            "SELECT degree_id, professor_name, votes, wins FROM professor_scores "
            "ORDER BY degree_id, wins DESC, votes DESC, professor_name"
        )]
    by_degree = {}
    for row in rows:
        by_degree.setdefault(row["degree_id"], []).append(row)
    return {
        department: [{"degree": degree, "scores": by_degree.get(degree, [])} for degree in degrees]
        for department, degrees in DEPARTMENTS.items()
    }
class ApplicationHandler(SimpleHTTPRequestHandler):
    def send_json(self, payload, status=200, headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/admin/scores":
            if not is_admin(self):
                self.send_json({"error": "Unauthorized"}, 401)
                return
            self.send_json({"departments": admin_scores()})
            return
        if parsed.path == "/api/scores":
            degree_id = parse_qs(parsed.query).get("degree", [""])[0]
            self.send_json({"scores": scores_for(degree_id)})
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/admin/login":
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            password = os.environ.get("ADMIN_PASSWORD", "")
            if password and hmac.compare_digest(str(payload.get("password", "")), password):
                issued = str(int(time.time()))
                self.send_json(
                    {"ok": True},
                    headers={"Set-Cookie": f"{ADMIN_COOKIE}={issued}.{admin_signature(issued)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400"},
                )
                return
            self.send_json({"error": "Unauthorized"}, 401)
            return
        if self.path != "/api/matches":
            self.send_json({"error": "Not found"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            required = (payload["degree"], payload["winner"], payload["loser"])
            score = save_match(*required, bool(payload.get("final")))
            self.send_json({"ok": True, "score": score})
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.send_json({"error": "Invalid match"}, 400)


if __name__ == "__main__":
    initialize_database()
    server = ThreadingHTTPServer(("", 4173), ApplicationHandler)
    print("UAH Compara escuchando en http://localhost:4173")
    server.serve_forever()