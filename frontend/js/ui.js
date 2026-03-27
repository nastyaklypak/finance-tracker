// ─── Константи та допоміжні функції ─────────────────────────────────────────

const CATEGORIES = {
  income: [
    "Зарплата", "Фріланс", "Бізнес", "Інвестиції",
    "Подарунок", "Стипендія", "Соціальні виплати", "Інше"
  ],
  expense: [
    "Продукти", "Житло", "Транспорт", "Розваги",
    "Одяг", "Здоров'я", "Освіта", "Ресторани",
    "Комунальні послуги", "Зв'язок", "Техніка", "Інше"
  ]
};

const CATEGORY_ICONS = {
  "Зарплата":           '<i class="fas fa-briefcase"></i>',
  "Фріланс":            '<i class="fas fa-laptop-code"></i>',
  "Бізнес":             '<i class="fas fa-building"></i>',
  "Інвестиції":         '<i class="fas fa-chart-line"></i>',
  "Подарунок":          '<i class="fas fa-gift"></i>',
  "Стипендія":          '<i class="fas fa-graduation-cap"></i>',
  "Соціальні виплати":  '<i class="fas fa-landmark"></i>',
  "Продукти":           '<i class="fas fa-cart-shopping"></i>',
  "Житло":              '<i class="fas fa-house"></i>',
  "Транспорт":          '<i class="fas fa-bus"></i>',
  "Розваги":            '<i class="fas fa-masks-theater"></i>',
  "Одяг":               '<i class="fas fa-shirt"></i>',
  "Здоров'я":           '<i class="fas fa-pills"></i>',
  "Освіта":             '<i class="fas fa-book"></i>',
  "Ресторани":          '<i class="fas fa-utensils"></i>',
  "Комунальні послуги": '<i class="fas fa-bolt"></i>',
  "Зв'язок":            '<i class="fas fa-mobile-screen"></i>',
  "Техніка":            '<i class="fas fa-desktop"></i>',
  "Інше":               '<i class="fas fa-box"></i>'
};

// ─── Форматування суми ────────────────────────────────────────────────────────
function formatAmount(amount) {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount) + " ₴";
}

// ─── Форматування дати ────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Сьогоднішня дата для input[type=date] ───────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ─── Toast-повідомлення ────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Заповнення select категоріями ────────────────────────────────────────────
function fillCategorySelect(selectEl, type) {
  const cats = CATEGORIES[type] || [];
  // В <option> HTML-теги не відображаються — залишаємо тільки текст
  selectEl.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

// ─── Іконка для категорії ─────────────────────────────────────────────────────
function categoryIcon(cat) {
  return CATEGORY_ICONS[cat] || '<i class="fas fa-box"></i>';
}

// ─── Назва місяця ─────────────────────────────────────────────────────────────
function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split("-");
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("uk-UA", { month: "short", year: "numeric" });
}