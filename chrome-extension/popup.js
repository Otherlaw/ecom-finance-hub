const SUPABASE_URL = "https://bwfbozwyqujlykgaueez.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZmJvend5cXVqbHlrZ2F1ZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMTIyNTEsImV4cCI6MjA3OTc4ODI1MX0._1RMtM6nZpylq5OkF-81p3TVwueZ37pknHduu7cNRYk";

const $ = (id) => document.getElementById(id);

async function supabaseRequest(path, options = {}) {
  const token = (await chrome.storage.local.get("access_token")).access_token;
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  return res.json();
}

async function checkSession() {
  const stored = await chrome.storage.local.get(["access_token", "refresh_token", "empresa_id"]);
  if (!stored.access_token) {
    showLogin();
    return;
  }

  // Verificar se o token ainda é válido
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${stored.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (res.ok) {
    showConnected(stored.empresa_id);
  } else {
    // Tentar refresh
    const refreshed = await refreshToken(stored.refresh_token);
    if (refreshed) {
      showConnected(stored.empresa_id);
    } else {
      showLogin();
    }
  }
}

async function refreshToken(refreshToken) {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    await chrome.storage.local.set({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return true;
  } catch {
    return false;
  }
}

function showLogin() {
  $("loginSection").classList.remove("hidden");
  $("connectedSection").classList.add("hidden");
  $("statusDot").classList.remove("connected");
  $("statusText").textContent = "Desconectado";
}

async function showConnected(empresaId) {
  $("loginSection").classList.add("hidden");
  $("connectedSection").classList.remove("hidden");
  $("statusDot").classList.add("connected");
  $("statusText").textContent = "Conectado";

  // Carregar empresas
  const data = await supabaseRequest(
    "/rest/v1/user_empresas?select=empresa_id,empresas(id,razao_social,nome_fantasia)"
  );

  const select = $("empresaSelect");
  select.innerHTML = '<option value="">Selecione...</option>';

  if (Array.isArray(data)) {
    data.forEach((ue) => {
      const emp = ue.empresas;
      if (!emp) return;
      const opt = document.createElement("option");
      opt.value = emp.id;
      opt.textContent = emp.nome_fantasia || emp.razao_social;
      if (emp.id === empresaId) opt.selected = true;
      select.appendChild(opt);
    });
  }
}

// Login
$("loginBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    $("loginError").textContent = "Preencha email e senha";
    $("loginError").classList.remove("hidden");
    return;
  }

  $("loginBtn").disabled = true;
  $("loginError").classList.add("hidden");

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error_description || data.msg || "Erro ao fazer login");
    }

    await chrome.storage.local.set({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    showConnected(null);
  } catch (err) {
    $("loginError").textContent = err.message;
    $("loginError").classList.remove("hidden");
  } finally {
    $("loginBtn").disabled = false;
  }
});

// Empresa select
$("empresaSelect").addEventListener("change", async (e) => {
  const empresaId = e.target.value;
  await chrome.storage.local.set({ empresa_id: empresaId });
  // Notificar content scripts
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "EMPRESA_CHANGED", empresa_id: empresaId });
    }
  });
});

// Logout
$("logoutBtn").addEventListener("click", async () => {
  await chrome.storage.local.clear();
  showLogin();
});

// Init
checkSession();
