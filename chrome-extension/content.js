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
    var rebateRow = margin.rebate && margin.rebate > 0
      ? '<div class="ecom-tooltip-row"><span>Rebate/Campanha</span><span class="ecom-pos-text">+' + formatMoney(margin.rebate) + "</span></div>"
      : "";

    var fonte = margin.fonte_custo === "produto"
      ? "Produto cadastrado"
      : margin.fonte_custo === "sku_costs"
      ? "Custo manual SKU"
      : "Nao encontrado";

    var tarifaLabel = margin.usando_tarifas_reais
      ? "Comissao ML (real)"
      : "Comissao ML (est.)";

    var impostoLabel = margin.usando_imposto_real
      ? "Imposto (real)"
      : "Imposto (est.)";

    var tooltip = document.createElement("div");
    tooltip.className = "ecom-margin-tooltip";
    tooltip.innerHTML =
      '<div class="ecom-tooltip-title">Margem de Contribuicao</div>' +
      '<div class="ecom-tooltip-row"><span>Preco Final</span><span>' + formatMoney(margin.preco_final) + "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Custo Produto</span><span class="ecom-neg-text">-' + formatMoney(margin.custo_unitario) + "</span></div>" +
      '<div class="ecom-tooltip-row"><span>' + tarifaLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.comissao) + "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Tarifa Fixa</span><span class="ecom-neg-text">-' + formatMoney(margin.tarifa_fixa) + "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Frete Vendedor</span><span class="ecom-neg-text">-' + formatMoney(margin.frete_vendedor) + "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Ads</span><span class="ecom-neg-text">-' + formatMoney(margin.ads) + "</span></div>" +
      '<div class="ecom-tooltip-row"><span>Outros Descontos</span><span class="ecom-neg-text">-' + formatMoney(margin.outros_descontos) + "</span></div>" +
      '<div class="ecom-tooltip-row"><span>' + impostoLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.imposto) + "</span></div>" +
      rebateRow +
      '<div class="ecom-tooltip-divider"></div>' +
      '<div class="ecom-tooltip-row ecom-tooltip-total"><span>Margem</span><span class="' +
      (margin.margem !== null && margin.margem >= 0 ? "ecom-pos-text" : "ecom-neg-text") + '">' +
      formatMoney(margin.margem) +
      (margin.margem_pct !== null ? " (" + margin.margem_pct.toFixed(1) + "%)" : "") +
      "</span></div>" +
      '<div class="ecom-tooltip-source">Custo: ' + fonte + "</div>";

    badge.appendChild(tooltip);

    // Ajuste de posição do tooltip para não sair da tela
    badge.addEventListener("mouseenter", function () {
      var tooltipEl = badge.querySelector(".ecom-margin-tooltip");
      if (!tooltipEl) return;
      tooltipEl.style.display = "block";
      var rect = tooltipEl.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        tooltipEl.style.left = "auto";
        tooltipEl.style.right = "0";
        tooltipEl.style.transform = "none";
      }
      if (rect.left < 8) {
        tooltipEl.style.left = "0";
        tooltipEl.style.right = "auto";
        tooltipEl.style.transform = "none";
      }
    });
    badge.addEventListener("mouseleave", function () {
      var tooltipEl = badge.querySelector(".ecom-margin-tooltip");
      if (tooltipEl) tooltipEl.style.display = "";
    });

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

    var tarifaLabel = margin.usando_tarifas_reais ? "Comissao ML (real)" : "Comissao ML (est.)";
    var impostoLabel = margin.usando_imposto_real ? "Imposto (real)" : "Imposto (est.)";
    var shippingLabel = margin.shipping_mode
      ? '<div class="ecom-panel-row ecom-panel-tag"><span>Envio</span><span>' + margin.shipping_mode.toUpperCase() + "</span></div>"
      : "";
    var rebateRow = margin.rebate && margin.rebate > 0
      ? '<div class="ecom-panel-row"><span>Rebate/Campanha</span><span class="ecom-pos-text">+' + formatMoney(margin.rebate) + "</span></div>"
      : "";

    var fonte = margin.fonte_custo === "produto"
      ? "Produto cadastrado"
      : margin.fonte_custo === "sku_costs"
      ? "Custo manual SKU"
      : "Nao encontrado";

    panel.innerHTML =
      '<div class="ecom-panel-header">' +
      '<span class="ecom-panel-title">Margem de Contribuicao - ECOM Finance</span>' +
      "</div>" +
      '<div class="ecom-panel-body">' +
      shippingLabel +
      '<div class="ecom-panel-row"><span>Preco Final</span><span>' + formatMoney(margin.preco_final) + "</span></div>" +
      '<div class="ecom-panel-row"><span>Quantidade</span><span>' + margin.quantidade + "</span></div>" +
      '<div class="ecom-panel-row"><span>Custo Unitario</span><span class="ecom-neg-text">-' + formatMoney(margin.custo_unitario) + "</span></div>" +
      '<div class="ecom-panel-row"><span>' + tarifaLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.comissao) + "</span></div>" +
      '<div class="ecom-panel-row"><span>Tarifa Fixa</span><span class="ecom-neg-text">-' + formatMoney(margin.tarifa_fixa) + "</span></div>" +
      '<div class="ecom-panel-row"><span>Frete Vendedor</span><span class="ecom-neg-text">-' + formatMoney(margin.frete_vendedor) + "</span></div>" +
      '<div class="ecom-panel-row"><span>Ads</span><span class="ecom-neg-text">-' + formatMoney(margin.ads) + "</span></div>" +
      '<div class="ecom-panel-row"><span>Outros Descontos</span><span class="ecom-neg-text">-' + formatMoney(margin.outros_descontos) + "</span></div>" +
      '<div class="ecom-panel-row"><span>' + impostoLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.imposto) + "</span></div>" +
      rebateRow +
      '<div class="ecom-panel-divider"></div>' +
      '<div class="ecom-panel-row ecom-panel-total"><span>Margem</span><span class="' + margemClass + '">' + formatMoney(margin.margem) + "</span></div>" +
      '<div class="ecom-panel-row ecom-panel-pct"><span>Margem %</span><span class="' + margemClass + '">' +
      (margin.margem_pct !== null ? margin.margem_pct.toFixed(1) + "%" : "-") +
      "</span></div>" +
      '<div class="ecom-panel-source">Fonte do custo: ' + fonte + "</div>" +
      "</div>";

    return panel;
  }

  // ==========================================
  // EXTRACAO DO DOM — DETALHE DE VENDA (REAL)
  // ==========================================

  /**
   * Tenta extrair tarifas reais do painel direito do detalhe de venda do ML.
   * Retorna objeto com campos opcionais (null se não encontrado).
   */
  function extractDetalheTarifas() {
    var result = {
      preco_produto: null,
      tarifa_percentual: null,  // comissao percentual em R$
      tarifa_fixa: null,        // custo fixo em R$
      tarifa_total: null,       // fallback: preco - total_recebido
      total_recebido: null,
      imposto_produto: null,
      shipping_mode: null,      // 'full' | 'flex' | 'flex_turbo' | null
      rebate: null,
    };

    try {
      var bodyText = document.body.innerHTML || "";

      // ---- Detectar modo de envio ----
      // Mercado Livre exibe "FULL", "Flex" ou "Flex Turbo" na página
      if (/flex\s+turbo/i.test(bodyText)) {
        result.shipping_mode = "flex_turbo";
      } else if (/\bflex\b/i.test(bodyText)) {
        result.shipping_mode = "flex";
      } else if (/\bfull\b/i.test(bodyText)) {
        result.shipping_mode = "full";
      }

      // ---- Estratégia 1: procurar linhas de texto do resumo financeiro ----
      // O ML renderiza linhas como "Preço do produto R$ 99,90" no painel de detalhe.
      // Usamos querySelectorAll sobre spans/divs com texto e regex para extrair.

      var allEls = document.querySelectorAll(
        "[class*='payment'], [class*='resume'], [class*='summary'], [class*='detail'], [class*='breakdown'], [class*='total'], [class*='earning'], [class*='amount'], [class*='price']"
      );

      allEls.forEach(function (el) {
        var text = (el.textContent || "").trim();

        // Preço do produto / Preço final
        if (/pre[cç]o\s+(do\s+)?produto/i.test(text) && result.preco_produto === null) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m) result.preco_produto = parsePreco(m[0]);
        }

        // Tarifa de venda / Tarifa % (comissão percentual)
        if (/tarifa\s+de\s+\d+%/i.test(text) || /tarifa\s+de\s+venda/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/g);
          if (m && m.length > 0) {
            var val = parsePreco(m[m.length - 1]);
            if (val > 0 && result.tarifa_percentual === null) result.tarifa_percentual = val;
          }
        }

        // Custo fixo / Tarifa fixa
        if (/custo\s+fixo/i.test(text) || /tarifa\s+fixa/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m && result.tarifa_fixa === null) result.tarifa_fixa = parsePreco(m[0]);
        }

        // Total recebido / Valor a receber
        if (/total\s+recebido|valor\s+a\s+receber|voc[eê]\s+recebe/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/g);
          if (m && m.length > 0 && result.total_recebido === null) {
            result.total_recebido = parsePreco(m[m.length - 1]);
          }
        }

        // Imposto do produto
        if (/imposto\s+(do\s+)?produto/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m && result.imposto_produto === null) result.imposto_produto = parsePreco(m[0]);
        }

        // Rebate / Desconto de campanha / Cupom ML
        if (/rebate|desconto\s+de\s+campanha|benef[ií]cio/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m && result.rebate === null) result.rebate = parsePreco(m[0]);
        }
      });

      // ---- Estratégia 2: fallback via texto corrido do body ----
      if (result.preco_produto === null) {
        // Tenta pegar o maior preço na área de "Resumo" ou header
        var priceEls = document.querySelectorAll(
          "[class*='price-tag'], [class*='price__fraction'], [class*='main-price'], h2, h3"
        );
        var best = 0;
        priceEls.forEach(function (el) {
          var p = parsePreco(el.textContent);
          if (p > best) best = p;
        });
        if (best > 0) result.preco_produto = best;
      }

      // ---- Estratégia 3: calcular tarifa_total como fallback ----
      if (
        result.tarifa_total === null &&
        result.preco_produto !== null &&
        result.total_recebido !== null &&
        result.preco_produto > result.total_recebido
      ) {
        result.tarifa_total = parseFloat(
          (result.preco_produto - result.total_recebido).toFixed(2)
        );
      }
    } catch (e) {
      console.warn("[ECOM Finance] Erro ao extrair tarifas do detalhe:", e);
    }

    return result;
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
    var items = [];

    var text = document.body.textContent || "";
    var skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_]+)/i);
    var sku = skuMatch ? skuMatch[1] : null;

    // Extrair tarifas reais do DOM
    var tarifas = extractDetalheTarifas();

    // Preço: preferir preco_produto extraído; fallback para maior preço da página
    var preco = tarifas.preco_produto || 0;
    if (preco === 0) {
      var priceEls = document.querySelectorAll(
        "[class*='price'], [class*='valor'], [class*='amount']"
      );
      priceEls.forEach(function (el) {
        var p = parsePreco(el.textContent);
        if (p > preco) preco = p;
      });
    }
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
        // Campos reais extraídos
        tarifa_percentual: tarifas.tarifa_percentual,
        tarifa_fixa: tarifas.tarifa_fixa,
        tarifa_total: tarifas.tarifa_total,
        imposto_produto: tarifas.imposto_produto,
        shipping_mode: tarifas.shipping_mode,
        rebate: tarifas.rebate,
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

      // Montar payload com campos reais quando disponíveis
      var apiItems = extracted.map(function (i) {
        var item = {
          sku: i.sku,
          anuncio_id: i.anuncio_id,
          preco_final: i.preco_final,
          quantidade: 1,
          ads: 0, // ADS ainda não capturado; placeholder para futuro
        };

        // Campos reais do detalhe
        if (i.isDetail) {
          // Comissão percentual (tarifa de X%)
          if (i.tarifa_percentual != null) item.comissao = i.tarifa_percentual;
          // Tarifa fixa (custo fixo)
          if (i.tarifa_fixa != null) item.tarifa_fixa = i.tarifa_fixa;
          // Fallback: tarifa total = comissão + fixa (backend vai separar)
          if (i.tarifa_total != null) item.tarifa_total = i.tarifa_total;
          // Imposto real
          if (i.imposto_produto != null) item.imposto = i.imposto_produto;
          // Modo de envio
          if (i.shipping_mode) item.shipping_mode = i.shipping_mode;
          // Rebate
          if (i.rebate != null && i.rebate > 0) item.rebate = i.rebate;
        }

        return item;
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
              document.querySelectorAll("[" + BADGE_ATTR + "]").forEach(function (el) {
                el.remove();
              });

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
