const SUPABASE_URL = "https://bwfbozwyqujlykgaueez.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZmJvend5cXVqbHlrZ2F1ZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMTIyNTEsImV4cCI6MjA3OTc4ODI1MX0._1RMtM6nZpylq5OkF-81p3TVwueZ37pknHduu7cNRYk";

// Refresh token periodicamente (a cada 50 min)
chrome.alarms.create("refreshToken", { periodInMinutes: 50 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "refreshToken") return;

  const stored = await chrome.storage.local.get(["refresh_token"]);
  if (!stored.refresh_token) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: stored.refresh_token }),
    });

    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      console.log("[ECOM Finance] Token renovado com sucesso");
    }
  } catch (err) {
    console.error("[ECOM Finance] Erro ao renovar token:", err);
  }
});

// Responder a mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["access_token", "empresa_id"], (data) => {
      sendResponse(data);
    });
    return true; // async
  }

  if (message.type === "MARGIN_LOOKUP") {
    (async () => {
      const stored = await chrome.storage.local.get(["access_token", "empresa_id"]);
      if (!stored.access_token || !stored.empresa_id) {
        sendResponse({ error: "Não autenticado ou empresa não selecionada" });
        return;
      }

      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/ml-margin-lookup`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${stored.access_token}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              empresa_id: stored.empresa_id,
              items: message.items,
            }),
          }
        );

        const data = await res.json();
        sendResponse(data);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async
  }
});
