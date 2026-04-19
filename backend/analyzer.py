
from db import get_connection
from datetime import date

def analyze(username):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT type, amount, category, date FROM transactions WHERE username = %s",
        (username,)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        return [{"type": "info", "icon": "💡", "text": "Ви ще не додали жодної транзакції!"}]

    total_income  = sum(r[1] for r in rows if r[0] == "income")
    total_expense = sum(r[1] for r in rows if r[0] == "expense")
    savings = total_income - total_expense
    savings_percent = (savings / total_income * 100) if total_income > 0 else 0

    category_totals = {}
    for r in rows:
        if r[0] == "expense":
            category_totals[r[2]] = category_totals.get(r[2], 0) + r[1]

    today = date.today()
    current_month = today.strftime("%Y-%m")
    last_month_date = date(today.year, today.month - 1, 1) if today.month > 1 else date(today.year - 1, 12, 1)
    last_month = last_month_date.strftime("%Y-%m")

    current_expense = sum(r[1] for r in rows if r[0] == "expense" and str(r[3]).startswith(current_month))
    last_expense    = sum(r[1] for r in rows if r[0] == "expense" and str(r[3]).startswith(last_month))

    tips = []

    if total_expense > total_income and total_income > 0:
        tips.append({"type": "danger", "icon": "🚨", "text": f"Увага! Витрати перевищують доходи на {total_expense - total_income:.0f} грн."})
    if total_income == 0:
        tips.append({"type": "warning", "icon": "📥", "text": "Ви ще не додали жодного доходу!"})
    if category_totals and total_expense > 0:
        top_cat = max(category_totals, key=category_totals.get)
        top_pct = category_totals[top_cat] / total_expense * 100
        if top_pct > 50:
            tips.append({"type": "warning", "icon": "📊", "text": f"Найбільше коштів ({top_pct:.0f}%) йде на '{top_cat}'."})
    if total_income > 0 and savings_percent >= 20:
        tips.append({"type": "success", "icon": "🎉", "text": f"Молодець! Ви заощаджуєте {savings_percent:.0f}%. Подумайте про депозит!"})
    elif total_income > 0 and 0 <= savings_percent < 10:
        tips.append({"type": "warning", "icon": "💰", "text": f"Ви заощаджуєте лише {savings_percent:.0f}%. Рекомендуємо відкладати хоча б 10%."})
    if last_expense > 0 and current_expense > 0:
        growth = (current_expense - last_expense) / last_expense * 100
        if growth >= 30:
            tips.append({"type": "danger", "icon": "📈", "text": f"Витрати цього місяця зросли на {growth:.0f}%!"})
    if not tips:
        tips.append({"type": "success", "icon": "✅", "text": "Все виглядає добре! Продовжуйте вести облік."})

    return tips