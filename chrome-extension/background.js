var SUPABASE_URL = "https://bwfbozwyqujlykgaueez.supabase.co";
var SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZmJvend5cXVqbHlrZ2F1ZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMTIyNTEsImV4cCI6MjA3OTc4ODI1MX0._1RMtM6nZpylq5OkF-81p3TVwueZ37pknHduu7cNRYk";

// Refresh token a cada 50 minutos
chrome.alarms.create("refreshToken", { periodInMinutes: 50 });

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name !== "refreshToken") return;

  chrome.storage.local.get(["refresh_token"], function (stored) {
    if (!stored.refresh_token) return;

    fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: stored.refresh_token }),
    })
      .then(function (res) {
        if (!res.ok) return;
        return res.json();
      })
      .then(function (data) {
        if (data && data.access_token) {
          chrome.storage.local.set({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          console.log("[ECOM Finance] Token renovado");
        }
      })
      .catch(function (err) {
        console.error("[ECOM Finance] Erro ao renovar token:", err);
      });
  });
});

// Responder mensagens do content script e popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["access_token", "empresa_id"], function (data) {
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "MARGIN_LOOKUP") {
    chrome.storage.local.get(
      ["access_token", "empresa_id"],
      function (stored) {
        if (!stored.access_token || !stored.empresa_id) {
          sendResponse({
            error: "Nao autenticado ou empresa nao selecionada",
          });
          return;
        }

        fetch(SUPABASE_URL + "/functions/v1/ml-margin-lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + stored.access_token,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            empresa_id: stored.empresa_id,
            items: message.items,
          }),
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            sendResponse(data);
          })
          .catch(function (err) {
            sendResponse({ error: err.message });
          });
      }
    );
    return true;
  }
});
