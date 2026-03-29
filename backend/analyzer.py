from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote
import json
import bcrypt
import psycopg2
import os
from db import get_connection, init_db
from analyzer import analyze

PORT = int(os.environ.get("PORT", 8005))

def cors_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, X-Username")

def send_json(handler, status, data):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)

def read_body(handler):
    length = int(handler.headers.get("Content-Length", 0))
    raw = handler.rfile.read(length)
    return json.loads(raw) if raw else {}

class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"  {self.command} {self.path}")

    def do_OPTIONS(self):
        self.send_response(204)
        cors_headers(self)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/health":
            send_json(self, 200, {"status": "ok", "message": "Сервер працює!"})

        elif path == "/transactions":
            username = unquote(self.headers.get("X-Username", ""))
            if not username:
                send_json(self, 401, {"error": "Не авторизовано"})
                return
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, username, type, amount, category, note, date FROM transactions WHERE username = %s ORDER BY date DESC",
                (username,)
            )
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            result = [
                {"id": r[0], "username": r[1], "type": r[2], "amount": r[3],
                 "category": r[4], "note": r[5], "date": r[6]}
                for r in rows
            ]
            send_json(self, 200, result)

        elif path == "/analyze":
            username = unquote(self.headers.get("X-Username", ""))
            if not username:
                send_json(self, 401, {"error": "Не авторизовано"})
                return
            tips = analyze(username)
            send_json(self, 200, tips)

        else:
            send_json(self, 404, {"error": "Маршрут не знайдено"})

    def do_POST(self):
        path = self.path.split("?")[0]

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
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO users (name, username, password) VALUES (%s, %s, %s)",
                    (name, username, hashed)
                )
                conn.commit()
                cursor.close()
                conn.close()
                send_json(self, 201, {"message": "Реєстрація успішна!", "username": username, "name": name})
            except psycopg2.errors.UniqueViolation:
                send_json(self, 409, {"error": "Цей логін вже зайнятий"})
            except Exception as e:
                send_json(self, 500, {"error": str(e)})

        elif path == "/login":
            data = read_body(self)
            username = data.get("username", "").strip().lower()
            password = data.get("password", "")

            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, username, password FROM users WHERE username = %s",
                (username,)
            )
            user = cursor.fetchone()
            cursor.close()
            conn.close()

            if not user:
                send_json(self, 401, {"error": "Невірний логін або пароль"})
                return
            if not bcrypt.checkpw(password.encode(), user[2].encode()):
                send_json(self, 401, {"error": "Невірний логін або пароль"})
                return

            send_json(self, 200, {
                "message": "Вхід успішний!",
                "username": user[1],
                "name": user[0]
            })

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
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO transactions (username, type, amount, category, note, date) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (username, t_type, amount, category, note, date)
            )
            new_id = cursor.fetchone()[0]
            conn.commit()
            cursor.close()
            conn.close()

            send_json(self, 201, {
                "id": new_id, "username": username, "type": t_type,
                "amount": amount, "category": category, "note": note, "date": date
            })

        else:
            send_json(self, 404, {"error": "Маршрут не знайдено"})

    def do_DELETE(self):
        path = self.path.split("?")[0]

        if path.startswith("/transactions/"):
            username = unquote(self.headers.get("X-Username", ""))
            if not username:
                send_json(self, 401, {"error": "Не авторизовано"})
                return
            try:
                t_id = int(path.split("/")[-1])
            except ValueError:
                send_json(self, 400, {"error": "Невірний ID"})
                return

            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM transactions WHERE id = %s AND username = %s",
                (t_id, username)
            )
            row = cursor.fetchone()
            if not row:
                cursor.close()
                conn.close()
                send_json(self, 404, {"error": "Транзакцію не знайдено"})
                return

            cursor.execute("DELETE FROM transactions WHERE id = %s", (t_id,))
            conn.commit()
            cursor.close()
            conn.close()
            send_json(self, 200, {"message": "Транзакцію видалено"})

        else:
            send_json(self, 404, {"error": "Маршрут не знайдено"})

if __name__ == "__main__":
    init_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"\n Сервер запущено на порту {PORT}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n Сервер зупинено")