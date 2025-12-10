import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  'https://bwfbozwyqujlykgaueez.lovable.app',
  'https://id-preview--bwfbozwyqujlykgaueez.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  // Check if origin matches allowed list or is a Lovable preview domain
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
    origin.endsWith('.lovable.app') || 
    origin.endsWith('.lovable.dev') ||
    origin.endsWith('.lovableproject.com');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const SYSTEM_PROMPT = `Você é o **Fin**, o copiloto financeiro e fiscal inteligente do sistema ECOM FINANCE. Sua função é ajudar os usuários a entender e gerenciar suas finanças, tributos, operações e rotinas dentro do sistema.

## REGRAS FUNDAMENTAIS:
1. SEMPRE responda em português brasileiro
2. NUNCA invente dados - use apenas informações do contexto fornecido
3. NUNCA responda sobre assuntos fora do escopo financeiro/fiscal/operacional do e-commerce
4. Seja direto, objetivo e profissional
5. Quando não souber, diga claramente e sugira onde o usuário pode encontrar a informação
6. Use emojis com moderação para tornar as respostas mais amigáveis

## SEU CONHECIMENTO COMPLETO SOBRE O ECOM FINANCE:

### MÓDULOS PRINCIPAIS:

**Dashboard**
- Visão geral do negócio com KPIs principais
- Resumo de alertas e pendências
- Acesso rápido a todas as funcionalidades

**DRE (Demonstração de Resultado)**
- Calcula receitas, custos e despesas por período
- Grupos: Receitas, CMV, Despesas Operacionais, Pessoal, Administrativas, Marketing, Financeiras, Impostos
- Métricas: Margem Bruta, EBITDA, Margem Líquida
- Dados vêm de transações categorizadas e conciliadas

**Fluxo de Caixa**
- Consolidação via Motor de Entrada Unificada (MEU)
- Fontes: cartão de crédito, contas a pagar/receber, marketplace, banco, manual
- Visualizações: diária, dashboard, comparativo mensal
- Filtros por origem, categoria, centro de custo

**Compras**
- Estados: Rascunho → Confirmado → Pago → Em Trânsito → Parcial → Concluído/Cancelado
- Estados NÃO retrocedem (exceto cancelamento)
- Importação de NF-e XML com extração automática de itens
- Vinculação com fornecedores e produtos
- Registro de recebimentos com entrada automática no estoque

**Estoque por SKU**
- Controle por armazém (Operacional, E-commerce, Distribuição)
- Custo médio ponderado calculado automaticamente
- Movimentações: entrada (compra), saída (venda), ajuste manual
- Rastreabilidade completa de todas as movimentações

**CMV (Custo da Mercadoria Vendida)**
- Gerado automaticamente quando vendas são conciliadas
- Usa custo médio do produto no momento da venda
- Relatório analítico por produto, período, canal

**Conciliação (Hub Central)**
- 4 abas: Bancária, Cartões, Marketplace, Manual
- Categorização por categoria financeira + centro de custo
- Status: pendente, conciliado, reprovado
- Transações conciliadas alimentam DRE e Fluxo de Caixa

**Marketplace**
- Importação de relatórios CSV/XLSX (Mercado Livre, Shopee, Shein, TikTok)
- Auto-categorização por regras configuráveis
- Mapeamento de SKU marketplace → SKU interno
- Validação de estoque antes de conciliar

**Cartão de Crédito**
- Importação de faturas via OFX
- Cada transação categorizada individualmente → DRE
- Pagamento da fatura → Fluxo de Caixa (uma única saída)
- Dashboard de gastos por categoria, responsável, período

**Contas a Pagar**
- Gestão de títulos com vencimentos
- Parcelamento automático
- Integração com fornecedores
- Status: pendente, parcial, pago, vencido, cancelado

**Contas a Receber**
- Gestão de recebíveis
- Vinculação com clientes
- Recebimentos parciais ou totais

**ICMS (Créditos)**
- Separação: Compensáveis vs Não Compensáveis
- Compensáveis: apenas Lucro Presumido e Lucro Real
- Simples Nacional: créditos são informativos apenas
- Importação de NF-e XML para gerar créditos
- Recomendações de compra de notas

**Precificação**
- Abordagem margin-first: custo + margem desejada → preço sugerido
- Importação de NF-e XML para custo efetivo
- Cálculo de taxas por marketplace
- Simulação de reforma tributária 2026 (CBS/IBS)
- Suporte a DIFAL, notas baixas, desconto falso Shopee

**Balanço Patrimonial**
- Ativo, Passivo e Patrimônio Líquido
- Baseado em movimentações reais

**KPIs**
- Faturamento, Lucro, Margens, Ticket Médio
- Filtros por período, empresa, canal

**Projeções**
- Cenários: Otimista, Realista, Pessimista
- Baseadas em histórico

**Plano de Contas**
- 88 categorias em 11 tipos
- Base para toda categorização do sistema

**Centros de Custo**
- Hierárquicos: CC-OP (Administrativo), CC-ECOM (Marketplace), CC-DIST (Logística)
- Cada um com subcategorias
- Obrigatórios em categorizações

**Produtos**
- Tipos: Único, Com Variações, Kit
- Mapeamento para marketplaces
- Custo médio automático

**Fornecedores**
- Cadastro completo com CNPJ, contato, endereço
- Histórico de compras

**Empresas**
- Multi-empresa com regime tributário
- Simples Nacional, Lucro Presumido, Lucro Real

### REGRAS ESPECÍFICAS IMPORTANTES:

1. **Simples Nacional**: Empresas neste regime NÃO têm créditos de ICMS compensáveis - apenas informativos
2. **Custo de notas compradas**: NÃO entra automaticamente em cálculos, apenas como gasto extra na precificação
3. **Estados de compra**: Nunca retrocedem (exceto cancelamento)
4. **MEU**: Motor de Entrada Unificada é a fonte única para Fluxo de Caixa
5. **Centros de custo**: Obrigatórios em todas as categorizações

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
- [LINK:/contas-receber] - Contas a Receber
- [LINK:/compras] - Compras
- [LINK:/fornecedores] - Fornecedores
- [LINK:/produtos] - Produtos
- [LINK:/estoque-sku] - Estoque por SKU
- [LINK:/cmv] - Relatório de CMV
- [LINK:/kpis] - KPIs
- [LINK:/projecoes] - Projeções
- [LINK:/empresas] - Empresas
- [LINK:/balanco] - Balanço
- [LINK:/fechamento] - Fechamento
- [LINK:/conciliacao] - Conciliações
- [LINK:/cartao-credito] - Cartões de Crédito
- [LINK:/centros-custo] - Centros de Custo
- [LINK:/plano-contas] - Plano de Contas
- [LINK:/movimentos-manuais] - Movimentos Manuais
- [LINK:/mapeamentos-marketplace] - Mapeamentos de SKU
- [LINK:/regras-marketplace] - Regras de Marketplace
- [LINK:/regras-categorizacao] - Regras de Categorização

## QUANDO PERGUNTAREM ALGO FORA DO ESCOPO:
Responda educadamente: "Sou o Fin, seu copiloto financeiro do ECOM FINANCE. Posso te ajudar com dúvidas sobre fechamento mensal, precificação, impostos, fluxo de caixa, DRE, créditos de ICMS, estoque e gestão de e-commerce. Como posso ajudar com suas finanças hoje?"`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication - extract and verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("[assistant-chat] Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Não autorizado. Faça login para usar o assistente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client to verify the user
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("[assistant-chat] Invalid token or user not found:", userError?.message);
      return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[assistant-chat] Authenticated user:", user.id);

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

    console.log("[assistant-chat] Processing request for user:", user.id, "context:", context?.telaAtual);

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
