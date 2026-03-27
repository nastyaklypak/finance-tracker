// ─── Графіки через Chart.js ──────────────────────────────────────────────────

let pieChart = null;
let barChart = null;
let trendChart = null;

const CHART_COLORS = [
  "#4361ee","#2ec4b6","#e63946","#f4a261","#a8dadc",
  "#457b9d","#e9c46a","#264653","#2a9d8f","#e76f51"
];

// ─── Кругова діаграма витрат за категоріями ──────────────────────────────────
function renderPieChart(transactions) {
  const canvas = document.getElementById("chart-pie");
  if (!canvas) return;

  const expenses = transactions.filter(t => t.type === "expense");
  const totals = {};
  expenses.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(totals);
  const values = Object.values(totals);

  if (pieChart) pieChart.destroy();

  if (labels.length === 0) {
    canvas.parentElement.innerHTML = '<p style="text-align:center;color:#8492a6;padding:60px 0">Ще немає витрат</p>';
    return;
  }

  pieChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { family: "Nunito", weight: "700" }, padding: 12 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatAmount(ctx.raw)}`
          }
        }
      }
    }
  });
}

// ─── Стовпчиковий графік доходи/витрати по місяцях ───────────────────────────
function renderBarChart(transactions) {
  const canvas = document.getElementById("chart-bar");
  if (!canvas) return;

  // Збираємо всі місяці
  const monthsMap = {};
  transactions.forEach(t => {
    const month = t.date.slice(0, 7);
    if (!monthsMap[month]) monthsMap[month] = { income: 0, expense: 0 };
    monthsMap[month][t.type] += t.amount;
  });

  const sortedMonths = Object.keys(monthsMap).sort();
  const incomeData = sortedMonths.map(m => monthsMap[m].income);
  const expenseData = sortedMonths.map(m => monthsMap[m].expense);
  const labels = sortedMonths.map(monthLabel);

  if (barChart) barChart.destroy();

  if (sortedMonths.length === 0) {
    canvas.parentElement.innerHTML = '<p style="text-align:center;color:#8492a6;padding:60px 0">Ще немає даних</p>';
    return;
  }

  barChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Доходи",
          data: incomeData,
          backgroundColor: "rgba(46,196,182,0.8)",
          borderRadius: 8
        },
        {
          label: "Витрати",
          data: expenseData,
          backgroundColor: "rgba(230,57,70,0.8)",
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { font: { family: "Nunito", weight: "700" } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatAmount(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "Nunito" } } },
        y: {
          ticks: {
            font: { family: "Nunito" },
            callback: v => v.toLocaleString("uk-UA") + " ₴"
          }
        }
      }
    }
  });
}

// ─── Лінійний графік тренду накопичень ───────────────────────────────────────
function renderTrendChart(transactions) {
  const canvas = document.getElementById("chart-trend");
  if (!canvas) return;

  // Сортуємо всі транзакції по даті
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  // Накопичений баланс
  let running = 0;
  const points = sorted.map(t => {
    running += t.type === "income" ? t.amount : -t.amount;
    return { x: t.date, y: running };
  });

  // Унікальні дати (остання точка на кожну дату)
  const byDate = {};
  points.forEach(p => { byDate[p.x] = p.y; });
  const labels = Object.keys(byDate).sort();
  const values = labels.map(d => byDate[d]);

  if (trendChart) trendChart.destroy();

  if (labels.length === 0) {
    canvas.parentElement.innerHTML = '<p style="text-align:center;color:#8492a6;padding:60px 0">Ще немає даних</p>';
    return;
  }

  trendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: labels.map(formatDate),
      datasets: [{
        label: "Баланс",
        data: values,
        borderColor: "#4361ee",
        backgroundColor: "rgba(67,97,238,0.08)",
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#4361ee",
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { font: { family: "Nunito", weight: "700" } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Баланс: ${formatAmount(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "Nunito" }, maxRotation: 45 } },
        y: {
          ticks: {
            font: { family: "Nunito" },
            callback: v => v.toLocaleString("uk-UA") + " ₴"
          }
        }
      }
    }
  });
}

// ─── Перебудувати всі графіки ─────────────────────────────────────────────────
function renderAllCharts(transactions) {
  renderPieChart(transactions);
  renderBarChart(transactions);
  renderTrendChart(transactions);
}
