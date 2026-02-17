var SUPABASE_URL = "https://bwfbozwyqujlykgaueez.supabase.co";
var SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZmJvend5cXVqbHlrZ2F1ZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMTIyNTEsImV4cCI6MjA3OTc4ODI1MX0._1RMtM6nZpylq5OkF-81p3TVwueZ37pknHduu7cNRYk";

function $(id) {
  return document.getElementById(id);
}

function checkSession() {
  chrome.storage.local.get(
    ["access_token", "refresh_token", "empresa_id"],
    function (stored) {
      if (!stored.access_token) {
        showLogin();
        return;
      }

      fetch(SUPABASE_URL + "/auth/v1/user", {
        headers: {
          Authorization: "Bearer " + stored.access_token,
          apikey: SUPABASE_ANON_KEY,
        },
      }).then(function (res) {
        if (res.ok) {
          showConnected(stored.empresa_id);
        } else if (stored.refresh_token) {
          refreshAndShow(stored.refresh_token, stored.empresa_id);
        } else {
          showLogin();
        }
      });
    }
  );
}

function refreshAndShow(token, empresaId) {
  fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: token }),
  })
    .then(function (res) {
      if (!res.ok) throw new Error("refresh failed");
      return res.json();
    })
    .then(function (data) {
      chrome.storage.local.set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      showConnected(empresaId);
    })
    .catch(function () {
      showLogin();
    });
}

function showLogin() {
  $("loginSection").classList.remove("hidden");
  $("connectedSection").classList.add("hidden");
  $("statusDot").classList.remove("connected");
  $("statusText").textContent = "Desconectado";
}

function showConnected(empresaId) {
  $("loginSection").classList.add("hidden");
  $("connectedSection").classList.remove("hidden");
  $("statusDot").classList.add("connected");
  $("statusText").textContent = "Conectado";

  chrome.storage.local.get(["access_token"], function (stored) {
    fetch(
      SUPABASE_URL +
        "/rest/v1/user_empresas?select=empresa_id,empresas(id,razao_social,nome_fantasia)",
      {
        headers: {
          Authorization: "Bearer " + stored.access_token,
          apikey: SUPABASE_ANON_KEY,
        },
      }
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var select = $("empresaSelect");
        select.innerHTML = '<option value="">Selecione...</option>';

        if (Array.isArray(data)) {
          data.forEach(function (ue) {
            var emp = ue.empresas;
            if (!emp) return;
            var opt = document.createElement("option");
            opt.value = emp.id;
            opt.textContent = emp.nome_fantasia || emp.razao_social;
            if (emp.id === empresaId) opt.selected = true;
            select.appendChild(opt);
          });
        }
      });
  });
}

// Login
$("loginBtn").addEventListener("click", function () {
  var email = $("email").value.trim();
  var password = $("password").value;

  if (!email || !password) {
    $("loginError").textContent = "Preencha email e senha";
    $("loginError").classList.remove("hidden");
    return;
  }

  $("loginBtn").disabled = true;
  $("loginError").classList.add("hidden");

  fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: email, password: password }),
  })
    .then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error_description || data.msg || "Erro ao fazer login");
        return data;
      });
    })
    .then(function (data) {
      chrome.storage.local.set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      showConnected(null);
    })
    .catch(function (err) {
      $("loginError").textContent = err.message;
      $("loginError").classList.remove("hidden");
    })
    .finally(function () {
      $("loginBtn").disabled = false;
    });
});

// Selecionar empresa
$("empresaSelect").addEventListener("change", function (e) {
  var empresaId = e.target.value;
  chrome.storage.local.set({ empresa_id: empresaId });
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "EMPRESA_CHANGED",
        empresa_id: empresaId,
      });
    }
  });
});

// Logout
$("logoutBtn").addEventListener("click", function () {
  chrome.storage.local.clear();
  showLogin();
});

checkSession();
