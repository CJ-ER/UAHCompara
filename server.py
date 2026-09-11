import json
import hashlib
import hmac
import os
import re
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
    database = sqlite3.connect(DATABASE, timeout=30.0)
    database.row_factory = sqlite3.Row
    return database


def initialize_database():
    with connection() as database:
        database.execute("PRAGMA journal_mode=WAL;")
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
            "SELECT professor_name, votes, wins FROM professor_scores "
            "WHERE degree_id = ? ORDER BY wins DESC, votes DESC, professor_name",
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
    password = os.environ.get("ADMIN_PASSWORD", "0000")
    return hmac.new(password.encode(), value.encode(), hashlib.sha256).hexdigest()


def is_admin(request):
    password = os.environ.get("ADMIN_PASSWORD", "0000")
    cookie = request.headers.get("Cookie", "")
    session = next((part.split("=", 1)[1] for part in cookie.split("; ") if part.startswith(f"{ADMIN_COOKIE}=")), "")
    if not password or "." not in session:
        return False
    issued, signature = session.split(".", 1)
    return issued.isdigit() and time.time() - int(issued) < 86400 and hmac.compare_digest(signature, admin_signature(issued))


DEPARTMENTS = [
    "Departamento de Automática",
    "Departamento de Ciencias de la Computación",
    "Departamento de Electrónica",
    "Departamento de Física y Matemáticas",
    "Departamento de Teoría de la Señal y Comunicaciones",
    "Departamento de Economía y Organización de Empresas",
]

_prof_role_map = None


def get_prof_role_map():
    global _prof_role_map
    if _prof_role_map is not None:
        return _prof_role_map
    _prof_role_map = {}
    try:
        content = (ROOT / "catalog.js").read_text(encoding="utf-8")
        json_str = content[content.find("{"):content.rfind("}") + 1]
        catalog = json.loads(json_str)
        for degree_data in catalog.values():
            for p in degree_data.get("professors", []):
                name = p["name"]
                if name not in _prof_role_map:
                    _prof_role_map[name] = set()
                if p.get("role"):
                    _prof_role_map[name].add(p["role"])
    except Exception as err:
        print("Could not load catalog in server.py:", err)
    return _prof_role_map


def classify_dept(roles_set):
    text = " · ".join(roles_set).lower() if roles_set else ""

    # 1. Física y Matemáticas
    if re.search(r"\b(matemática|matemáticas|física|álgebra|cálculo|estadística|ecuaciones|geometría|análisis matemático)\b", text):
        return "Departamento de Física y Matemáticas"
    # 2. Electrónica
    if re.search(r"\b(electrónica|circuitos|circuitos de comunicación|microelectrónica|instrumentación|sensor|sensores|tecnología electrónica)\b", text):
        return "Departamento de Electrónica"
    # 3. Teoría de la Señal y Comunicaciones
    if re.search(r"\b(redes|telemática|comunicaciones|radio|antenas|antena|transmisión|señal|servicios telemáticos|laboratorio de redes)\b", text):
        return "Departamento de Teoría de la Señal y Comunicaciones"
    # 4. Automática
    if re.search(r"\b(control|automática|automatización|robótica|sistemas operativos|visión artificial|sistemas digitales|sistemas empotrados|arquitectura|estructura de computadores|percepción|tiempo real)\b", text):
        return "Departamento de Automática"
    # 5. Economía y Organización de Empresas
    if re.search(r"\b(economía|empresa|organización de empresas|derecho|desarrollo de talento|gestión de la innovación)\b", text):
        return "Departamento de Economía y Organización de Empresas"
    # 6. Ciencias de la Computación
    return "Departamento de Ciencias de la Computación"


def admin_scores():
    role_map = get_prof_role_map()
    with connection() as database:
        rows = [dict(row) for row in database.execute(
            "SELECT degree_id, professor_name, votes, wins FROM professor_scores"
        )]
    dept_scores = {d: {} for d in DEPARTMENTS}
    for row in rows:
        prof = row["professor_name"]
        roles_set = role_map.get(prof, set())
        dept = classify_dept(roles_set)
        if dept not in dept_scores:
            dept_scores[dept] = {}
        if prof not in dept_scores[dept]:
            dept_scores[dept][prof] = {"professor_name": prof, "votes": 0, "wins": 0}
        dept_scores[dept][prof]["votes"] += row["votes"]
        dept_scores[dept][prof]["wins"] += row["wins"]

    result = {}
    for dept in DEPARTMENTS:
        profs = dept_scores[dept].values()
        sorted_profs = sorted(profs, key=lambda p: (-p["wins"], -p["votes"], p["professor_name"]))
        result[dept] = sorted_profs
    return result
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
            password = os.environ.get("ADMIN_PASSWORD", "0000")
            if password and hmac.compare_digest(str(payload.get("password", "")), password):
                issued = str(int(time.time()))
                self.send_json(
                    {"ok": True},
                    headers={"Set-Cookie": f"{ADMIN_COOKIE}={issued}.{admin_signature(issued)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400"},
                )
                return
            self.send_json({"error": "Unauthorized"}, 401)
            return
        if self.path == "/api/admin/reset":
            if not is_admin(self):
                self.send_json({"error": "Unauthorized"}, 401)
                return
            with connection() as database:
                database.execute("DELETE FROM professor_scores")
            self.send_json({"ok": True})
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