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
    if (val == null || val === undefined || isNaN(val)) return "-";
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
  // CRIAR BADGE (listas e promos)
  // ==========================================

  function createBadge(margin, isEstimado) {
    var badge = document.createElement("span");
    badge.setAttribute(BADGE_ATTR, "true");

    var semCusto = margin.margem === null || margin.fonte_custo === "nao_encontrado";

    var labelEstimado = isEstimado
      ? ' <span class="ecom-tag-est">est.</span>'
      : ' <span class="ecom-tag-real">real</span>';

    if (semCusto) {
      badge.className = "ecom-margin-badge ecom-unknown";
      badge.innerHTML = "Sem custo (sem mapeamento)" + labelEstimado;
    } else if (margin.margem >= 0) {
      badge.className = "ecom-margin-badge ecom-positive";
      badge.innerHTML =
        "+" + formatMoney(margin.margem) + " (" + margin.margem_pct.toFixed(1) + "%)" + labelEstimado;
    } else {
      badge.className = "ecom-margin-badge ecom-negative";
      badge.innerHTML =
        formatMoney(margin.margem) + " (" + margin.margem_pct.toFixed(1) + "%)" + labelEstimado;
    }

    // Tooltip no hover
    var rebateRow = margin.rebate && margin.rebate > 0
      ? '<div class="ecom-tooltip-row"><span>Bônus/Rebate</span><span class="ecom-pos-text">+' + formatMoney(margin.rebate) + "</span></div>"
      : "";

    var fonte = margin.fonte_custo === "produto"
      ? "Produto cadastrado"
      : margin.fonte_custo === "sku_costs"
      ? "Custo manual SKU"
      : "Não encontrado";

    var tarifaLabel = margin.usando_tarifas_reais
      ? "Comissão ML <em>(real)</em>"
      : "Comissão ML <em>(est.)</em>";

    var impostoLabel = margin.usando_imposto_real
      ? "Imposto <em>(real)</em>"
      : "Imposto <em>(est. " + (margin._aliquota || "?") + "%)</em>";

    var custoRow = semCusto
      ? '<div class="ecom-tooltip-row ecom-warn-row"><span>Custo produto</span><span>Não cadastrado no Ecom</span></div>'
      : '<div class="ecom-tooltip-row"><span>Custo produto</span><span class="ecom-neg-text">-' + formatMoney(margin.custo_unitario) + "</span></div>";

    var tooltip = document.createElement("div");
    tooltip.className = "ecom-margin-tooltip";
    tooltip.innerHTML =
      '<div class="ecom-tooltip-title">Margem — ECOM Finance</div>' +
      '<div class="ecom-tooltip-row"><span>Preço final</span><span>' + formatMoney(margin.preco_final) + "</span></div>" +
      custoRow +
      '<div class="ecom-tooltip-row"><span>' + tarifaLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.comissao) + "</span></div>" +
      (margin.tarifa_fixa > 0 ? '<div class="ecom-tooltip-row"><span>Custo fixo</span><span class="ecom-neg-text">-' + formatMoney(margin.tarifa_fixa) + "</span></div>" : "") +
      (margin.frete_vendedor > 0 ? '<div class="ecom-tooltip-row"><span>Frete vendedor</span><span class="ecom-neg-text">-' + formatMoney(margin.frete_vendedor) + "</span></div>" : "") +
      (margin.ads > 0 ? '<div class="ecom-tooltip-row"><span>Ads</span><span class="ecom-neg-text">-' + formatMoney(margin.ads) + "</span></div>" : "") +
      (margin.outros_descontos > 0 ? '<div class="ecom-tooltip-row"><span>Outros descontos</span><span class="ecom-neg-text">-' + formatMoney(margin.outros_descontos) + "</span></div>" : "") +
      '<div class="ecom-tooltip-row"><span>' + impostoLabel + '</span><span class="ecom-neg-text">-' + formatMoney(margin.imposto) + "</span></div>" +
      rebateRow +
      '<div class="ecom-tooltip-divider"></div>' +
      '<div class="ecom-tooltip-row ecom-tooltip-total"><span>Margem</span><span class="' +
      (!semCusto && margin.margem >= 0 ? "ecom-pos-text" : "ecom-neg-text") + '">' +
      (semCusto ? "Sem custo" : formatMoney(margin.margem) + (margin.margem_pct !== null ? " (" + margin.margem_pct.toFixed(1) + "%)" : "")) +
      "</span></div>" +
      '<div class="ecom-tooltip-source">Custo: ' + fonte + "</div>";

    badge.appendChild(tooltip);

    badge.addEventListener("mouseenter", function () {
      var tooltipEl = badge.querySelector(".ecom-margin-tooltip");
      if (!tooltipEl) return;
      tooltipEl.style.display = "block";
      var badgeRect = badge.getBoundingClientRect();
      tooltipEl.style.position = "fixed";
      tooltipEl.style.top = (badgeRect.bottom + 4) + "px";
      var left = badgeRect.left;
      var tooltipWidth = 280;
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
  // CRIAR BLOCO INLINE DE DETALHE
  // (sem tooltip flutuante — renderizado direto na página)
  // ==========================================

  function createInlineBlock(margin) {
    var wrap = document.createElement("div");
    wrap.setAttribute(BADGE_ATTR, "true");
    wrap.className = "ecom-inline-block";

    var semCusto = margin.margem === null || margin.fonte_custo === "nao_encontrado";
    var margemClass = !semCusto && margin.margem >= 0 ? "ecom-pos-text" : "ecom-neg-text";

    var tarifaLabel = margin.usando_tarifas_reais
      ? "Comissão <span class='ecom-tag-real'>real</span>"
      : "Comissão <span class='ecom-tag-est'>est.</span>";

    var impostoLabel = margin.usando_imposto_real
      ? "Imposto <span class='ecom-tag-real'>real</span>"
      : "Imposto <span class='ecom-tag-est'>est.</span>";

    var shippingRow = margin.shipping_mode
      ? makeRow("Envio", '<span class="ecom-ship-tag">' + margin.shipping_mode.toUpperCase() + "</span>")
      : "";

    var rebateRow = margin.rebate && margin.rebate > 0
      ? makeRow("Bônus/Rebate", '<span class="ecom-pos-text">+' + formatMoney(margin.rebate) + "</span>")
      : "";

    var custoRow = semCusto
      ? '<div class="ecom-ib-row ecom-warn-row"><span>Custo produto</span><span>Não cadastrado</span></div>'
      : makeRow("Custo produto", '<span class="ecom-neg-text">-' + formatMoney(margin.custo_unitario) + "</span>");

    var fonte = margin.fonte_custo === "produto"
      ? "produto cadastrado"
      : margin.fonte_custo === "sku_costs"
      ? "custo manual SKU"
      : '<span class="ecom-warn-text">não encontrado</span>';

    wrap.innerHTML =
      '<div class="ecom-ib-header">' +
        '<span class="ecom-ib-title">Margem de Contribuição &mdash; ECOM Finance</span>' +
      '</div>' +
      '<div class="ecom-ib-body">' +
        shippingRow +
        makeRow("Preço", '<span>' + formatMoney(margin.preco_final) + "</span>") +
        custoRow +
        makeRow(tarifaLabel, '<span class="ecom-neg-text">-' + formatMoney(margin.comissao) + "</span>") +
        (margin.tarifa_fixa > 0
          ? makeRow("Custo fixo", '<span class="ecom-neg-text">-' + formatMoney(margin.tarifa_fixa) + "</span>")
          : "") +
        (margin.frete_vendedor > 0
          ? makeRow("Frete vendedor", '<span class="ecom-neg-text">-' + formatMoney(margin.frete_vendedor) + "</span>")
          : "") +
        (margin.ads > 0
          ? makeRow("Ads", '<span class="ecom-neg-text">-' + formatMoney(margin.ads) + "</span>")
          : "") +
        (margin.outros_descontos > 0
          ? makeRow("Outros descontos", '<span class="ecom-neg-text">-' + formatMoney(margin.outros_descontos) + "</span>")
          : "") +
        makeRow(impostoLabel, '<span class="ecom-neg-text">-' + formatMoney(margin.imposto) + "</span>") +
        rebateRow +
        '<div class="ecom-ib-divider"></div>' +
        '<div class="ecom-ib-row ecom-ib-total">' +
          '<span>Margem</span>' +
          '<span class="' + margemClass + '">' +
            (semCusto ? "Sem custo (sem mapeamento)" : formatMoney(margin.margem)) +
          '</span>' +
        '</div>' +
        (!semCusto && margin.margem_pct !== null
          ? '<div class="ecom-ib-row ecom-ib-pct">' +
              '<span>Margem %</span>' +
              '<span class="' + margemClass + '">' + margin.margem_pct.toFixed(1) + "%</span>" +
            '</div>'
          : "") +
        '<div class="ecom-ib-source">Fonte do custo: ' + fonte + "</div>" +
      "</div>";

    return wrap;
  }

  function makeRow(label, valueHtml) {
    return '<div class="ecom-ib-row"><span>' + label + "</span>" + valueHtml + "</div>";
  }

  // ==========================================
  // EXTRACAO DO DOM — DETALHE DE VENDA (REAL)
  // ==========================================

  function extractSkuGlobal() {
    var text = document.body.textContent || "";
    var patterns = [
      /\bSKU[:\s]+([A-Za-z0-9][A-Za-z0-9\-_.]{1,39})/i,
      /\bC[oó]digo\s+(do\s+)?(produto|anuncio)[:\s]+([A-Za-z0-9][A-Za-z0-9\-_.]{1,39})/i,
    ];
    for (var pi = 0; pi < patterns.length; pi++) {
      var m = text.match(patterns[pi]);
      if (m) return m[m.length - 1].trim();
    }
    return null;
  }

  /**
   * Extrai tarifas reais do DOM da página de detalhe do ML.
   * Retorna: preco_produto, tarifa_percentual, tarifa_fixa, total_recebido,
   *          imposto_produto, shipping_mode, rebate
   */
  function extractDetalheTarifas() {
    var result = {
      preco_produto: null,
      tarifa_percentual: null,
      tarifa_fixa: null,
      tarifa_total: null,
      total_recebido: null,
      imposto_produto: null,
      shipping_mode: null,
      rebate: null,
    };

    try {
      var bodyText = document.body.textContent || "";

      // ---- Detectar modo de envio ----
      if (/flex\s+turbo/i.test(bodyText)) {
        result.shipping_mode = "flex_turbo";
      } else if (/envio\s+flex\b/i.test(bodyText) || /\bflex\b.*envio/i.test(bodyText)) {
        result.shipping_mode = "flex";
      } else if (/mercado\s+envios?\s+full/i.test(bodyText) || /full\b.*envio/i.test(bodyText)) {
        result.shipping_mode = "full";
      } else if (/\bflex\b/i.test(bodyText)) {
        result.shipping_mode = "flex";
      }

      // ---- Estratégia 1: varredura por elementos financeiros ----
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
        if (el.textContent.length > 400) return;
        var text = (el.textContent || "").trim();
        if (!text || seen.has(text)) return;
        seen.add(text);

        // Preço do produto / Preço final
        if (/pre[cç]o\s+(do\s+)?produto/i.test(text) && result.preco_produto === null) {
          var m = text.match(/R\$\s*([\d.,]+)/);
          if (m) result.preco_produto = parsePreco(m[0]);
        }

        // Tarifa percentual / Comissão
        if (
          /tarifa\s+de\s+\d+\s*%/i.test(text) ||
          /tarifa\s+de\s+venda/i.test(text) ||
          /comiss[aã]o/i.test(text)
        ) {
          var vals = text.match(/R\$\s*([\d.,]+)/g);
          if (vals && vals.length > 0 && result.tarifa_percentual === null) {
            var v = parsePreco(vals[vals.length - 1]);
            if (v > 0) result.tarifa_percentual = v;
          }
        }

        // Custo fixo / Tarifa fixa
        if (/custo\s+fixo/i.test(text) || /tarifa\s+fixa/i.test(text)) {
          var m2 = text.match(/R\$\s*([\d.,]+)/);
          if (m2 && result.tarifa_fixa === null) {
            var v2 = parsePreco(m2[0]);
            if (v2 > 0) result.tarifa_fixa = v2;
          }
        }

        // Total recebido / Você recebe
        if (/total\s+recebido|valor\s+a\s+receber|voc[eê]\s+recebe|^total$/i.test(text)) {
          var vals2 = text.match(/R\$\s*([\d.,]+)/g);
          if (vals2 && vals2.length > 0 && result.total_recebido === null) {
            result.total_recebido = parsePreco(vals2[vals2.length - 1]);
          }
        }

        // Imposto do produto
        if (/imposto\s+(do\s+)?produto/i.test(text)) {
          var m3 = text.match(/R\$\s*([\d.,]+)/);
          if (m3 && result.imposto_produto === null) {
            result.imposto_produto = parsePreco(m3[0]);
          }
        }

        // Rebate: bônus por envio, redução na tarifa, descontos e bônus, cupom, benefício
        if (/b[oô]nus\s+(por\s+envio|campanha|ml)?|desconto\s+de\s+campanha|redu[cç][aã]o\s+na\s+tarifa|descontos?\s+e\s+b[oô]nus|benef[ií]cio|cupom|rebate/i.test(text)) {
          var m4 = text.match(/R\$\s*([\d.,]+)/);
          if (m4) {
            var rv = parsePreco(m4[0]);
            if (rv > 0) result.rebate = (result.rebate || 0) + rv;
          }
        }
      });

      // ---- Estratégia 2: regex no texto corrido do body ----
      if (result.preco_produto === null) {
        var m = bodyText.match(/pre[cç]o\s+do\s+produto[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (m) result.preco_produto = parsePreco(m[1]);
      }

      if (result.tarifa_percentual === null) {
        var m = bodyText.match(/tarifa\s+de\s+\d+\s*%[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (m) result.tarifa_percentual = parsePreco(m[1]);
      }

      if (result.tarifa_fixa === null) {
        var m = bodyText.match(/custo\s+fixo[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (m) result.tarifa_fixa = parsePreco(m[1]);
      }

      if (result.total_recebido === null) {
        var m = bodyText.match(/voc[eê]\s+recebe[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (!m) m = bodyText.match(/total\s+recebido[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (m) result.total_recebido = parsePreco(m[1]);
      }

      if (result.imposto_produto === null) {
        var m = bodyText.match(/imposto\s+do\s+produto[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (m) result.imposto_produto = parsePreco(m[1]);
      }

      if (!result.rebate || result.rebate === 0) {
        // Bônus por envio específico
        var m = bodyText.match(/b[oô]nus\s+por\s+envio[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (!m) m = bodyText.match(/redu[cç][aã]o\s+na\s+tarifa[^R]{0,30}R\$\s*([\d.,]+)/i);
        if (m) result.rebate = parsePreco(m[1]);
      }

      // ---- Estratégia 3: fallback preço pelo maior valor visível ----
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

      // ---- Estratégia 4: calcular tarifa_total como fallback ----
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

      // Pegar somente o primeiro preço R$ dentro do card (evita pegar preços errados)
      var priceEl = card.querySelector("[class*='price'], [class*='valor'], [class*='amount'], [class*='fraction']");
      var preco = priceEl ? parsePreco(priceEl.textContent) : 0;
      if (preco === 0) {
        var priceMatch = text.match(/R\$\s*([\d.,]+)/);
        preco = priceMatch ? parsePreco(priceMatch[0]) : 0;
      }

      var anuncioId = null;
      var links = card.querySelectorAll("a[href]");
      links.forEach(function (link) {
        if (!anuncioId) {
          var m = link.href.match(/MLB[-\s]?(\d+)/i);
          if (m) anuncioId = "MLB" + m[1];
        }
      });

      // Tarifas reais só se visíveis no card
      var tarifas = null;
      if (/tarifa\s+de\s+\d+%|tarifa\s+de\s+venda|custo\s+fixo/i.test(text)) {
        tarifas = extractDetalheTarifas();
      }

      if (preco > 0) {
        var item = {
          element: card,
          sku: sku,
          anuncio_id: anuncioId,
          preco_final: preco,
          // chave de associação para resultado
          _key: anuncioId || (sku ? sku + "_" + preco : String(preco)),
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
    var sku = extractSkuGlobal();
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

    // anuncio_id da URL
    var urlMatch = window.location.href.match(/MLB[-\s]?(\d+)/i);
    var anuncioId = urlMatch ? "MLB" + urlMatch[1] : null;

    if (preco === 0) return [];

    return [{
      element: null,
      sku: sku,
      anuncio_id: anuncioId,
      preco_final: preco,
      isDetail: true,
      _key: anuncioId || sku || String(preco),
      tarifa_percentual: tarifas.tarifa_percentual,
      tarifa_fixa: tarifas.tarifa_fixa,
      tarifa_total: tarifas.tarifa_total,
      imposto_produto: tarifas.imposto_produto,
      shipping_mode: tarifas.shipping_mode,
      rebate: tarifas.rebate,
      _tem_tarifas_reais: !!(tarifas.tarifa_percentual || tarifas.tarifa_fixa),
    }];
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

      // Pegar preço mais confiável: preferir elemento de preço dedicado
      var priceEl = row.querySelector("[class*='price'], [class*='valor'], [class*='amount'], [class*='fraction']");
      var preco = priceEl ? parsePreco(priceEl.textContent) : 0;
      if (preco === 0) {
        var priceMatch = text.match(/R\$\s*([\d.,]+)/);
        preco = priceMatch ? parsePreco(priceMatch[0]) : 0;
      }

      var anuncioId = null;
      var links = row.querySelectorAll("a[href]");
      links.forEach(function (link) {
        if (!anuncioId) {
          var m = link.href.match(/MLB[-\s]?(\d+)/i);
          if (m) anuncioId = "MLB" + m[1];
        }
      });

      if (preco > 0) {
        items.push({
          element: row,
          sku: sku,
          anuncio_id: anuncioId,
          preco_final: preco,
          _key: anuncioId || (sku ? sku + "_" + preco : String(preco)),
          // Promos: sem tarifas reais → marcar como estimado
          _tem_tarifas_reais: false,
        });
      }
    });

    return items;
  }

  // ==========================================
  // ASSOCIAR RESULTADO POR CHAVE (não por índice)
  // ==========================================

  /**
   * Constrói um mapa: _key -> resultado da API
   * Preferência: anuncio_id; fallback: sku+preco.
   */
  function buildResultMap(extracted, results) {
    var map = {};
    results.forEach(function (r, idx) {
      var item = extracted[idx];
      if (!item) return;
      var key = item._key || String(idx);
      map[key] = { margin: r, item: item };
    });
    return map;
  }

  // ==========================================
  // RENDERIZAR RESULTADO NO DETALHE
  // (dois pontos: perto do preço + painel lateral)
  // ==========================================

  function renderDetailResult(margin) {
    // Remover blocos anteriores
    document.querySelectorAll("[" + BADGE_ATTR + "='true']").forEach(function (el) {
      el.remove();
    });

    var block1 = createInlineBlock(margin);
    var block2 = createInlineBlock(margin);

    // ---- Ponto A: dentro do card do item (próximo ao preço) ----
    var insertA =
      document.querySelector("[class*='price-tag']") ||
      document.querySelector("[class*='main-price']") ||
      document.querySelector("[class*='price__fraction']") ||
      document.querySelector("[class*='item-price']") ||
      null;

    if (insertA) {
      var parentA = insertA.closest("[class*='card'], [class*='item'], section, article") || insertA.parentElement;
      if (parentA) {
        parentA.insertAdjacentElement("afterend", block1);
      } else {
        insertA.insertAdjacentElement("afterend", block1);
      }
    }

    // ---- Ponto B: painel lateral (Total / resumo de pagamento) ----
    var insertB =
      document.querySelector("[class*='shipping-summary']") ||
      document.querySelector("[class*='order-summary']") ||
      document.querySelector("[class*='payment-summary']") ||
      document.querySelector("[class*='resume']") ||
      document.querySelector("[class*='sidebar']") ||
      document.querySelector("aside") ||
      null;

    if (insertB && insertB !== insertA) {
      insertB.appendChild(block2);
    } else if (!insertA) {
      // Fallback: topo do main
      var main = document.querySelector("main") || document.body;
      main.insertBefore(block1, main.firstChild);
    }
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
        console.log("[ECOM Finance] Não autenticado ou sem empresa selecionada");
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

      // Montar payload — sempre envia campos reais quando disponíveis
      var apiItems = extracted.map(function (i) {
        var item = {
          sku: i.sku || null,
          anuncio_id: i.anuncio_id || null,
          preco_final: i.preco_final,
          quantidade: 1,
          ads: 0,
        };

        if (i.tarifa_percentual != null) item.comissao       = i.tarifa_percentual;
        if (i.tarifa_fixa      != null) item.tarifa_fixa     = i.tarifa_fixa;
        if (i.tarifa_total     != null) item.tarifa_total    = i.tarifa_total;
        if (i.imposto_produto  != null) item.imposto         = i.imposto_produto;
        if (i.shipping_mode    != null) item.shipping_mode   = i.shipping_mode;
        if (i.rebate != null && i.rebate > 0) item.rebate   = i.rebate;

        return item;
      });

      console.log("[ECOM Finance] Enviando", apiItems.length, "item(s) para ml-margin-lookup", apiItems);

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
        .then(function (res) {
          if (!res.ok) {
            return res.text().then(function (txt) {
              console.warn("[ECOM Finance] ml-margin-lookup HTTP " + res.status + ":", txt);
              throw new Error("HTTP " + res.status);
            });
          }
          return res.json();
        })
        .then(function (data) {
          if (!data.results || !Array.isArray(data.results)) {
            console.warn("[ECOM Finance] Resposta sem results:", data);
            isProcessing = false;
            return;
          }

          console.log("[ECOM Finance] Resultados recebidos:", data.results);

          if (page === "detalhe") {
            var margin = data.results[0];
            if (margin) renderDetailResult(margin);
          } else {
            // Associação por chave (_key) em vez de por índice
            var resultMap = buildResultMap(extracted, data.results);

            extracted.forEach(function (extracted_item) {
              var key = extracted_item._key || "";
              var entry = resultMap[key];
              if (!entry) return;

              var margin = entry.margin;
              var el = extracted_item.element;
              if (!el) return;
              if (el.getAttribute(BADGE_ATTR) === "processed") return;
              el.setAttribute(BADGE_ATTR, "processed");

              // Remover badge anterior
              var existingBadge = el.querySelector("[" + BADGE_ATTR + "='true']");
              if (existingBadge) existingBadge.remove();

              // isEstimado = sem tarifas reais (lista/promos)
              var isEstimado = !extracted_item._tem_tarifas_reais || !margin.usando_tarifas_reais;
              var badge = createBadge(margin, isEstimado);

              var priceEl = el.querySelector(
                "[class*='price'], [class*='valor'], [class*='amount'], [class*='fraction']"
              );
              if (priceEl && priceEl.parentElement) {
                priceEl.parentElement.insertBefore(badge, priceEl.nextSibling);
              } else {
                el.appendChild(badge);
              }
            });
          }

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
