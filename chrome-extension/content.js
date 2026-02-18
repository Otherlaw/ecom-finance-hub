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
    var clean = String(texto)
      .replace(/[^\d,.]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    return parseFloat(clean) || 0;
  }

  function formatMoney(val) {
    if (val == null || val === undefined) return "-";
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

    var semCusto = margin.margem === null || margin.fonte_custo === "nao_encontrado";

    if (semCusto) {
      badge.className = "ecom-margin-badge ecom-unknown";
      badge.textContent = "Sem custo cadastrado";
    } else if (margin.margem >= 0) {
      badge.className = "ecom-margin-badge ecom-positive";
      badge.textContent =
        "+" + formatMoney(margin.margem) + " (" + margin.margem_pct.toFixed(1) + "%)";
    } else {
      badge.className = "ecom-margin-badge ecom-negative";
      badge.textContent =
        formatMoney(margin.margem) + " (" + margin.margem_pct.toFixed(1) + "%)";
    }

    var rebateRow = margin.rebate && margin.rebate > 0
      ? '<div class="ecom-tooltip-row"><span>Bonus/Rebate</span><span class="ecom-pos-text">+' + formatMoney(margin.rebate) + "</span></div>"
      : "";

    var fonte = margin.fonte_custo === "produto"
      ? "Produto cadastrado"
      : margin.fonte_custo === "sku_costs"
      ? "Custo manual SKU"
      : "Nao encontrado";

    var tarifaLabel = margin.usando_tarifas_reais
      ? "Comissao ML <em>(real)</em>"
      : "Comissao ML <em>(est.)</em>";

    var impostoLabel = margin.usando_imposto_real
      ? "Imposto <em>(real)</em>"
      : "Imposto <em>(est. " + (margin._aliquota || "?") + "%)</em>";

    var custoRow = semCusto
      ? '<div class="ecom-tooltip-row ecom-warn-row"><span>Custo do produto</span><span>Nao cadastrado no Ecom</span></div>'
      : '<div class="ecom-tooltip-row"><span>Custo Produto</span><span class="ecom-neg-text">-' + formatMoney(margin.custo_unitario) + "</span></div>";

    var tooltip = document.createElement("div");
    tooltip.className = "ecom-margin-tooltip";
    tooltip.innerHTML =
      '<div class="ecom-tooltip-title">Margem de Contribuicao</div>' +
      '<div class="ecom-tooltip-row"><span>Preco Final</span><span>' + formatMoney(margin.preco_final) + "</span></div>" +
      custoRow +
      '<div class="ecom-tooltip-row"><span>' + tarifaLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.comissao) + "</span></div>" +
      (margin.tarifa_fixa > 0 ? '<div class="ecom-tooltip-row"><span>Custo Fixo</span><span class="ecom-neg-text">-' + formatMoney(margin.tarifa_fixa) + "</span></div>" : "") +
      (margin.frete_vendedor > 0 ? '<div class="ecom-tooltip-row"><span>Frete Vendedor</span><span class="ecom-neg-text">-' + formatMoney(margin.frete_vendedor) + "</span></div>" : "") +
      (margin.ads > 0 ? '<div class="ecom-tooltip-row"><span>Ads</span><span class="ecom-neg-text">-' + formatMoney(margin.ads) + "</span></div>" : "") +
      (margin.outros_descontos > 0 ? '<div class="ecom-tooltip-row"><span>Outros Descontos</span><span class="ecom-neg-text">-' + formatMoney(margin.outros_descontos) + "</span></div>" : "") +
      '<div class="ecom-tooltip-row"><span>' + impostoLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.imposto) + "</span></div>" +
      rebateRow +
      '<div class="ecom-tooltip-divider"></div>' +
      '<div class="ecom-tooltip-row ecom-tooltip-total"><span>Margem</span><span class="' +
      (!semCusto && margin.margem >= 0 ? "ecom-pos-text" : "ecom-neg-text") + '">' +
      formatMoney(semCusto ? null : margin.margem) +
      (!semCusto && margin.margem_pct !== null ? " (" + margin.margem_pct.toFixed(1) + "%)" : "") +
      "</span></div>" +
      '<div class="ecom-tooltip-source">Custo: ' + fonte + "</div>";

    badge.appendChild(tooltip);

    badge.addEventListener("mouseenter", function () {
      var tooltipEl = badge.querySelector(".ecom-margin-tooltip");
      if (!tooltipEl) return;
      tooltipEl.style.display = "block";
      // reposicionar via fixed para não sair da tela
      var badgeRect = badge.getBoundingClientRect();
      tooltipEl.style.position = "fixed";
      tooltipEl.style.top = (badgeRect.bottom + 4) + "px";
      var left = badgeRect.left;
      var tooltipWidth = 260;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8;
      }
      if (left < 8) left = 8;
      tooltipEl.style.left = left + "px";
      tooltipEl.style.right = "auto";
      tooltipEl.style.transform = "none";
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

    var semCusto = margin.margem === null || margin.fonte_custo === "nao_encontrado";
    var margemClass = !semCusto && margin.margem >= 0 ? "ecom-pos-text" : "ecom-neg-text";

    var tarifaLabel = margin.usando_tarifas_reais
      ? "Comissao ML <span class='ecom-tag-real'>real</span>"
      : "Comissao ML <span class='ecom-tag-est'>est.</span>";

    var impostoLabel = margin.usando_imposto_real
      ? "Imposto <span class='ecom-tag-real'>real</span>"
      : "Imposto <span class='ecom-tag-est'>est.</span>";

    var shippingLabel = margin.shipping_mode
      ? '<div class="ecom-panel-row ecom-panel-tag"><span>Envio</span><span>' + margin.shipping_mode.toUpperCase() + "</span></div>"
      : "";

    var rebateRow = margin.rebate && margin.rebate > 0
      ? '<div class="ecom-panel-row"><span>Bonus/Rebate</span><span class="ecom-pos-text">+' + formatMoney(margin.rebate) + "</span></div>"
      : "";

    var fonte = margin.fonte_custo === "produto"
      ? "Produto cadastrado"
      : margin.fonte_custo === "sku_costs"
      ? "Custo manual SKU"
      : "<span class='ecom-warn-text'>Nao encontrado no Ecom Finance</span>";

    var custoRow = semCusto
      ? '<div class="ecom-panel-row ecom-warn-row"><span>Custo do produto</span><span>Nao cadastrado</span></div>'
      : '<div class="ecom-panel-row"><span>Custo Unitario</span><span class="ecom-neg-text">-' + formatMoney(margin.custo_unitario) + "</span></div>";

    panel.innerHTML =
      '<div class="ecom-panel-header">' +
      '<span class="ecom-panel-title">Margem de Contribuicao &mdash; ECOM Finance</span>' +
      "</div>" +
      '<div class="ecom-panel-body">' +
      shippingLabel +
      '<div class="ecom-panel-row"><span>Preco Final</span><span>' + formatMoney(margin.preco_final) + "</span></div>" +
      '<div class="ecom-panel-row"><span>Quantidade</span><span>' + margin.quantidade + "</span></div>" +
      custoRow +
      '<div class="ecom-panel-row"><span>' + tarifaLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.comissao) + "</span></div>" +
      (margin.tarifa_fixa > 0 ? '<div class="ecom-panel-row"><span>Custo Fixo</span><span class="ecom-neg-text">-' + formatMoney(margin.tarifa_fixa) + "</span></div>" : "") +
      (margin.frete_vendedor > 0 ? '<div class="ecom-panel-row"><span>Frete Vendedor</span><span class="ecom-neg-text">-' + formatMoney(margin.frete_vendedor) + "</span></div>" : "") +
      (margin.ads > 0 ? '<div class="ecom-panel-row"><span>Ads</span><span class="ecom-neg-text">-' + formatMoney(margin.ads) + "</span></div>" : "") +
      (margin.outros_descontos > 0 ? '<div class="ecom-panel-row"><span>Outros Descontos</span><span class="ecom-neg-text">-' + formatMoney(margin.outros_descontos) + "</span></div>" : "") +
      '<div class="ecom-panel-row"><span>' + impostoLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.imposto) + "</span></div>" +
      rebateRow +
      '<div class="ecom-panel-divider"></div>' +
      '<div class="ecom-panel-row ecom-panel-total"><span>Margem</span><span class="' + margemClass + '">' +
      (semCusto ? "Sem custo cadastrado" : formatMoney(margin.margem)) +
      "</span></div>" +
      (!semCusto && margin.margem_pct !== null
        ? '<div class="ecom-panel-row ecom-panel-pct"><span>Margem %</span><span class="' + margemClass + '">' + margin.margem_pct.toFixed(1) + "%</span></div>"
        : "") +
      '<div class="ecom-panel-source">Fonte do custo: ' + fonte + "</div>" +
      "</div>";

    return panel;
  }

  // ==========================================
  // EXTRACAO DO DOM — DETALHE DE VENDA (REAL)
  // ==========================================

  /**
   * Extrai SKU de forma ampla: busca no textContent COMPLETO do body,
   * não só no container de preço.
   */
  function extractSkuGlobal() {
    var text = document.body.textContent || "";

    // Padrão ML: "SKU: ABC123" ou "SKU ABC123" ou "sku: abc-123"
    var patterns = [
      /\bSKU[:\s]+([A-Za-z0-9][A-Za-z0-9\-_.]{1,39})/i,
      /\bC[oó]digo\s+(do\s+)?(produto|anuncio)[:\s]+([A-Za-z0-9][A-Za-z0-9\-_.]{1,39})/i,
    ];

    for (var pi = 0; pi < patterns.length; pi++) {
      var m = text.match(patterns[pi]);
      if (m) {
        // última captura do grupo
        return m[m.length - 1].trim();
      }
    }
    return null;
  }

  /**
   * Tenta extrair tarifas reais do painel de detalhe de venda do ML.
   * Usa múltiplas estratégias para cobrir variações de layout.
   */
  function extractDetalheTarifas() {
    var result = {
      preco_produto: null,
      tarifa_percentual: null,   // comissao percentual em R$ (real)
      tarifa_fixa: null,         // custo fixo em R$
      tarifa_total: null,        // fallback: preco - total_recebido
      total_recebido: null,
      imposto_produto: null,
      shipping_mode: null,       // 'full' | 'flex' | 'flex_turbo' | null
      rebate: null,
    };

    try {
      var bodyHTML = document.body.innerHTML || "";
      var bodyText = document.body.textContent || "";

      // ---- Detectar modo de envio ----
      if (/flex\s+turbo/i.test(bodyText)) {
        result.shipping_mode = "flex_turbo";
      } else if (/envio\s+flex\b/i.test(bodyText) || /\bflex\b.*envio/i.test(bodyText)) {
        result.shipping_mode = "flex";
      } else if (/mercado\s+envios?\s+full/i.test(bodyText) || /\bfull\b/i.test(bodyText)) {
        result.shipping_mode = "full";
      } else if (/\bflex\b/i.test(bodyText)) {
        result.shipping_mode = "flex";
      }

      // ---- Estratégia 1: varredura por elementos com texto financeiro ----
      // Seleciona elementos que provavelmente contêm linhas do resumo financeiro
      var candidateSelectors = [
        "[class*='payment']",
        "[class*='resume']",
        "[class*='summary']",
        "[class*='earning']",
        "[class*='breakdown']",
        "[class*='tarif']",
        "[class*='fee']",
        "[class*='cost']",
        "[class*='fiscal']",
        "[class*='financ']",
        "[class*='imposto']",
        "[class*='total']",
        "li",
        "tr",
        "p",
      ];

      var seen = new Set();
      var allEls = document.querySelectorAll(candidateSelectors.join(","));

      allEls.forEach(function (el) {
        // Ignorar elementos muito grandes (containers pai)
        if (el.textContent.length > 400) return;
        var text = (el.textContent || "").trim();
        if (!text || seen.has(text)) return;
        seen.add(text);

        // Preço do produto / Preço final
        if (
          /pre[cç]o\s+(do\s+)?produto/i.test(text) &&
          result.preco_produto === null
        ) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m) result.preco_produto = parsePreco(m[0]);
        }

        // Tarifa percentual / Tarifa de X% / Comissão
        if (
          /tarifa\s+de\s+\d+\s*%/i.test(text) ||
          /tarifa\s+de\s+venda/i.test(text) ||
          /comiss[aã]o/i.test(text)
        ) {
          // Pode ter vários valores: pegar o último (valor em R$, não o %)
          var vals = text.match(/R\$\s*([\d.,]+)/g);
          if (vals && vals.length > 0 && result.tarifa_percentual === null) {
            var v = parsePreco(vals[vals.length - 1]);
            if (v > 0) result.tarifa_percentual = v;
          }
        }

        // Custo fixo / Tarifa fixa
        if (/custo\s+fixo/i.test(text) || /tarifa\s+fixa/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m && result.tarifa_fixa === null) {
            var v = parsePreco(m[0]);
            if (v > 0) result.tarifa_fixa = v;
          }
        }

        // Total recebido / Valor a receber / Você recebe
        if (/total\s+recebido|valor\s+a\s+receber|voc[eê]\s+recebe|^total$/i.test(text)) {
          var vals = text.match(/R\$\s*([\d.,]+)/g);
          if (vals && vals.length > 0 && result.total_recebido === null) {
            result.total_recebido = parsePreco(vals[vals.length - 1]);
          }
        }

        // Imposto do produto
        if (/imposto\s+(do\s+)?produto/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m && result.imposto_produto === null) {
            result.imposto_produto = parsePreco(m[0]);
          }
        }

        // Rebate / Bônus / Desconto campanha / Cupom ML / Benefício
        if (/rebate|b[oô]nus\s+(por\s+envio|campanha|ml)?|desconto\s+de\s+campanha|benef[ií]cio|cupom/i.test(text)) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m && result.rebate === null) {
            result.rebate = parsePreco(m[0]);
          }
        }
      });

      // ---- Estratégia 2: varredura por texto corrido do body inteiro ----
      // Captura padrões "Chave\nR$ 9,90" que podem estar em nós de texto separados
      if (result.preco_produto === null) {
        var m = bodyText.match(/pre[cç]o\s+do\s+produto[^R]*R\$\s*([\d.,]+)/i);
        if (m) result.preco_produto = parsePreco(m[1]);
      }

      if (result.tarifa_percentual === null) {
        var m = bodyText.match(/tarifa\s+de\s+\d+\s*%[^R]*R\$\s*([\d.,]+)/i);
        if (m) result.tarifa_percentual = parsePreco(m[1]);
      }

      if (result.tarifa_fixa === null) {
        var m = bodyText.match(/custo\s+fixo[^R]*R\$\s*([\d.,]+)/i);
        if (m) result.tarifa_fixa = parsePreco(m[1]);
      }

      if (result.total_recebido === null) {
        var m = bodyText.match(/voc[eê]\s+recebe[^R]*R\$\s*([\d.,]+)/i);
        if (!m) m = bodyText.match(/total\s+recebido[^R]*R\$\s*([\d.,]+)/i);
        if (m) result.total_recebido = parsePreco(m[1]);
      }

      if (result.imposto_produto === null) {
        var m = bodyText.match(/imposto\s+do\s+produto[^R]*R\$\s*([\d.,]+)/i);
        if (m) result.imposto_produto = parsePreco(m[1]);
      }

      if (result.rebate === null) {
        var m = bodyText.match(/b[oô]nus\s+por\s+envio[^R]*R\$\s*([\d.,]+)/i);
        if (!m) m = bodyText.match(/rebate[^R]*R\$\s*([\d.,]+)/i);
        if (m) result.rebate = parsePreco(m[1]);
      }

      // ---- Estratégia 3: fallback de preço pelo maior valor visível ----
      if (result.preco_produto === null) {
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

      // ---- Estratégia 4: calcular tarifa_total como fallback final ----
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
  // EXTRACAO DO DOM — LISTAS
  // ==========================================

  function extractSalesList() {
    var items = [];
    var cards = document.querySelectorAll(
      "table tbody tr, [class*='order'], [class*='sale'], [class*='andes-card']"
    );

    cards.forEach(function (card) {
      if (card.getAttribute(BADGE_ATTR) === "processed") return;

      var text = card.textContent || "";

      var skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_.]+)/i);
      var sku = skuMatch ? skuMatch[1] : null;

      var priceMatch = text.match(/R\$\s*([\d.,]+)/);
      var preco = priceMatch ? parsePreco(priceMatch[0]) : 0;

      var anuncioId = null;
      var links = card.querySelectorAll("a[href]");
      links.forEach(function (link) {
        var m = link.href.match(/MLB[-\s]?(\d+)/i);
        if (m) anuncioId = "MLB" + m[1];
      });

      // Tentar extrair tarifas reais mesmo na lista (se visíveis)
      var tarifas = null;
      var hasTarifaVenda = /tarifa\s+de\s+\d+%|tarifa\s+de\s+venda|custo\s+fixo/i.test(text);
      if (hasTarifaVenda) {
        tarifas = extractDetalheTarifas();
      }

      if (preco > 0) {
        var item = {
          element: card,
          sku: sku,
          anuncio_id: anuncioId,
          preco_final: preco,
        };
        if (tarifas) {
          item.tarifa_percentual = tarifas.tarifa_percentual;
          item.tarifa_fixa = tarifas.tarifa_fixa;
          item.tarifa_total = tarifas.tarifa_total;
          item.imposto_produto = tarifas.imposto_produto;
          item.shipping_mode = tarifas.shipping_mode;
          item.rebate = tarifas.rebate;
        }
        items.push(item);
      }
    });

    return items;
  }

  function extractSaleDetail() {
    var items = [];

    // SKU com busca global no body inteiro
    var sku = extractSkuGlobal();

    // Extrair tarifas reais do DOM
    var tarifas = extractDetalheTarifas();

    // Preço: preferir preco_produto extraído; depois fallback
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
      var m = (document.body.textContent || "").match(/R\$\s*([\d.,]+)/);
      if (m) preco = parsePreco(m[0]);
    }

    // anuncio_id: da URL
    var urlMatch = window.location.href.match(/MLB[-\s]?(\d+)/i);
    var anuncioId = urlMatch ? "MLB" + urlMatch[1] : null;

    if (preco > 0) {
      items.push({
        element: null,
        sku: sku,
        anuncio_id: anuncioId,
        preco_final: preco,
        isDetail: true,
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
      var skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_.]+)/i);
      var sku = skuMatch ? skuMatch[1] : null;

      var priceMatch = text.match(/R\$\s*([\d.,]+)/);
      var preco = priceMatch ? parsePreco(priceMatch[0]) : 0;

      var anuncioId = null;
      var links = row.querySelectorAll("a[href]");
      links.forEach(function (link) {
        var m = link.href.match(/MLB[-\s]?(\d+)/i);
        if (m) anuncioId = "MLB" + m[1];
      });

      // Tarifas reais se visíveis na linha
      var tarifas = null;
      if (/tarifa\s+de\s+\d+%|custo\s+fixo/i.test(text)) {
        tarifas = extractDetalheTarifas();
      }

      if (preco > 0) {
        var item = {
          element: row,
          sku: sku,
          anuncio_id: anuncioId,
          preco_final: preco,
        };
        if (tarifas) {
          item.tarifa_percentual = tarifas.tarifa_percentual;
          item.tarifa_fixa = tarifas.tarifa_fixa;
          item.tarifa_total = tarifas.tarifa_total;
          item.imposto_produto = tarifas.imposto_produto;
          item.shipping_mode = tarifas.shipping_mode;
          item.rebate = tarifas.rebate;
        }
        items.push(item);
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
          sku: i.sku || null,
          anuncio_id: i.anuncio_id || null,
          preco_final: i.preco_final,
          quantidade: 1,
          ads: 0,
        };

        // Campos reais — disponíveis no detalhe (e eventualmente na lista)
        if (i.tarifa_percentual != null) item.comissao = i.tarifa_percentual;
        if (i.tarifa_fixa != null)       item.tarifa_fixa = i.tarifa_fixa;
        if (i.tarifa_total != null)       item.tarifa_total = i.tarifa_total;
        if (i.imposto_produto != null)    item.imposto = i.imposto_produto;
        if (i.shipping_mode != null)      item.shipping_mode = i.shipping_mode;
        if (i.rebate != null && i.rebate > 0) item.rebate = i.rebate;

        return item;
      });

      var FUNCTION_URL =
        "https://bwfbozwyqujlykgaueez.supabase.co/functions/v1/ml-margin-lookup";

      fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + auth.access_token,
        },
        body: JSON.stringify({
          empresa_id: auth.empresa_id,
          items: apiItems,
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.results) {
            isProcessing = false;
            return;
          }

          data.results.forEach(function (margin, idx) {
            var extracted_item = extracted[idx];
            if (!extracted_item) return;

            if (page === "detalhe") {
              // Remover painel anterior
              var existingPanel = document.querySelector(".ecom-detail-panel");
              if (existingPanel) existingPanel.remove();

              var panel = createDetailPanel(margin);

              // Tentar inserir após o painel de preço/resumo
              var target =
                document.querySelector("[class*='shipping-summary']") ||
                document.querySelector("[class*='order-summary']") ||
                document.querySelector("[class*='payment-summary']") ||
                document.querySelector("[class*='resume']") ||
                document.querySelector("main") ||
                document.body;

              target.insertBefore(panel, target.firstChild);

            } else {
              // Lista: badge inline
              var el = extracted_item.element;
              if (!el) return;
              if (el.getAttribute(BADGE_ATTR) === "processed") return;
              el.setAttribute(BADGE_ATTR, "processed");

              var existingBadge = el.querySelector("[" + BADGE_ATTR + "='true']");
              if (existingBadge) existingBadge.remove();

              var badge = createBadge(margin);

              // Inserir próximo ao preço
              var priceEl = el.querySelector(
                "[class*='price'], [class*='valor'], [class*='amount']"
              );
              if (priceEl && priceEl.parentElement) {
                priceEl.parentElement.insertBefore(badge, priceEl.nextSibling);
              } else {
                el.appendChild(badge);
              }
            }
          });

          isProcessing = false;
        })
        .catch(function (err) {
          console.error("[ECOM Finance] Erro ao buscar margem:", err);
          isProcessing = false;
        });
    });
  }

  // ==========================================
  // DEBOUNCE + OBSERVER
  // ==========================================

  function scheduleProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPage, 800);
  }

  var observer = new MutationObserver(function (mutations) {
    var relevant = mutations.some(function (m) {
      return m.addedNodes.length > 0;
    });
    if (relevant) scheduleProcess();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Primeira execução
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleProcess);
  } else {
    scheduleProcess();
  }

  // Reprocessar em navegação SPA (hash/pushState)
  window.addEventListener("popstate", scheduleProcess);
  (function () {
    var orig = history.pushState;
    history.pushState = function () {
      orig.apply(history, arguments);
      scheduleProcess();
    };
  })();
})();
