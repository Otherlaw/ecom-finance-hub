/**
 * Hook para Categorização Automática de Transações Bancárias
 * 
 * Utiliza regras de categorização baseadas em padrões de descrição
 * para classificar automaticamente transações importadas.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProcessarResult {
  total: number;
  categorizadas: number;
  erros: number;
}

// Regras de categorização para transações bancárias
interface RegraBank {
  padrao: string[];
  categoria_nome: string;
  categoria_tipo: string;
  centro_custo_nome: string;
  tipo_lancamento: 'credito' | 'debito';
}

const REGRAS_BANCARIAS: RegraBank[] = [
  // TARIFAS BANCÁRIAS
  {
    padrao: ["tarifa", "taxa de manutenção", "mensalidade", "anuidade", "taxa bancária"],
    categoria_nome: "Tarifas Bancárias",
    categoria_tipo: "Despesas Financeiras",
    centro_custo_nome: "Financeiro",
    tipo_lancamento: "debito",
  },
  // JUROS
  {
    padrao: ["juros", "encargos", "mora", "multa"],
    categoria_nome: "Juros / Encargos",
    categoria_tipo: "Despesas Financeiras",
    centro_custo_nome: "Financeiro",
    tipo_lancamento: "debito",
  },
  // IOF
  {
    padrao: ["iof"],
    categoria_nome: "IOF",
    categoria_tipo: "Impostos",
    centro_custo_nome: "Financeiro",
    tipo_lancamento: "debito",
  },
  // TRANSFERÊNCIAS
  {
    padrao: ["ted", "doc", "pix enviado", "transferência enviada", "transf"],
    categoria_nome: "Transferências Enviadas",
    categoria_tipo: "Outras Receitas / Despesas",
    centro_custo_nome: "Financeiro",
    tipo_lancamento: "debito",
  },
  {
    padrao: ["pix recebido", "transferência recebida", "ted recebida", "doc recebida"],
    categoria_nome: "Transferências Recebidas",
    categoria_tipo: "Outras Receitas / Despesas",
    centro_custo_nome: "Financeiro",
    tipo_lancamento: "credito",
  },
  // PAGAMENTOS
  {
    padrao: ["pagamento", "pgto", "boleto"],
    categoria_nome: "Pagamentos Diversos",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Operação",
    tipo_lancamento: "debito",
  },
  // COMPRAS NO DÉBITO
  {
    padrao: ["compra", "débito", "debito"],
    categoria_nome: "Compras no Débito",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Operação",
    tipo_lancamento: "debito",
  },
  // DEPÓSITOS
  {
    padrao: ["depósito", "deposito", "crédito em conta"],
    categoria_nome: "Depósitos",
    categoria_tipo: "Outras Receitas / Despesas",
    centro_custo_nome: "Financeiro",
    tipo_lancamento: "credito",
  },
  // SAQUE
  {
    padrao: ["saque", "retirada"],
    categoria_nome: "Saques",
    categoria_tipo: "Outras Receitas / Despesas",
    centro_custo_nome: "Financeiro",
    tipo_lancamento: "debito",
  },
  // MARKETPLACE - VENDAS
  {
    padrao: ["mercado livre", "mercado pago", "shopee", "amazon", "magalu"],
    categoria_nome: "Recebimento Marketplace",
    categoria_tipo: "Receitas",
    centro_custo_nome: "Operação – Vendas",
    tipo_lancamento: "credito",
  },
];

// Cache de categorias e centros de custo
let cacheCategoriasById: Map<string, { id: string; nome: string; tipo: string }> = new Map();
let cacheCategoriasByNome: Map<string, string> = new Map();
let cacheCentrosCustoByNome: Map<string, string> = new Map();
let cacheCarregado = false;

// Cache de regras aprendidas
interface RegraAprendida {
  id: string;
  estabelecimento_pattern: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  uso_count: number;
}
let cacheRegrasAprendidas: RegraAprendida[] = [];

async function carregarCaches() {
  if (cacheCarregado) return;

  const { data: categorias } = await supabase
    .from("categorias_financeiras")
    .select("id, nome, tipo")
    .eq("ativo", true);

  if (categorias) {
    categorias.forEach(cat => {
      cacheCategoriasById.set(cat.id, cat);
      cacheCategoriasByNome.set(cat.nome.toLowerCase().trim(), cat.id);
    });
  }

  const { data: centros } = await supabase
    .from("centros_de_custo")
    .select("id, nome")
    .eq("ativo", true);

  if (centros) {
    centros.forEach(cc => {
      cacheCentrosCustoByNome.set(cc.nome.toLowerCase().trim(), cc.id);
    });
  }

  // Carregar regras aprendidas do banco
  const { data: regras } = await supabase
    .from("regras_categorizacao")
    .select("id, estabelecimento_pattern, categoria_id, centro_custo_id, responsavel_id, uso_count")
    .eq("ativo", true)
    .order("uso_count", { ascending: false });

  if (regras) {
    cacheRegrasAprendidas = regras;
  }

  cacheCarregado = true;
}

// Normaliza texto para comparação
function normalizeTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Busca regra aprendida que bate com a descrição
function encontrarRegraAprendida(descricao: string): RegraAprendida | null {
  const descNorm = normalizeTexto(descricao);
  
  // Busca match exato primeiro
  let melhorMatch = cacheRegrasAprendidas.find(
    r => normalizeTexto(r.estabelecimento_pattern) === descNorm
  );
  
  // Se não encontrou exato, busca por similaridade (contém)
  if (!melhorMatch) {
    melhorMatch = cacheRegrasAprendidas.find(r => {
      const pattern = normalizeTexto(r.estabelecimento_pattern);
      return descNorm.includes(pattern) || pattern.includes(descNorm);
    });
  }
  
  return melhorMatch || null;
}

async function buscarOuCriarCategoria(nome: string, tipo: string): Promise<string | null> {
  await carregarCaches();
  const nomeNormalizado = nome.toLowerCase().trim();
  
  if (cacheCategoriasByNome.has(nomeNormalizado)) {
    return cacheCategoriasByNome.get(nomeNormalizado)!;
  }

  for (const [key, id] of cacheCategoriasByNome) {
    if (key.includes(nomeNormalizado) || nomeNormalizado.includes(key)) {
      return id;
    }
  }

  try {
    const { data, error } = await supabase
      .from("categorias_financeiras")
      .insert({ nome, tipo, descricao: "Criada automaticamente", ativo: true })
      .select("id")
      .single();

    if (error) return null;
    cacheCategoriasByNome.set(nomeNormalizado, data.id);
    return data.id;
  } catch {
    return null;
  }
}

async function buscarOuCriarCentroCusto(nome: string): Promise<string | null> {
  await carregarCaches();
  const nomeNormalizado = nome.toLowerCase().trim();
  
  if (cacheCentrosCustoByNome.has(nomeNormalizado)) {
    return cacheCentrosCustoByNome.get(nomeNormalizado)!;
  }

  for (const [key, id] of cacheCentrosCustoByNome) {
    if (key.includes(nomeNormalizado) || nomeNormalizado.includes(key)) {
      return id;
    }
  }

  try {
    const { data, error } = await supabase
      .from("centros_de_custo")
      .insert({ nome, descricao: "Criado automaticamente", ativo: true })
      .select("id")
      .single();

    if (error) return null;
    cacheCentrosCustoByNome.set(nomeNormalizado, data.id);
    return data.id;
  } catch {
    return null;
  }
}

function encontrarRegraFixa(descricao: string, tipoLancamento: 'credito' | 'debito'): RegraBank | null {
  const descNorm = descricao.toLowerCase().trim();
  
  for (const regra of REGRAS_BANCARIAS) {
    if (regra.tipo_lancamento !== tipoLancamento) continue;
    const match = regra.padrao.some(p => descNorm.includes(p.toLowerCase()));
    if (match) return regra;
  }
  return null;
}

export function useBankAutoCategorizacao() {
  const queryClient = useQueryClient();

  const categorizarAutomaticamente = useMutation<ProcessarResult, Error, { empresaId?: string }>({
    mutationFn: async ({ empresaId }) => {
      // Limpar cache para garantir dados atualizados
      cacheCarregado = false;
      await carregarCaches();
      
      // Buscar transações sem categoria
      let query = supabase
        .from("bank_transactions")
        .select("id, descricao, tipo_lancamento, valor")
        .is("categoria_id", null)
        .in("status", ["importado", "pendente"]);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data: transacoes, error } = await query.limit(500);

      if (error) throw error;
      if (!transacoes?.length) {
        return { total: 0, categorizadas: 0, erros: 0 };
      }

      let categorizadas = 0;
      let erros = 0;

      for (const t of transacoes) {
        const tipoLanc = t.tipo_lancamento as 'credito' | 'debito';
        
        // PRIORIDADE 1: Regras aprendidas (do banco de dados)
        const regraAprendida = encontrarRegraAprendida(t.descricao);
        
        if (regraAprendida && regraAprendida.categoria_id) {
          const { error: updateError } = await supabase
            .from("bank_transactions")
            .update({
              categoria_id: regraAprendida.categoria_id,
              centro_custo_id: regraAprendida.centro_custo_id,
              responsavel_id: regraAprendida.responsavel_id,
              status: "pendente",
            })
            .eq("id", t.id);

          if (updateError) {
            erros++;
          } else {
            categorizadas++;
            // Incrementa uso da regra
            await supabase
              .from("regras_categorizacao")
              .update({ uso_count: regraAprendida.uso_count + 1 })
              .eq("id", regraAprendida.id);
          }
          continue;
        }

        // PRIORIDADE 2: Regras fixas (hardcoded)
        const regraFixa = encontrarRegraFixa(t.descricao, tipoLanc);

        if (regraFixa) {
          const categoriaId = await buscarOuCriarCategoria(regraFixa.categoria_nome, regraFixa.categoria_tipo);
          const centroCustoId = await buscarOuCriarCentroCusto(regraFixa.centro_custo_nome);

          if (categoriaId) {
            const { error: updateError } = await supabase
              .from("bank_transactions")
              .update({
                categoria_id: categoriaId,
                centro_custo_id: centroCustoId,
                status: "pendente",
              })
              .eq("id", t.id);

            if (updateError) {
              erros++;
            } else {
              categorizadas++;
            }
          }
        }
      }

      return { total: transacoes.length, categorizadas, erros };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
      
      if (result.total === 0) {
        toast.info("Nenhuma transação pendente de categorização");
      } else if (result.categorizadas > 0) {
        toast.success(`${result.categorizadas} de ${result.total} transações categorizadas automaticamente`);
      } else {
        toast.warning(`${result.total} transações analisadas, mas nenhuma regra aplicável encontrada`);
      }
    },
    onError: (error) => {
      console.error("[Bank Auto-Cat] Erro:", error);
      toast.error("Erro ao processar categorização automática");
    },
  });

  return {
    categorizarAutomaticamente,
    isProcessing: categorizarAutomaticamente.isPending,
  };
}
