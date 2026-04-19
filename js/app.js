// ─── Головна логіка застосунку ───────────────────────────────────────────────

let allTransactions = []; // кеш транзакцій

// ─── Навігація між вкладками ─────────────────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add("active");

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add("active");

  // Завантаження даних залежно від вкладки
  if (page === "dashboard") loadDashboard();
  if (page === "transactions") renderTransactionsList(allTransactions);
  if (page === "charts") renderAllCharts(allTransactions);
  if (page === "analysis") loadAnalysis();
}

// ─── Запит до API ─────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const user = getCurrentUser();
  const headers = {
    "Content-Type": "application/json",
    ...(user ? { "X-Username": user.username } : {}),
    ...options.headers
  };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Помилка сервера");
  return data;
}

// ─── Завантаження транзакцій з сервера ───────────────────────────────────────
async function loadTransactions() {
  try {
    allTransactions = await apiFetch("/transactions");
  } catch (e) {
    showToast(e.message, "error");
    allTransactions = [];
  }
}

// ─── Панель приладів (дашборд) ────────────────────────────────────────────────
async function loadDashboard() {
  await loadTransactions();

  const totalIncome = allTransactions
    .filter(t => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  const totalExpense = allTransactions
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const balance = totalIncome - totalExpense;
  const savingsPct = totalIncome > 0
    ? ((balance / totalIncome) * 100).toFixed(0) + "%"
    : "—";

  document.getElementById("stat-balance").textContent = formatAmount(balance);
  document.getElementById("stat-income").textContent = formatAmount(totalIncome);
  document.getElementById("stat-expense").textContent = formatAmount(totalExpense);
  document.getElementById("stat-savings").textContent = savingsPct;

  // Останні 5 транзакцій на дашборді
  const recent = allTransactions.slice(0, 5);
  renderTransactionsInto("recent-transactions", recent, true);
}

// ─── Рендер транзакцій у вказаний контейнер ──────────────────────────────────
function renderTransactionsInto(containerId, transactions, compact = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-receipt"></i></div>
        <h3>Транзакцій поки немає</h3>
        <p>Додайте першу транзакцію, щоб розпочати облік</p>
      </div>`;
    return;
  }

  container.innerHTML = transactions.map(t => `
    <div class="transaction-item">
      <div class="t-icon ${t.type}">${categoryIcon(t.category)}</div>
      <div class="t-info">
        <div class="t-category">${t.category}</div>
        <div class="t-note">${t.note || (t.type === "income" ? "Дохід" : "Витрата")}</div>
        <div class="t-date">${formatDate(t.date)}</div>
      </div>
      <div class="t-amount ${t.type}">
        ${t.type === "income" ? "+" : "−"}${formatAmount(t.amount)}
      </div>
      ${!compact ? `<button class="t-delete" onclick="deleteTransaction(${t.id})" title="Видалити"><i class="fas fa-trash"></i></button>` : ""}
    </div>
  `).join("");
}

// ─── Рендер списку транзакцій з фільтрами ────────────────────────────────────
function renderTransactionsList(transactions) {
  const search = document.getElementById("filter-search")?.value.toLowerCase() || "";
  const type   = document.getElementById("filter-type")?.value || "";
  const month  = document.getElementById("filter-month")?.value || "";

  let filtered = transactions.filter(t => {
    const matchSearch = !search ||
      t.category.toLowerCase().includes(search) ||
      (t.note || "").toLowerCase().includes(search);
    const matchType = !type || t.type === type;
    const matchMonth = !month || t.date.startsWith(month);
    return matchSearch && matchType && matchMonth;
  });

  renderTransactionsInto("transactions-list", filtered);
}

// ─── Видалення транзакції ─────────────────────────────────────────────────────
async function deleteTransaction(id) {
  if (!confirm("Видалити цю транзакцію?")) return;
  try {
    await apiFetch(`/transactions/${id}`, { method: "DELETE" });
    allTransactions = allTransactions.filter(t => t.id !== id);
    showToast("Транзакцію видалено", "success");
    renderTransactionsList(allTransactions);
    updateStats();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ─── Оновити статистику після зміни даних ────────────────────────────────────
function updateStats() {
  const totalIncome  = allTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const savingsPct = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(0) + "%" : "—";

  const b = document.getElementById("stat-balance");
  const i = document.getElementById("stat-income");
  const e = document.getElementById("stat-expense");
  const s = document.getElementById("stat-savings");

  if (b) b.textContent = formatAmount(balance);
  if (i) i.textContent = formatAmount(totalIncome);
  if (e) e.textContent = formatAmount(totalExpense);
  if (s) s.textContent = savingsPct;
}

// ─── Модальне вікно: додати транзакцію ───────────────────────────────────────
let selectedType = "expense";

function openAddModal() {
  document.getElementById("modal-overlay").classList.add("open");
  document.getElementById("tx-date").value = todayISO();
  document.getElementById("tx-amount").value = "";
  document.getElementById("tx-note").value = "";
  selectType("expense");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

function selectType(type) {
  selectedType = type;
  document.querySelectorAll(".type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  fillCategorySelect(document.getElementById("tx-category"), type);
}

async function handleAddTransaction(e) {
  e.preventDefault();
  const amount   = parseFloat(document.getElementById("tx-amount").value);
  const category = document.getElementById("tx-category").value;
  const note     = document.getElementById("tx-note").value.trim();
  const date     = document.getElementById("tx-date").value;

  if (!amount || amount <= 0) {
    showToast("Введіть коректну суму", "error");
    return;
  }

  try {
    const newTx = await apiFetch("/transactions", {
      method: "POST",
      body: JSON.stringify({ type: selectedType, amount, category, note, date })
    });

    allTransactions.unshift(newTx);
    closeModal();
    showToast("Транзакцію додано! ", "success");

    // Оновлюємо активну сторінку
    const activePage = document.querySelector(".page.active")?.id;
    if (activePage === "page-dashboard")     { renderTransactionsInto("recent-transactions", allTransactions.slice(0, 5)); updateStats(); }
    if (activePage === "page-transactions")  { renderTransactionsList(allTransactions); }
    if (activePage === "page-charts")        { renderAllCharts(allTransactions); }

  } catch (e) {
    showToast(e.message, "error");
  }
}

// ─── Аналіз витрат ────────────────────────────────────────────────────────────
async function loadAnalysis() {
  const container = document.getElementById("tips-container");
  container.innerHTML = '<div class="loading">⏳ Аналізуємо ваші фінанси...</div>';

  try {
    const tips = await apiFetch("/analyze");
    container.innerHTML = tips.map(tip => `
      <div class="tip-card ${tip.type}">
        <span class="tip-icon">${tip.icon}</span>
        <span>${tip.text}</span>
      </div>
    `).join("");
  } catch (e) {
    container.innerHTML = `<div class="tip-card danger"><span class="tip-icon">❌</span><span>${e.message}</span></div>`;
  }
}

// ─── Експорт CSV ──────────────────────────────────────────────────────────────
function exportCSV() {
  if (allTransactions.length === 0) {
    showToast("Немає даних для експорту", "error");
    return;
  }

  const header = ["ID", "Тип", "Сума", "Категорія", "Примітка", "Дата"];
  const rows = allTransactions.map(t => [
    t.id,
    t.type === "income" ? "Дохід" : "Витрата",
    t.amount,
    t.category,
    t.note || "",
    t.date
  ]);

  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `фінанси_${todayISO()}.csv`;
  link.click();
  showToast("CSV збережено ", "success");
}

// ─── Експорт PDF ──────────────────────────────────────────────────────────────
// function exportPDF() {
//   if (allTransactions.length === 0) {
//     showToast("Немає даних для експорту", "error");
//     return;
//   }

//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   const user = getCurrentUser();
//   const totalIncome  = allTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
//   const totalExpense = allTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

//   doc.setFontSize(18);
//   doc.text("Фінансовий звіт", 14, 20);
//   doc.setFontSize(11);
//   doc.text(`Користувач: ${user?.name || "—"}`, 14, 30);
//   doc.text(`Дата: ${new Date().toLocaleDateString("uk-UA")}`, 14, 37);
//   doc.text(`Загальні доходи: ${totalIncome.toFixed(2)} грн`, 14, 47);
//   doc.text(`Загальні витрати: ${totalExpense.toFixed(2)} грн`, 14, 54);
//   doc.text(`Баланс: ${(totalIncome - totalExpense).toFixed(2)} грн`, 14, 61);

//   const tableData = allTransactions.map(t => [
//     t.date,
//     t.type === "income" ? "Дохід" : "Витрата",
//     t.category,
//     t.note || "—",
//     t.amount.toFixed(2) + " грн"
//   ]);

//   doc.autoTable({
//     startY: 70,
//     head: [["Дата", "Тип", "Категорія", "Примітка", "Сума"]],
//     body: tableData,
//     styles: { fontSize: 10 },
//     headStyles: { fillColor: [67, 97, 238] }
//   });

//   doc.save(`фінанси_${todayISO()}.pdf`);
//   showToast("PDF збережено ", "success");
// }
async function exportPDF() {
  if (allTransactions.length === 0) {
    showToast("Немає даних для експорту", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const user = getCurrentUser();

  // ── Завантажуємо шрифт з підтримкою кирилиці ──
  const fontUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf";
  const fontResp = await fetch(fontUrl);
  const fontBuffer = await fontResp.arrayBuffer();
  const fontBase64 = btoa(
    new Uint8Array(fontBuffer).reduce((d, b) => d + String.fromCharCode(b), "")
  );
  doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.setFont("Roboto");
  // ───────────────────────────────────────────────

  const totalIncome  = allTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  doc.setFontSize(18);
  doc.text("Фінансовий звіт", 14, 20);
  doc.setFontSize(11);
  doc.text(`Користувач: ${user?.name || "—"}`, 14, 30);
  doc.text(`Дата: ${new Date().toLocaleDateString("uk-UA")}`, 14, 37);
  doc.text(`Загальні доходи: ${totalIncome.toFixed(2)} грн`, 14, 47);
  doc.text(`Загальні витрати: ${totalExpense.toFixed(2)} грн`, 14, 54);
  doc.text(`Баланс: ${(totalIncome - totalExpense).toFixed(2)} грн`, 14, 61);

  const tableData = allTransactions.map(t => [
    t.date,
    t.type === "income" ? "Дохід" : "Витрата",
    t.category,
    t.note || "—",
    t.amount.toFixed(2) + " грн"
  ]);

  doc.autoTable({
    startY: 70,
    head: [["Дата", "Тип", "Категорія", "Примітка", "Сума"]],
    body: tableData,
    styles: { fontSize: 10, font: "Roboto" },
    headStyles: { fillColor: [67, 97, 238], font: "Roboto" }
  });

  doc.save(`фінанси_${todayISO()}.pdf`);
  showToast("PDF збережено ", "success");
}
// ─── Ініціалізація застосунку ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (user) {
    showAppPage();
    navigateTo("dashboard");
  } else {
    showAuthPage("login");
  }

  // Закриття модалки по кліку поза нею
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });
});