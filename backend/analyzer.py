from db import get_connection
from datetime import datetime, date
import calendar


def analyze(username: str) -> list[dict]:
    """
    Аналізує фінансові дані користувача і повертає список порад.
    Використовує прості правила (if/else) — без машинного навчання.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Отримуємо всі транзакції користувача
    cursor.execute(
        "SELECT type, amount, category, date FROM transactions WHERE username = ?",
        (username,)
    )
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return [{"type": "info", "icon": "💡", "text": "Ви ще не додали жодної транзакції. Почніть вести облік вже сьогодні!"}]

    # --- Підрахунок загальних сум ---
    total_income = sum(r["amount"] for r in rows if r["type"] == "income")
    total_expense = sum(r["amount"] for r in rows if r["type"] == "expense")
    savings = total_income - total_expense
    savings_percent = (savings / total_income * 100) if total_income > 0 else 0

    # --- Витрати за категоріями ---
    category_totals = {}
    for r in rows:
        if r["type"] == "expense":
            cat = r["category"]
            category_totals[cat] = category_totals.get(cat, 0) + r["amount"]

    # --- Витрати за місяцями ---
    today = date.today()
    current_month = today.strftime("%Y-%m")
    last_month_date = date(today.year, today.month - 1, 1) if today.month > 1 else date(today.year - 1, 12, 1)
    last_month = last_month_date.strftime("%Y-%m")

    current_month_expense = sum(
        r["amount"] for r in rows
        if r["type"] == "expense" and r["date"].startswith(current_month)
    )
    last_month_expense = sum(
        r["amount"] for r in rows
        if r["type"] == "expense" and r["date"].startswith(last_month)
    )

    tips = []

    # Правило 1: витрати > доходи
    if total_expense > total_income and total_income > 0:
        tips.append({
            "type": "danger",
            "icon": "🚨",
            "text": f"Увага! Ви витрачаєте більше ніж заробляєте. Витрати перевищують доходи на {total_expense - total_income:.0f} грн."
        })

    # Правило 2: немає доходів
    if total_income == 0:
        tips.append({
            "type": "warning",
            "icon": "📥",
            "text": "Ви ще не додали жодного доходу. Додайте перший дохід щоб бачити повну картину!"
        })

    # Правило 3: одна категорія > 50% витрат
    if category_totals and total_expense > 0:
        top_cat = max(category_totals, key=category_totals.get)
        top_percent = category_totals[top_cat] / total_expense * 100
        if top_percent > 50:
            tips.append({
                "type": "warning",
                "icon": "📊",
                "text": f"Найбільше коштів ({top_percent:.0f}%) йде на '{top_cat}'. Спробуйте контролювати цю статтю витрат."
            })

    # Правило 4: заощадження >= 20%
    if total_income > 0 and savings_percent >= 20:
        tips.append({
            "type": "success",
            "icon": "🎉",
            "text": f"Молодець! Ви заощаджуєте {savings_percent:.0f}% від доходу. Подумайте про відкриття депозиту або інвестиції!"
        })

    # Правило 5: заощадження < 10%
    elif total_income > 0 and 0 <= savings_percent < 10:
        tips.append({
            "type": "warning",
            "icon": "💰",
            "text": f"Ви заощаджуєте лише {savings_percent:.0f}%. Рекомендуємо відкладати хоча б 10% доходу щомісяця."
        })

    # Правило 6: витрати різко зросли
    if last_month_expense > 0 and current_month_expense > 0:
        growth = (current_month_expense - last_month_expense) / last_month_expense * 100
        if growth >= 30:
            tips.append({
                "type": "danger",
                "icon": "📈",
                "text": f"Витрати цього місяця зросли на {growth:.0f}% порівняно з минулим! Варто переглянути свої витрати."
            })

    # Якщо все добре
    if not tips:
        tips.append({
            "type": "success",
            "icon": "✅",
            "text": "Все виглядає добре! Продовжуйте вести облік і ваші фінанси будуть під контролем."
        })

    return tips
