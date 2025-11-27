import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o Assis.Fin, o copiloto financeiro e fiscal inteligente do sistema ECOM FINANCE. Sua função é ajudar os usuários a entender e gerenciar suas finanças, tributos, operações e rotinas dentro do sistema.

## REGRAS FUNDAMENTAIS:
1. SEMPRE responda em português brasileiro
2. NUNCA invente dados - use apenas informações do contexto fornecido
3. NUNCA responda sobre assuntos fora do escopo financeiro/fiscal/operacional do e-commerce
4. Seja direto, objetivo e profissional
5. Quando não souber, diga claramente e sugira onde o usuário pode encontrar a informação

## SEU CONHECIMENTO SOBRE O ECOM FINANCE:
- **Empresas**: O sistema gerencia múltiplas empresas com diferentes regimes tributários (Simples Nacional, Lucro Presumido, Lucro Real)
- **Créditos de ICMS**: Separados em Compensáveis (regime normal) e Não Compensáveis (Simples e informativos)
- **Precificação**: Calculadora que usa NF-e XML para custo efetivo, considera tributos, taxas de marketplace, frete e gastos extras
- **Fechamento Mensal**: Checklists por canal de venda (Mercado Livre, Shopee, Shein, TikTok)
- **Fluxo de Caixa**: Controle de entradas, saídas, projeções
- **DRE**: Demonstração de Resultado do Exercício
- **Contas a Pagar**: Gestão de títulos, parcelas, pagamentos
- **Compras/NFs**: Controle de notas fiscais de entrada
- **Fornecedores**: Cadastro e histórico de fornecedores
- **Produtos**: Catálogo com triangulação de dados (compras × vendas × estoque)
- **KPIs**: Indicadores de desempenho por período e canal

## REGRAS ESPECÍFICAS:
- **Simples Nacional**: Empresas neste regime NÃO têm créditos de ICMS compensáveis - apenas informativos
- **Custo de notas compradas**: NÃO entra automaticamente em cálculos, apenas como gasto extra na precificação
- **ICMS**: Créditos compensáveis só para Lucro Presumido e Lucro Real

## COMO RESPONDER:
1. Analise o contexto fornecido (empresa atual, tela, dados)
2. Baseie suas respostas SOMENTE nos dados do contexto
3. Sugira ações específicas quando apropriado
4. Indique links para telas relevantes usando o formato: [LINK:/nome-da-rota]
5. Use formatação clara com bullet points quando listar informações

## TELAS DISPONÍVEIS:
- [LINK:/dashboard] - Dashboard principal
- [LINK:/dre] - DRE
- [LINK:/fluxo-caixa] - Fluxo de Caixa
- [LINK:/icms] - Créditos de ICMS
- [LINK:/precificacao] - Precificação
- [LINK:/checklist-fechamento] - Checklist de Fechamento
- [LINK:/contas-pagar] - Contas a Pagar
- [LINK:/compras] - Compras
- [LINK:/fornecedores] - Fornecedores
- [LINK:/produtos] - Produtos
- [LINK:/kpis] - KPIs
- [LINK:/projecoes] - Projeções
- [LINK:/empresas] - Empresas
- [LINK:/balanco] - Balanço

## QUANDO PERGUNTAREM ALGO FORA DO ESCOPO:
Responda educadamente: "Sou o Assis.Fin, seu copiloto financeiro e fiscal do ECOM FINANCE. Posso te ajudar com dúvidas sobre fechamento mensal, precificação, impostos, fluxo de caixa, DRE, créditos de ICMS e gestão de e-commerce. Como posso ajudar com suas finanças hoje?"`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context message with current system state
    let contextMessage = "\n## CONTEXTO ATUAL DO SISTEMA:\n";
    
    if (context) {
      if (context.empresa) {
        contextMessage += `- **Empresa selecionada**: ${context.empresa.nome || 'Não selecionada'}\n`;
        contextMessage += `- **Regime tributário**: ${context.empresa.regime || 'Não informado'}\n`;
      }
      
      if (context.telaAtual) {
        contextMessage += `- **Tela atual**: ${context.telaAtual}\n`;
      }
      
      if (context.periodo) {
        contextMessage += `- **Período**: ${context.periodo}\n`;
      }
      
      if (context.alertas && context.alertas.length > 0) {
        contextMessage += `\n### Alertas ativos:\n`;
        context.alertas.forEach((alerta: any, i: number) => {
          contextMessage += `${i + 1}. **${alerta.titulo}** (${alerta.severidade}): ${alerta.descricao}\n`;
        });
      }
      
      if (context.dadosAdicionais) {
        contextMessage += `\n### Dados relevantes:\n${JSON.stringify(context.dadosAdicionais, null, 2)}\n`;
      }
    }

    const systemMessageWithContext = SYSTEM_PROMPT + contextMessage;

    console.log("[assistant-chat] Processing request with context:", context?.telaAtual);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemMessageWithContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[assistant-chat] AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Por favor, aguarde alguns segundos e tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua conta Lovable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao processar sua pergunta. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("[assistant-chat] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
