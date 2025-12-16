import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  'https://bwfbozwyqujlykgaueez.lovable.app',
  'https://id-preview--bwfbozwyqujlykgaueez.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
    origin.endsWith('.lovable.app') || 
    origin.endsWith('.lovable.dev') ||
    origin.endsWith('.lovableproject.com');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ============ TOOLS DEFINITION ============
const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_faturamento",
      description: "Busca o faturamento (vendas/receitas) de um período. Use para perguntas sobre quanto vendeu, faturamento, receita.",
      parameters: {
        type: "object",
        properties: {
          data_inicio: { type: "string", description: "Data início no formato YYYY-MM-DD" },
          data_fim: { type: "string", description: "Data fim no formato YYYY-MM-DD" },
          canal: { type: "string", description: "Canal opcional: mercado_livre, shopee, shein, tiktok" },
        },
        required: ["data_inicio", "data_fim"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_contas_pagar",
      description: "Busca contas a pagar. Use para perguntas sobre despesas, contas vencidas, a vencer, pagamentos pendentes.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["em_aberto", "vencido", "pago", "todos"], description: "Filtrar por status" },
          data_inicio: { type: "string", description: "Data início vencimento (YYYY-MM-DD)" },
          data_fim: { type: "string", description: "Data fim vencimento (YYYY-MM-DD)" },
        },
        required: ["status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_contas_receber",
      description: "Busca contas a receber. Use para perguntas sobre recebíveis, valores a receber, clientes devedores.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pendente", "recebido", "vencido", "todos"], description: "Filtrar por status" },
          data_inicio: { type: "string", description: "Data início vencimento (YYYY-MM-DD)" },
          data_fim: { type: "string", description: "Data fim vencimento (YYYY-MM-DD)" },
        },
        required: ["status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_fluxo_caixa",
      description: "Busca movimentações do fluxo de caixa. Use para perguntas sobre entradas, saídas, saldo, movimentações.",
      parameters: {
        type: "object",
        properties: {
          data_inicio: { type: "string", description: "Data início (YYYY-MM-DD)" },
          data_fim: { type: "string", description: "Data fim (YYYY-MM-DD)" },
          tipo: { type: "string", enum: ["entrada", "saida", "todos"], description: "Tipo de movimento" },
          origem: { type: "string", enum: ["cartao", "banco", "marketplace", "contas_pagar", "contas_receber", "manual", "todos"] },
        },
        required: ["data_inicio", "data_fim"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_dre_resumo",
      description: "Busca resumo do DRE (receitas, custos, despesas, lucro). Use para perguntas sobre lucro, prejuízo, margem, resultado do mês.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "integer", description: "Mês (1-12)" },
          ano: { type: "integer", description: "Ano (ex: 2025)" },
        },
        required: ["mes", "ano"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_estoque",
      description: "Busca informações de estoque. Use para perguntas sobre produtos em estoque, estoque baixo, quantidade disponível.",
      parameters: {
        type: "object",
        properties: {
          produto_nome: { type: "string", description: "Nome ou SKU do produto (opcional, se vazio retorna resumo geral)" },
          apenas_baixo: { type: "boolean", description: "Se true, retorna apenas produtos com estoque baixo" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_kpis",
      description: "Busca KPIs consolidados (faturamento, margem, ticket médio, pedidos). Use para visão geral de performance.",
      parameters: {
        type: "object",
        properties: {
          periodo: { type: "string", enum: ["hoje", "7dias", "30dias", "mes_atual", "mes_anterior"], description: "Período de análise" },
        },
        required: ["periodo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_pendencias",
      description: "Busca pendências de conciliação e categorização. Use para perguntas sobre transações não categorizadas, pendências.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["banco", "cartao", "marketplace", "todos"], description: "Tipo de transação" },
        },
        required: ["tipo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_compras",
      description: "Busca informações de compras/pedidos de fornecedores. Use para perguntas sobre compras, notas fiscais de entrada.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["rascunho", "emitido", "em_transito", "parcial", "concluido", "cancelado", "todos"] },
          data_inicio: { type: "string", description: "Data início (YYYY-MM-DD)" },
          data_fim: { type: "string", description: "Data fim (YYYY-MM-DD)" },
        },
        required: ["status"],
      },
    },
  },
];

// ============ TOOL EXECUTION ============
async function executarFerramenta(
  supabase: SupabaseClient,
  empresaId: string,
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  console.log(`[assistant-chat] Executing tool: ${toolName} with args:`, args);
  
  try {
    switch (toolName) {
      case "buscar_faturamento": {
        let query = supabase
          .from("marketplace_transactions")
          .select("valor_liquido, valor_bruto, canal, data_transacao, tarifas, taxas")
          .eq("empresa_id", empresaId)
          .eq("tipo_lancamento", "credito")
          .gte("data_transacao", args.data_inicio)
          .lte("data_transacao", args.data_fim);
        
        if (args.canal) {
          query = query.ilike("canal", `%${args.canal}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        const totalBruto = data?.reduce((sum, t) => sum + Number(t.valor_bruto || 0), 0) || 0;
        const totalLiquido = data?.reduce((sum, t) => sum + Number(t.valor_liquido || 0), 0) || 0;
        const totalTarifas = data?.reduce((sum, t) => sum + Number(t.tarifas || 0) + Number(t.taxas || 0), 0) || 0;
        
        // Agrupar por canal
        const porCanal: Record<string, { bruto: number; liquido: number; quantidade: number }> = {};
        data?.forEach(t => {
          const canal = t.canal || 'Outros';
          if (!porCanal[canal]) porCanal[canal] = { bruto: 0, liquido: 0, quantidade: 0 };
          porCanal[canal].bruto += Number(t.valor_bruto || 0);
          porCanal[canal].liquido += Number(t.valor_liquido || 0);
          porCanal[canal].quantidade += 1;
        });
        
        return JSON.stringify({
          periodo: { inicio: args.data_inicio, fim: args.data_fim },
          faturamento_bruto: totalBruto,
          faturamento_liquido: totalLiquido,
          total_tarifas: totalTarifas,
          quantidade_vendas: data?.length || 0,
          por_canal: porCanal,
        });
      }
      
      case "buscar_contas_pagar": {
        let query = supabase
          .from("contas_a_pagar")
          .select("id, fornecedor_nome, descricao, valor_total, valor_pago, valor_em_aberto, data_vencimento, status")
          .eq("empresa_id", empresaId)
          .order("data_vencimento", { ascending: true });
        
        if (args.status !== "todos") {
          query = query.eq("status", args.status);
        }
        if (args.data_inicio) {
          query = query.gte("data_vencimento", args.data_inicio);
        }
        if (args.data_fim) {
          query = query.lte("data_vencimento", args.data_fim);
        }
        
        const { data, error } = await query.limit(50);
        if (error) throw error;
        
        const totalEmAberto = data?.reduce((sum, c) => sum + Number(c.valor_em_aberto || 0), 0) || 0;
        const totalPago = data?.reduce((sum, c) => sum + Number(c.valor_pago || 0), 0) || 0;
        const vencidas = data?.filter(c => c.status === 'vencido') || [];
        
        return JSON.stringify({
          quantidade: data?.length || 0,
          total_em_aberto: totalEmAberto,
          total_pago: totalPago,
          quantidade_vencidas: vencidas.length,
          total_vencido: vencidas.reduce((sum, c) => sum + Number(c.valor_em_aberto || 0), 0),
          proximas_contas: data?.slice(0, 10).map(c => ({
            fornecedor: c.fornecedor_nome,
            descricao: c.descricao,
            valor: c.valor_em_aberto,
            vencimento: c.data_vencimento,
            status: c.status,
          })),
        });
      }
      
      case "buscar_contas_receber": {
        let query = supabase
          .from("contas_a_receber")
          .select("id, cliente_nome, descricao, valor_total, valor_recebido, valor_em_aberto, data_vencimento, status")
          .eq("empresa_id", empresaId)
          .order("data_vencimento", { ascending: true });
        
        if (args.status !== "todos") {
          if (args.status === "vencido") {
            query = query.lt("data_vencimento", new Date().toISOString().split('T')[0]).neq("status", "recebido");
          } else {
            query = query.eq("status", args.status);
          }
        }
        if (args.data_inicio) {
          query = query.gte("data_vencimento", args.data_inicio);
        }
        if (args.data_fim) {
          query = query.lte("data_vencimento", args.data_fim);
        }
        
        const { data, error } = await query.limit(50);
        if (error) throw error;
        
        const totalEmAberto = data?.reduce((sum, c) => sum + Number(c.valor_em_aberto || 0), 0) || 0;
        const totalRecebido = data?.reduce((sum, c) => sum + Number(c.valor_recebido || 0), 0) || 0;
        
        return JSON.stringify({
          quantidade: data?.length || 0,
          total_em_aberto: totalEmAberto,
          total_recebido: totalRecebido,
          proximos_recebimentos: data?.slice(0, 10).map(c => ({
            cliente: c.cliente_nome,
            descricao: c.descricao,
            valor: c.valor_em_aberto,
            vencimento: c.data_vencimento,
            status: c.status,
          })),
        });
      }
      
      case "buscar_fluxo_caixa": {
        let query = supabase
          .from("movimentos_financeiros")
          .select("id, data, tipo, origem, descricao, valor, categoria_nome, centro_custo_nome")
          .eq("empresa_id", empresaId)
          .gte("data", args.data_inicio)
          .lte("data", args.data_fim)
          .order("data", { ascending: false });
        
        if (args.tipo && args.tipo !== "todos") {
          query = query.eq("tipo", args.tipo);
        }
        if (args.origem && args.origem !== "todos") {
          query = query.eq("origem", args.origem);
        }
        
        const { data, error } = await query.limit(100);
        if (error) throw error;
        
        const entradas = data?.filter(m => m.tipo === 'entrada') || [];
        const saidas = data?.filter(m => m.tipo === 'saida') || [];
        
        const totalEntradas = entradas.reduce((sum, m) => sum + Number(m.valor || 0), 0);
        const totalSaidas = saidas.reduce((sum, m) => sum + Number(m.valor || 0), 0);
        
        // Agrupar por origem
        const porOrigem: Record<string, { entradas: number; saidas: number }> = {};
        data?.forEach(m => {
          const origem = m.origem || 'outros';
          if (!porOrigem[origem]) porOrigem[origem] = { entradas: 0, saidas: 0 };
          if (m.tipo === 'entrada') {
            porOrigem[origem].entradas += Number(m.valor || 0);
          } else {
            porOrigem[origem].saidas += Number(m.valor || 0);
          }
        });
        
        return JSON.stringify({
          periodo: { inicio: args.data_inicio, fim: args.data_fim },
          total_entradas: totalEntradas,
          total_saidas: totalSaidas,
          saldo_periodo: totalEntradas - totalSaidas,
          quantidade_movimentos: data?.length || 0,
          por_origem: porOrigem,
          ultimos_movimentos: data?.slice(0, 10).map(m => ({
            data: m.data,
            tipo: m.tipo,
            origem: m.origem,
            descricao: m.descricao,
            valor: m.valor,
            categoria: m.categoria_nome,
          })),
        });
      }
      
      case "buscar_dre_resumo": {
        const mesStr = String(args.mes).padStart(2, '0');
        const dataInicio = `${args.ano}-${mesStr}-01`;
        const ultimoDia = new Date(args.ano, args.mes, 0).getDate();
        const dataFim = `${args.ano}-${mesStr}-${ultimoDia}`;
        
        const { data, error } = await supabase
          .from("movimentos_financeiros")
          .select("tipo, origem, valor, categoria_nome")
          .eq("empresa_id", empresaId)
          .gte("data", dataInicio)
          .lte("data", dataFim);
        
        if (error) throw error;
        
        const receitas = data?.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + Number(m.valor || 0), 0) || 0;
        const despesas = data?.filter(m => m.tipo === 'saida').reduce((sum, m) => sum + Number(m.valor || 0), 0) || 0;
        
        // Buscar CMV separadamente
        const { data: cmvData } = await supabase
          .from("cmv_registros")
          .select("custo_total")
          .eq("empresa_id", empresaId)
          .gte("data", dataInicio)
          .lte("data", dataFim);
        
        const cmv = cmvData?.reduce((sum, c) => sum + Number(c.custo_total || 0), 0) || 0;
        
        const lucroBruto = receitas - cmv;
        const lucroLiquido = receitas - cmv - despesas;
        const margemBruta = receitas > 0 ? (lucroBruto / receitas) * 100 : 0;
        const margemLiquida = receitas > 0 ? (lucroLiquido / receitas) * 100 : 0;
        
        return JSON.stringify({
          periodo: { mes: args.mes, ano: args.ano },
          receitas: receitas,
          cmv: cmv,
          lucro_bruto: lucroBruto,
          despesas_operacionais: despesas,
          lucro_liquido: lucroLiquido,
          margem_bruta_percentual: margemBruta,
          margem_liquida_percentual: margemLiquida,
          resultado: lucroLiquido >= 0 ? "positivo" : "negativo",
        });
      }
      
      case "buscar_estoque": {
        let query = supabase
          .from("estoque")
          .select(`
            id, quantidade, custo_medio,
            produto:produtos(id, nome, sku)
          `)
          .eq("empresa_id", empresaId);
        
        const { data, error } = await query;
        if (error) throw error;
        
        let produtos = data || [];
        
        if (args.produto_nome) {
          const searchTerm = args.produto_nome.toLowerCase();
          produtos = produtos.filter((e: any) => 
            e.produto?.nome?.toLowerCase().includes(searchTerm) ||
            e.produto?.sku?.toLowerCase().includes(searchTerm)
          );
        }
        
        if (args.apenas_baixo) {
          produtos = produtos.filter((e: any) => e.quantidade <= 5);
        }
        
        const totalItens = produtos.reduce((sum: number, e: any) => sum + Number(e.quantidade || 0), 0);
        const valorTotal = produtos.reduce((sum: number, e: any) => sum + (Number(e.quantidade || 0) * Number(e.custo_medio || 0)), 0);
        
        return JSON.stringify({
          quantidade_produtos: produtos.length,
          total_itens_estoque: totalItens,
          valor_total_estoque: valorTotal,
          produtos: produtos.slice(0, 20).map((e: any) => ({
            nome: e.produto?.nome,
            sku: e.produto?.sku,
            quantidade: e.quantidade,
            custo_medio: e.custo_medio,
            valor_total: Number(e.quantidade || 0) * Number(e.custo_medio || 0),
          })),
        });
      }
      
      case "buscar_kpis": {
        const hoje = new Date();
        let dataInicio: string;
        let dataFim: string = hoje.toISOString().split('T')[0];
        
        switch (args.periodo) {
          case "hoje":
            dataInicio = dataFim;
            break;
          case "7dias":
            dataInicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case "30dias":
            dataInicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case "mes_atual":
            dataInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
            break;
          case "mes_anterior":
            const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            dataInicio = mesAnterior.toISOString().split('T')[0];
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().split('T')[0];
            break;
          default:
            dataInicio = dataFim;
        }
        
        // Buscar vendas
        const { data: vendas } = await supabase
          .from("marketplace_transactions")
          .select("valor_liquido, valor_bruto, tarifas, taxas")
          .eq("empresa_id", empresaId)
          .eq("tipo_lancamento", "credito")
          .gte("data_transacao", dataInicio)
          .lte("data_transacao", dataFim);
        
        // Buscar CMV
        const { data: cmv } = await supabase
          .from("cmv_registros")
          .select("custo_total")
          .eq("empresa_id", empresaId)
          .gte("data", dataInicio)
          .lte("data", dataFim);
        
        const faturamentoBruto = vendas?.reduce((sum, v) => sum + Number(v.valor_bruto || 0), 0) || 0;
        const faturamentoLiquido = vendas?.reduce((sum, v) => sum + Number(v.valor_liquido || 0), 0) || 0;
        const totalTarifas = vendas?.reduce((sum, v) => sum + Number(v.tarifas || 0) + Number(v.taxas || 0), 0) || 0;
        const totalCMV = cmv?.reduce((sum, c) => sum + Number(c.custo_total || 0), 0) || 0;
        const quantidadePedidos = vendas?.length || 0;
        const ticketMedio = quantidadePedidos > 0 ? faturamentoBruto / quantidadePedidos : 0;
        const lucroBruto = faturamentoLiquido - totalCMV;
        const margemBruta = faturamentoLiquido > 0 ? (lucroBruto / faturamentoLiquido) * 100 : 0;
        
        return JSON.stringify({
          periodo: args.periodo,
          datas: { inicio: dataInicio, fim: dataFim },
          faturamento_bruto: faturamentoBruto,
          faturamento_liquido: faturamentoLiquido,
          total_tarifas: totalTarifas,
          cmv: totalCMV,
          lucro_bruto: lucroBruto,
          margem_bruta_percentual: margemBruta,
          quantidade_pedidos: quantidadePedidos,
          ticket_medio: ticketMedio,
        });
      }
      
      case "buscar_pendencias": {
        const result: Record<string, any> = {};
        
        if (args.tipo === "todos" || args.tipo === "banco") {
          const { data, count } = await supabase
            .from("bank_transactions")
            .select("id", { count: "exact" })
            .eq("empresa_id", empresaId)
            .eq("status", "importado");
          result.banco = { pendentes: count || 0 };
        }
        
        if (args.tipo === "todos" || args.tipo === "cartao") {
          const { count } = await supabase
            .from("credit_card_transactions")
            .select("id", { count: "exact" })
            .eq("status", "pendente");
          result.cartao = { pendentes: count || 0 };
        }
        
        if (args.tipo === "todos" || args.tipo === "marketplace") {
          const { count } = await supabase
            .from("marketplace_transactions")
            .select("id", { count: "exact" })
            .eq("empresa_id", empresaId)
            .eq("status", "importado");
          result.marketplace = { pendentes: count || 0 };
        }
        
        const totalPendencias = Object.values(result).reduce((sum: number, r: any) => sum + (r.pendentes || 0), 0);
        
        return JSON.stringify({
          total_pendencias: totalPendencias,
          detalhes: result,
          status: totalPendencias === 0 ? "tudo_conciliado" : "ha_pendencias",
        });
      }
      
      case "buscar_compras": {
        let query = supabase
          .from("compras")
          .select("id, fornecedor_nome, numero_nf, data_pedido, valor_total, status")
          .eq("empresa_id", empresaId)
          .order("data_pedido", { ascending: false });
        
        if (args.status !== "todos") {
          query = query.eq("status", args.status);
        }
        if (args.data_inicio) {
          query = query.gte("data_pedido", args.data_inicio);
        }
        if (args.data_fim) {
          query = query.lte("data_pedido", args.data_fim);
        }
        
        const { data, error } = await query.limit(50);
        if (error) throw error;
        
        const totalValor = data?.reduce((sum, c) => sum + Number(c.valor_total || 0), 0) || 0;
        
        return JSON.stringify({
          quantidade: data?.length || 0,
          valor_total: totalValor,
          compras: data?.slice(0, 10).map(c => ({
            fornecedor: c.fornecedor_nome,
            numero_nf: c.numero_nf,
            data: c.data_pedido,
            valor: c.valor_total,
            status: c.status,
          })),
        });
      }
      
      default:
        return JSON.stringify({ error: "Ferramenta não encontrada" });
    }
  } catch (error) {
    console.error(`[assistant-chat] Tool error (${toolName}):`, error);
    return JSON.stringify({ error: `Erro ao buscar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}` });
  }
}

const SYSTEM_PROMPT = `Você é o **Fin**, o copiloto financeiro e fiscal inteligente do sistema ECOM FINANCE. Sua função é ajudar os usuários a entender e gerenciar suas finanças, tributos, operações e rotinas dentro do sistema.

## REGRAS FUNDAMENTAIS:
1. SEMPRE responda em português brasileiro
2. Use as ferramentas disponíveis para buscar dados REAIS do sistema antes de responder
3. NUNCA invente dados - use apenas informações retornadas pelas ferramentas
4. Formate valores monetários como R$ X.XXX,XX
5. Seja direto, objetivo e profissional
6. Use emojis com moderação para tornar as respostas mais amigáveis
7. Quando não encontrar dados, sugira onde o usuário pode cadastrar/importar

## FERRAMENTAS DISPONÍVEIS:
Você tem acesso a ferramentas para consultar dados reais do sistema:
- buscar_faturamento: vendas, receitas por período/canal
- buscar_contas_pagar: despesas, vencimentos, pagamentos
- buscar_contas_receber: recebíveis, valores a receber
- buscar_fluxo_caixa: entradas, saídas, saldo
- buscar_dre_resumo: lucro, margens, resultado
- buscar_estoque: produtos, quantidades, valores
- buscar_kpis: métricas consolidadas
- buscar_pendencias: transações não categorizadas
- buscar_compras: pedidos de compra, NFs

## COMO USAR AS FERRAMENTAS:
- Para "quanto vendi hoje": use buscar_faturamento com data de hoje
- Para "tenho contas vencidas": use buscar_contas_pagar com status vencido
- Para "qual meu lucro do mês": use buscar_dre_resumo
- Para "como está meu estoque": use buscar_estoque
- Para "tenho pendências": use buscar_pendencias

## TELAS DISPONÍVEIS (use [LINK:/rota] para sugerir navegação):
- [LINK:/dashboard] - Dashboard
- [LINK:/dre] - DRE
- [LINK:/fluxo-caixa] - Fluxo de Caixa
- [LINK:/contas-pagar] - Contas a Pagar
- [LINK:/contas-receber] - Contas a Receber
- [LINK:/compras] - Compras
- [LINK:/estoque-sku] - Estoque
- [LINK:/conciliacao] - Conciliações
- [LINK:/kpis] - KPIs
- [LINK:/icms] - ICMS
- [LINK:/precificacao] - Precificação

## FORMATO DE RESPOSTA:
- Apresente os dados de forma clara e organizada
- Use bullet points para listas
- Destaque valores importantes em negrito
- Sempre contextualize o período dos dados
- Sugira ações quando apropriado`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Não autorizado. Faça login para usar o assistente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const empresaId = context?.empresa?.id;
    console.log("[assistant-chat] User:", user.id, "Empresa:", empresaId, "Screen:", context?.telaAtual);

    // Build context message
    let contextMessage = "\n\n## CONTEXTO ATUAL:\n";
    if (context?.empresa) {
      contextMessage += `- Empresa: ${context.empresa.nome || 'Não selecionada'} (${context.empresa.regime || 'Regime não informado'})\n`;
    }
    if (context?.telaAtual) {
      contextMessage += `- Tela atual: ${context.telaAtual}\n`;
    }
    contextMessage += `- Data atual: ${new Date().toLocaleDateString('pt-BR')}\n`;

    const systemMessageWithContext = SYSTEM_PROMPT + contextMessage;

    // Se não tem empresa, não pode usar ferramentas
    if (!empresaId) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemMessageWithContext + "\n\nATENÇÃO: Nenhuma empresa selecionada. Peça ao usuário para selecionar uma empresa antes de consultar dados." },
            ...messages,
          ],
          stream: true,
        }),
      });

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Primeira chamada: IA decide se precisa de dados
    console.log("[assistant-chat] Initial call with tools");
    const initialResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: AVAILABLE_TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!initialResponse.ok) {
      const errorText = await initialResponse.text();
      console.error("[assistant-chat] AI gateway error:", initialResponse.status, errorText);
      
      if (initialResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao processar sua pergunta." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const initialResult = await initialResponse.json();
    const assistantMessage = initialResult.choices?.[0]?.message;

    // Se IA solicitou ferramentas, executar
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log("[assistant-chat] Executing", assistantMessage.tool_calls.length, "tool calls");
      
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (tc: any) => {
          const args = typeof tc.function.arguments === 'string' 
            ? JSON.parse(tc.function.arguments) 
            : tc.function.arguments;
          
          const result = await executarFerramenta(supabase, empresaId, tc.function.name, args);
          
          return {
            tool_call_id: tc.id,
            role: "tool" as const,
            content: result,
          };
        })
      );

      console.log("[assistant-chat] Tool results obtained, making final call");

      // Segunda chamada: IA formula resposta com os dados
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            assistantMessage,
            ...toolResults,
          ],
          stream: true,
        }),
      });

      if (!finalResponse.ok) {
        console.error("[assistant-chat] Final call error:", finalResponse.status);
        return new Response(JSON.stringify({ error: "Erro ao formular resposta." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Se não precisou de ferramentas, retorna resposta direta (streaming)
    console.log("[assistant-chat] No tools needed, streaming direct response");
    const directResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    return new Response(directResponse.body, {
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
