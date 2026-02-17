(function () {
  "use strict";

  var BADGE_ATTR = "data-ecom-margin";
  var isProcessing = false;
  var debounceTimer = null;

  // ==========================================
  // UTILIDADES
  // ==========================================

  function parsePreco(texto) {
    if (!texto) return 0;
    var clean = texto
      .replace(/[^\d,.]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    return parseFloat(clean) || 0;
  }

  function formatMoney(val) {
    if (val == null) return "-";
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function detectPage() {
    var url = window.location.href;
    if (url.indexOf("/vendas/") !== -1 && url.indexOf("detalhe") !== -1) {
      return "detalhe";
    }
    if (url.indexOf("/vendas/") !== -1) {
      return "vendas";
    }
    if (url.indexOf("/anuncios/") !== -1 && url.indexOf("promos") !== -1) {
      return "promos";
    }
    return null;
  }

  // ==========================================
  // CRIAR BADGE
  // ==========================================

  function createBadge(margin) {
    var badge = document.createElement("span");
    badge.setAttribute(BADGE_ATTR, "true");

    if (margin.margem === null) {
      badge.className = "ecom-margin-badge ecom-unknown";
      badge.textContent = "Sem custo";
    } else if (margin.margem >= 0) {
      badge.className = "ecom-margin-badge ecom-positive";
      badge.textContent =
        "+" + formatMoney(margin.margem) + " (" + margin.margem_pct.toFixed(1) + "%)";
    } else {
      badge.className = "ecom-margin-badge ecom-negative";
      badge.textContent =
        formatMoney(margin.margem) + " (" + margin.margem_pct.toFixed(1) + "%)";
    }

    // Tooltip
    var tooltip = document.createElement("div");
    tooltip.className = "ecom-margin-tooltip";
    tooltip.innerHTML =
      '<div class="ecom-tooltip-title">Margem de Contribuicao</div>' +
      '<div class="ecom-tooltip-row"><span>Preco Final</span><span>' +
      formatMoney(margin.preco_final) +
      "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Custo Produto</span><span class="ecom-neg-text">-' +
      formatMoney(margin.custo_unitario) +
      "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Comissao ML</span><span class="ecom-neg-text">-' +
      formatMoney(margin.comissao) +
      "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Tarifa Fixa</span><span class="ecom-neg-text">-' +
      formatMoney(margin.tarifa_fixa) +
      "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Frete Vendedor</span><span class="ecom-neg-text">-' +
      formatMoney(margin.frete_vendedor) +
      "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Ads</span><span class="ecom-neg-text">-' +
      formatMoney(margin.ads) +
      "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Outros Descontos</span><span class="ecom-neg-text">-' +
      formatMoney(margin.outros_descontos) +
      "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Impostos</span><span class="ecom-neg-text">-' +
      formatMoney(margin.imposto) +
      "</span></div>" +
      '<div class="ecom-tooltip-divider"></div>' +
      '<div class="ecom-tooltip-row ecom-tooltip-total"><span>Margem</span><span class="' +
      (margin.margem !== null && margin.margem >= 0 ? "ecom-pos-text" : "ecom-neg-text") +
      '">' +
      formatMoney(margin.margem) +
      (margin.margem_pct !== null ? " (" + margin.margem_pct.toFixed(1) + "%)" : "") +
      "</span></div>" +
      '<div class="ecom-tooltip-source">Custo: ' +
      (margin.fonte_custo === "produto"
        ? "Produto cadastrado"
        : margin.fonte_custo === "sku_costs"
        ? "Custo manual SKU"
        : "Nao encontrado") +
      "</div>";

    badge.appendChild(tooltip);
    return badge;
  }

  // ==========================================
  // CRIAR PAINEL DE DETALHE
  // ==========================================

  function createDetailPanel(margin) {
    var panel = document.createElement("div");
    panel.setAttribute(BADGE_ATTR, "true");
    panel.className = "ecom-detail-panel";

    var margemClass =
      margin.margem !== null && margin.margem >= 0 ? "ecom-pos-text" : "ecom-neg-text";

    panel.innerHTML =
      '<div class="ecom-panel-header">' +
      '<span class="ecom-panel-title">Margem de Contribuicao - ECOM Finance</span>' +
      "</div>" +
      '<div class="ecom-panel-body">' +
      '<div class="ecom-panel-row"><span>Preco Final</span><span>' +
      formatMoney(margin.preco_final) +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Quantidade</span><span>' +
      margin.quantidade +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Custo Unitario</span><span>-' +
      formatMoney(margin.custo_unitario) +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Comissao ML</span><span>-' +
      formatMoney(margin.comissao) +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Tarifa Fixa</span><span>-' +
      formatMoney(margin.tarifa_fixa) +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Frete Vendedor</span><span>-' +
      formatMoney(margin.frete_vendedor) +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Ads</span><span>-' +
      formatMoney(margin.ads) +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Outros Descontos</span><span>-' +
      formatMoney(margin.outros_descontos) +
      "</span></div>" +
      '<div class="ecom-panel-row"><span>Impostos</span><span>-' +
      formatMoney(margin.imposto) +
      "</span></div>" +
      '<div class="ecom-panel-divider"></div>' +
      '<div class="ecom-panel-row ecom-panel-total"><span>Margem</span><span class="' +
      margemClass +
      '">' +
      formatMoney(margin.margem) +
      "</span></div>" +
      '<div class="ecom-panel-row ecom-panel-pct"><span>Margem %</span><span class="' +
      margemClass +
      '">' +
      (margin.margem_pct !== null ? margin.margem_pct.toFixed(1) + "%" : "-") +
      "</span></div>" +
      '<div class="ecom-panel-source">Fonte do custo: ' +
      (margin.fonte_custo === "produto"
        ? "Produto cadastrado"
        : margin.fonte_custo === "sku_costs"
        ? "Custo manual SKU"
        : "Nao encontrado") +
      "</div>" +
      "</div>";

    return panel;
  }

  // ==========================================
  // EXTRACAO DO DOM
  // ==========================================

  function extractSalesList() {
    var items = [];
    var cards = document.querySelectorAll(
      "table tbody tr, [class*='order'], [class*='sale'], [class*='andes-card']"
    );

    cards.forEach(function (card) {
      if (card.getAttribute(BADGE_ATTR) === "processed") return;

      var text = card.textContent || "";

      var skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_]+)/i);
      var sku = skuMatch ? skuMatch[1] : null;

      var priceMatch = text.match(/R\$\s*([\d.,]+)/);
      var preco = priceMatch ? parsePreco(priceMatch[0]) : 0;

      var anuncioId = null;
      var links = card.querySelectorAll("a[href]");
      links.forEach(function (link) {
        var m = link.href.match(/MLB[-\s]?(\d+)/i);
        if (m) anuncioId = "MLB" + m[1];
      });

      if (preco > 0) {
        items.push({
          element: card,
          sku: sku,
          anuncio_id: anuncioId,
          preco_final: preco,
        });
      }
    });

    return items;
  }

  function extractSaleDetail() {
    var text = document.body.textContent || "";
    var items = [];

    var skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_]+)/i);
    var sku = skuMatch ? skuMatch[1] : null;

    var preco = 0;
    var priceEls = document.querySelectorAll(
      "[class*='price'], [class*='valor'], [class*='amount']"
    );
    priceEls.forEach(function (el) {
      var p = parsePreco(el.textContent);
      if (p > preco) preco = p;
    });

    if (preco === 0) {
      var m = text.match(/R\$\s*([\d.,]+)/);
      if (m) preco = parsePreco(m[0]);
    }

    var urlMatch = window.location.href.match(/MLB[-\s]?(\d+)/i);
    var anuncioId = urlMatch ? "MLB" + urlMatch[1] : null;

    if (preco > 0) {
      items.push({
        element: null,
        sku: sku,
        anuncio_id: anuncioId,
        preco_final: preco,
        isDetail: true,
      });
    }

    return items;
  }

  function extractPromos() {
    var items = [];
    var rows = document.querySelectorAll(
      "table tbody tr, [class*='promotion'], [class*='item-row'], [class*='andes-list__item']"
    );

    rows.forEach(function (row) {
      if (row.getAttribute(BADGE_ATTR) === "processed") return;

      var text = row.textContent || "";
      var skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_]+)/i);
      var sku = skuMatch ? skuMatch[1] : null;

      var priceMatch = text.match(/R\$\s*([\d.,]+)/);
      var preco = priceMatch ? parsePreco(priceMatch[0]) : 0;

      var anuncioId = null;
      var links = row.querySelectorAll("a[href]");
      links.forEach(function (link) {
        var m = link.href.match(/MLB[-\s]?(\d+)/i);
        if (m) anuncioId = "MLB" + m[1];
      });

      if (preco > 0) {
        items.push({
          element: row,
          sku: sku,
          anuncio_id: anuncioId,
          preco_final: preco,
        });
      }
    });

    return items;
  }

  // ==========================================
  // PROCESSAMENTO PRINCIPAL
  // ==========================================

  function processPage() {
    if (isProcessing) return;

    var page = detectPage();
    if (!page) return;

    isProcessing = true;

    chrome.runtime.sendMessage({ type: "GET_AUTH" }, function (auth) {
      if (!auth || !auth.access_token || !auth.empresa_id) {
        console.log("[ECOM Finance] Nao autenticado ou sem empresa");
        isProcessing = false;
        return;
      }

      var extracted = [];

      if (page === "detalhe") {
        extracted = extractSaleDetail();
      } else if (page === "vendas") {
        extracted = extractSalesList();
      } else if (page === "promos") {
        extracted = extractPromos();
      }

      if (extracted.length === 0) {
        isProcessing = false;
        return;
      }

      var apiItems = extracted.map(function (i) {
        return {
          sku: i.sku,
          anuncio_id: i.anuncio_id,
          preco_final: i.preco_final,
          quantidade: 1,
        };
      });

      chrome.runtime.sendMessage(
        { type: "MARGIN_LOOKUP", items: apiItems },
        function (response) {
          if (!response || response.error) {
            console.warn("[ECOM Finance] Erro:", response ? response.error : "sem resposta");
            isProcessing = false;
            return;
          }

          var results = response.results || [];

          extracted.forEach(function (item, index) {
            var margin = results[index];
            if (!margin) return;

            if (item.isDetail) {
              // Remover painel anterior
              var existing = document.querySelector("[" + BADGE_ATTR + "]");
              if (existing) existing.remove();

              var panel = createDetailPanel(margin);
              var target = document.querySelector(
                "[class*='price-tag'], [class*='summary'], [class*='detail-info'], main, [role='main']"
              );
              if (target) {
                target.parentElement.insertBefore(panel, target);
              } else {
                document.body.prepend(panel);
              }
            } else if (item.element) {
              var existingBadge = item.element.querySelector("[" + BADGE_ATTR + "]");
              if (existingBadge) return;

              item.element.setAttribute(BADGE_ATTR, "processed");
              var badge = createBadge(margin);

              var priceEl = item.element.querySelector(
                "[class*='price'], [class*='valor'], [class*='amount']"
              );
              if (priceEl) {
                priceEl.parentElement.insertBefore(badge, priceEl.nextSibling);
              } else {
                item.element.appendChild(badge);
              }
            }
          });

          isProcessing = false;
        }
      );
    });
  }

  // ==========================================
  // MUTATION OBSERVER (SPA)
  // ==========================================

  function debouncedProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPage, 2000);
  }

  var observer = new MutationObserver(function (mutations) {
    var hasNew = mutations.some(function (m) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        return Array.from(m.addedNodes).some(function (n) {
          return n.nodeType === 1 && !n.getAttribute(BADGE_ATTR);
        });
      }
      return false;
    });

    if (hasNew) debouncedProcess();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Mensagem de mudanca de empresa
  chrome.runtime.onMessage.addListener(function (message) {
    if (message.type === "EMPRESA_CHANGED") {
      document.querySelectorAll("[" + BADGE_ATTR + "]").forEach(function (el) {
        el.remove();
      });
      document
        .querySelectorAll('[' + BADGE_ATTR + '="processed"]')
        .forEach(function (el) {
          el.removeAttribute(BADGE_ATTR);
        });
      setTimeout(processPage, 500);
    }
  });

  // Primeira execucao
  setTimeout(processPage, 2500);
})();
