"""
Персональний фінансовий трекер — Backend сервер
Написаний на чистому Python (http.server), без фреймворків.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import bcrypt
from db import get_connection, init_db
from analyzer import analyze
from urllib.parse import unquote 

import os
PORT = int(os.environ.get("PORT", 8005))
app.run(host="0.0.0.0", port=port)



# ─── CORS та допоміжні функції ────────────────────────────────────────────────

def cors_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, X-Username")


def send_json(handler, status: int, data):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)


def read_body(handler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    raw = handler.rfile.read(length)
    return json.loads(raw) if raw else {}


# ─── Обробник запитів ─────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # Прибираємо стандартні логи, залишаємо тільки наші
        print(f"  {self.command} {self.path}")

    # ── OPTIONS (preflight CORS) ──────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        cors_headers(self)
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────────────
    def do_GET(self):
        path = self.path.split("?")[0]

        # GET /health — перевірка чи сервер живий
        if path == "/health":
            send_json(self, 200, {"status": "ok", "message": "Сервер працює!"})

        # GET /transactions — всі транзакції поточного користувача
        elif path == "/transactions":
            username = unquote(self.headers.get("X-Username", ""))
            
            if not username:
                send_json(self, 401, {"error": "Не авторизовано"})
                return
            conn = get_connection()
            rows = conn.execute(
                "SELECT * FROM transactions WHERE username = ? ORDER BY date DESC",
                (username,)
            ).fetchall()
            conn.close()
            send_json(self, 200, [dict(r) for r in rows])

        # GET /analyze — аналіз витрат користувача
        elif path == "/analyze":
            username = unquote(self.headers.get("X-Username", ""))
            if not username:
                send_json(self, 401, {"error": "Не авторизовано"})
                return
            tips = analyze(username)
            send_json(self, 200, tips)

        else:
            send_json(self, 404, {"error": "Маршрут не знайдено"})

    # ── POST ──────────────────────────────────────────────────────────────────
    def do_POST(self):
        path = self.path.split("?")[0]

        # POST /register — реєстрація нового користувача
        if path == "/register":
            data = read_body(self)
            name = data.get("name", "").strip()
            username = data.get("username", "").strip().lower()
            password = data.get("password", "")

            if not name or not username or not password:
                send_json(self, 400, {"error": "Заповніть усі поля"})
                return

            if len(password) < 6:
                send_json(self, 400, {"error": "Пароль має бути мінімум 6 символів"})
                return

            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

            try:
                conn = get_connection()
                conn.execute(
                    "INSERT INTO users (name, username, password) VALUES (?, ?, ?)",
                    (name, username, hashed)
                )
                conn.commit()
                conn.close()
                send_json(self, 201, {"message": "Реєстрація успішна!", "username": username, "name": name})
            except Exception:
                send_json(self, 409, {"error": "Цей логін вже зайнятий"})

        # POST /login — авторизація
        elif path == "/login":
            data = read_body(self)
            username = data.get("username", "").strip().lower()
            password = data.get("password", "")

            conn = get_connection()
            user = conn.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()
            conn.close()

            if not user:
                send_json(self, 401, {"error": "Невірний логін або пароль"})
                return

            if not bcrypt.checkpw(password.encode(), user["password"].encode()):
                send_json(self, 401, {"error": "Невірний логін або пароль"})
                return

            send_json(self, 200, {
                "message": "Вхід успішний!",
                "username": user["username"],
                "name": user["name"]
            })

        # POST /transactions — додати нову транзакцію
        elif path == "/transactions":
            username = unquote(self.headers.get("X-Username", ""))
            if not username:
                send_json(self, 401, {"error": "Не авторизовано"})
                return

            data = read_body(self)
            t_type = data.get("type")
            amount = data.get("amount")
            category = data.get("category", "").strip()
            note = data.get("note", "").strip()
            date = data.get("date", "")

            if not t_type or not amount or not category or not date:
                send_json(self, 400, {"error": "Заповніть обов'язкові поля"})
                return

            try:
                amount = float(amount)
                if amount <= 0:
                    raise ValueError
            except (ValueError, TypeError):
                send_json(self, 400, {"error": "Сума має бути позитивним числом"})
                return

            conn = get_connection()
            cursor = conn.execute(
                "INSERT INTO transactions (username, type, amount, category, note, date) VALUES (?, ?, ?, ?, ?, ?)",
                (username, t_type, amount, category, note, date)
            )
            conn.commit()
            new_id = cursor.lastrowid
            conn.close()

            send_json(self, 201, {
                "id": new_id,
                "username": username,
                "type": t_type,
                "amount": amount,
                "category": category,
                "note": note,
                "date": date
            })

        else:
            send_json(self, 404, {"error": "Маршрут не знайдено"})

    # ── DELETE ────────────────────────────────────────────────────────────────
    def do_DELETE(self):
        path = self.path.split("?")[0]

        # DELETE /transactions/<id>
        if path.startswith("/transactions/"):
            username = self.headers.get("X-Username")
            if not username:
                send_json(self, 401, {"error": "Не авторизовано"})
                return

            try:
                t_id = int(path.split("/")[-1])
            except ValueError:
                send_json(self, 400, {"error": "Невірний ID"})
                return

            conn = get_connection()
            # Перевіряємо що транзакція належить цьому користувачу
            row = conn.execute(
                "SELECT id FROM transactions WHERE id = ? AND username = ?",
                (t_id, username)
            ).fetchone()

            if not row:
                conn.close()
                send_json(self, 404, {"error": "Транзакцію не знайдено"})
                return

            conn.execute("DELETE FROM transactions WHERE id = ?", (t_id,))
            conn.commit()
            conn.close()
            send_json(self, 200, {"message": "Транзакцію видалено"})

        else:
            send_json(self, 404, {"error": "Маршрут не знайдено"})


# ─── Запуск сервера ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"\n Сервер запущено на http://localhost:{PORT}")
    print(f" Відкрийте frontend/index.html у браузері\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n Сервер зупинено")
