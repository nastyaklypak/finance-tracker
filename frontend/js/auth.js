// ─── Авторизація та управління сесією ───────────────────────────────────────

const API = "http://localhost:8005";

// Отримати поточного користувача з localStorage
function getCurrentUser() {
  const raw = localStorage.getItem("ft_user");
  return raw ? JSON.parse(raw) : null;
}

// Зберегти користувача в localStorage
function setCurrentUser(user) {
  localStorage.setItem("ft_user", JSON.stringify(user));
}

// Видалити сесію (вихід)
function clearUser() {
  localStorage.removeItem("ft_user");
}

// Перевірити чи авторизований користувач
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    showAuthPage();
    return false;
  }
  return true;
}

// ─── Показати сторінки ────────────────────────────────────────────────────────
function showAuthPage(tab = "login") {
  document.getElementById("auth-section").style.display = "flex";
  document.getElementById("app").classList.remove("active");
  switchAuthTab(tab);
}

function showAppPage() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app").classList.add("active");
  const user = getCurrentUser();
  if (user) {
    document.getElementById("sidebar-user-name").textContent = user.name;
    document.getElementById("sidebar-user-login").textContent = "@" + user.username;
    document.getElementById("sidebar-avatar").textContent = user.name.charAt(0).toUpperCase();
  }
}

// ─── Переключення між вкладками авторизації ──────────────────────────────────
function switchAuthTab(tab) {
  document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
}

// ─── Реєстрація ──────────────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Помилка реєстрації", "error");
      return;
    }

    setCurrentUser({ username: data.username, name: data.name });
    showToast("Ласкаво просимо, " + data.name + "! 🎉", "success");
    showAppPage();
    navigateTo("dashboard");
    loadDashboard();
  } catch {
    showToast("Не вдалось з'єднатись з сервером", "error");
  }
}

// ─── Вхід ─────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Помилка входу", "error");
      return;
    }

    setCurrentUser({ username: data.username, name: data.name });
    showToast("З поверненням, " + data.name + "! 👋", "success");
    showAppPage();
    navigateTo("dashboard");
    loadDashboard();
  } catch {
    showToast("Не вдалось з'єднатись з сервером", "error");
  }
}

// ─── Вихід ────────────────────────────────────────────────────────────────────
function handleLogout() {
  clearUser();
  showToast("До побачення! 👋", "info");
  showAuthPage("login");
}
