/**
 * ECOM Finance - Content Script
 * Injeta badges de margem de contribuição nas páginas do Mercado Livre
 */

(function () {
  "use strict";

  const BADGE_ATTR = "data-ecom-margin";
  let isProcessing = false;
  let debounceTimer = null;

  // ====== UTILIDADES ======

  function parsePreco(texto) {
    if (!texto) return 0;
    const clean = texto.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  }

  function formatMoney(val) {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function createBadge(margin) {
    const badge = document.createElement("span");
    badge.setAttribute(BADGE_ATTR, "true");
    const isPositive = margin.margem >= 0;
    badge.className = `ecom-margin-badge ${isPositive ? "ecom-positive" : "ecom-negative"}`;
    badge.textContent = `${isPositive ? "+" : ""}${formatMoney(margin.margem)} (${margin.margem_pct.toFixed(1)}%)`;

    // Tooltip com breakdown
    const tooltip = document.createElement("div");
    tooltip.className = "ecom-margin-tooltip";
    tooltip.innerHTML = `
      <div class="ecom-tooltip-title">Margem de Contribuição</div>
      <div class="ecom-tooltip-row">
        <span>Preço Final</span>
        <span>${formatMoney(margin.preco_final)}</span>
      </div>
      <div class="ecom-tooltip-row">
        <span>Custo Produto</span>
        <span class="ecom-negative-text">-${formatMoney(margin.custo_unitario)}</span>
      </div>
      <div class="ecom-tooltip-row">
        <span>Comissão ML</span>
        <span class="ecom-negative-text">-${formatMoney(margin.comissao)}</span>
      </div>
      <div class="ecom-tooltip-row">
        <span>Tarifa Fixa</span>
        <span class="ecom-negative-text">-${formatMoney(margin.tarifa_fixa)}</span>
      </div>
      <div class="ecom-tooltip-row">
        <span>Frete Vendedor</span>
        <span class="ecom-negative-text">-${formatMoney(margin.frete_vendedor)}</span>
      </div>
      <div class="ecom-tooltip-row">
        <span>Impostos</span>
        <span class="ecom-negative-text">-${formatMoney(margin.imposto)}</span>
      </div>
      <div class="ecom-tooltip-divider"></div>
      <div class="ecom-tooltip-row ecom-tooltip-total">
        <span>Margem</span>
        <span class="${isPositive ? "ecom-positive-text" : "ecom-negative-text"}">${formatMoney(margin.margem)} (${margin.margem_pct.toFixed(1)}%)</span>
      </div>
      <div class="ecom-tooltip-source">Custo: ${margin.fonte_custo === "produto" ? "Produto cadastrado" : margin.fonte_custo === "sku_costs" ? "Custo manual SKU" : "⚠️ Não encontrado"}</div>
    `;
    badge.appendChild(tooltip);

    return badge;
  }

  function createDetailPanel(margin) {
    const panel = document.createElement("div");
    panel.setAttribute(BADGE_ATTR, "true");
    panel.className = "ecom-detail-panel";
    const isPositive = margin.margem >= 0;

    panel.innerHTML = `
      <div class="ecom-panel-header">
        <span class="ecom-panel-icon">💰</span>
        <span class="ecom-panel-title">Margem de Contribuição</span>
      </div>
      <div class="ecom-panel-body">
        <div class="ecom-panel-row">
          <span>Preço Final</span>
          <span>${formatMoney(margin.preco_final)}</span>
        </div>
        <div class="ecom-panel-row">
          <span>Custo Produto</span>
          <span>-${formatMoney(margin.custo_unitario)}</span>
        </div>
        <div class="ecom-panel-row">
          <span>Comissão ML (12%)</span>
          <span>-${formatMoney(margin.comissao)}</span>
        </div>
        <div class="ecom-panel-row">
          <span>Tarifa Fixa</span>
          <span>-${formatMoney(margin.tarifa_fixa)}</span>
        </div>
        <div class="ecom-panel-row">
          <span>Frete Vendedor</span>
          <span>-${formatMoney(margin.frete_vendedor)}</span>
        </div>
        <div class="ecom-panel-row">
          <span>Impostos</span>
          <span>-${formatMoney(margin.imposto)}</span>
        </div>
        <div class="ecom-panel-divider"></div>
        <div class="ecom-panel-row ecom-panel-total">
          <span>Margem</span>
          <span class="${isPositive ? "ecom-positive-text" : "ecom-negative-text"}">${formatMoney(margin.margem)}</span>
        </div>
        <div class="ecom-panel-row ecom-panel-pct">
          <span>Margem %</span>
          <span class="${isPositive ? "ecom-positive-text" : "ecom-negative-text"}">${margin.margem_pct.toFixed(1)}%</span>
        </div>
        <div class="ecom-panel-source">Fonte: ${margin.fonte_custo === "produto" ? "Produto cadastrado" : margin.fonte_custo === "sku_costs" ? "Custo manual" : "⚠️ Sem custo"}</div>
      </div>
    `;

    return panel;
  }

  // ====== EXTRAÇÃO DE DADOS DO DOM ======

  function extractFromSalesList() {
    const items = [];
    // Seletor genérico para cards de vendas no ML
    const saleCards = document.querySelectorAll(
      '[class*="order-card"], [class*="sale-card"], .orders-table tbody tr, [class*="andes-card"]'
    );

    saleCards.forEach((card) => {
      if (card.hasAttribute(BADGE_ATTR)) return;

      const text = card.textContent || "";

      // Extrair SKU
      const skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_]+)/i);
      const sku = skuMatch ? skuMatch[1] : null;

      // Extrair preço
      const priceMatch = text.match(/R\$\s*([\d.,]+)/);
      const preco = priceMatch ? parsePreco(priceMatch[0]) : 0;

      // Extrair anuncio_id (MLB...)
      const links = card.querySelectorAll("a[href]");
      let anuncioId = null;
      links.forEach((link) => {
        const match = link.href.match(/MLB[-\s]?(\d+)/i);
        if (match) anuncioId = `MLB${match[1]}`;
      });

      if (preco > 0) {
        items.push({ element: card, sku, anuncio_id: anuncioId, preco_final: preco });
      }
    });

    return items;
  }

  function extractFromSaleDetail() {
    const text = document.body.textContent || "";
    const items = [];

    // Extrair SKU
    const skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_]+)/i);
    const sku = skuMatch ? skuMatch[1] : null;

    // Extrair preço da venda
    const priceElements = document.querySelectorAll(
      '[class*="price"], [class*="valor"], [class*="amount"]'
    );
    let preco = 0;
    priceElements.forEach((el) => {
      const p = parsePreco(el.textContent);
      if (p > preco) preco = p;
    });

    // Fallback: buscar no texto geral
    if (preco === 0) {
      const priceMatch = text.match(/R\$\s*([\d.,]+)/);
      if (priceMatch) preco = parsePreco(priceMatch[0]);
    }

    // Extrair anuncio_id da URL
    const urlMatch = window.location.href.match(/MLB[-\s]?(\d+)/i);
    const anuncioId = urlMatch ? `MLB${urlMatch[1]}` : null;

    if (preco > 0) {
      items.push({ element: null, sku, anuncio_id: anuncioId, preco_final: preco, isDetail: true });
    }

    return items;
  }

  function extractFromAds() {
    const items = [];
    const rows = document.querySelectorAll(
      '[class*="promotion-row"], [class*="item-row"], table tbody tr, [class*="andes-list__item"]'
    );

    rows.forEach((row) => {
      if (row.hasAttribute(BADGE_ATTR)) return;

      const text = row.textContent || "";
      const skuMatch = text.match(/SKU[:\s]+([A-Za-z0-9\-_]+)/i);
      const sku = skuMatch ? skuMatch[1] : null;

      const priceMatch = text.match(/R\$\s*([\d.,]+)/);
      const preco = priceMatch ? parsePreco(priceMatch[0]) : 0;

      const links = row.querySelectorAll("a[href]");
      let anuncioId = null;
      links.forEach((link) => {
        const match = link.href.match(/MLB[-\s]?(\d+)/i);
        if (match) anuncioId = `MLB${match[1]}`;
      });

      if (preco > 0) {
        items.push({ element: row, sku, anuncio_id: anuncioId, preco_final: preco });
      }
    });

    return items;
  }

  // ====== PROCESSAMENTO PRINCIPAL ======

  async function processPage() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      // Verificar autenticação
      const auth = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_AUTH" }, resolve);
      });

      if (!auth?.access_token || !auth?.empresa_id) {
        console.log("[ECOM Finance] Não autenticado ou sem empresa selecionada");
        isProcessing = false;
        return;
      }

      const url = window.location.href;
      let extractedItems = [];

      if (url.includes("/vendas/") && url.includes("/detalhe")) {
        extractedItems = extractFromSaleDetail();
      } else if (url.includes("/vendas/")) {
        extractedItems = extractFromSalesList();
      } else if (url.includes("/anuncios/")) {
        extractedItems = extractFromAds();
      }

      if (extractedItems.length === 0) {
        isProcessing = false;
        return;
      }

      // Enviar para a edge function via background
      const apiItems = extractedItems.map((i) => ({
        sku: i.sku,
        anuncio_id: i.anuncio_id,
        preco_final: i.preco_final,
        quantidade: 1,
      }));

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "MARGIN_LOOKUP", items: apiItems }, resolve);
      });

      if (response?.error) {
        console.warn("[ECOM Finance] Erro:", response.error);
        isProcessing = false;
        return;
      }

      const results = response?.results || [];

      // Injetar badges
      extractedItems.forEach((item, index) => {
        const margin = results[index];
        if (!margin) return;

        if (item.isDetail) {
          // Página de detalhe: injetar painel
          const existing = document.querySelector(`[${BADGE_ATTR}]`);
          if (existing) existing.remove();

          const panel = createDetailPanel(margin);
          // Tentar inserir perto do preço ou no topo
          const priceSection = document.querySelector(
            '[class*="price-tag"], [class*="summary"], [class*="detail-info"]'
          );
          if (priceSection) {
            priceSection.parentElement.insertBefore(panel, priceSection.nextSibling);
          } else {
            const main = document.querySelector("main, [role='main'], .content");
            if (main) main.prepend(panel);
          }
        } else if (item.element) {
          // Lista: injetar badge
          const existingBadge = item.element.querySelector(`[${BADGE_ATTR}]`);
          if (existingBadge) return;

          item.element.setAttribute(BADGE_ATTR, "processed");
          const badge = createBadge(margin);

          // Inserir após o preço ou no final do card
          const priceEl = item.element.querySelector(
            '[class*="price"], [class*="valor"], [class*="amount"]'
          );
          if (priceEl) {
            priceEl.parentElement.insertBefore(badge, priceEl.nextSibling);
          } else {
            item.element.appendChild(badge);
          }
        }
      });
    } catch (err) {
      console.error("[ECOM Finance] Erro ao processar página:", err);
    }

    isProcessing = false;
  }

  // ====== MUTATION OBSERVER (SPA do ML) ======

  function debouncedProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPage, 1500);
  }

  const observer = new MutationObserver((mutations) => {
    // Verificar se houve mudanças relevantes
    const hasRelevant = mutations.some((m) => {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        return [...m.addedNodes].some(
          (n) => n.nodeType === 1 && !n.hasAttribute?.(BADGE_ATTR)
        );
      }
      return false;
    });

    if (hasRelevant) debouncedProcess();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Mensagem da popup (mudança de empresa)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "EMPRESA_CHANGED") {
      // Remover badges existentes e reprocessar
      document.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove());
      document.querySelectorAll(`[${BADGE_ATTR}="processed"]`).forEach((el) => {
        el.removeAttribute(BADGE_ATTR);
      });
      setTimeout(processPage, 500);
    }
  });

  // Processar ao carregar
  setTimeout(processPage, 2000);
})();
