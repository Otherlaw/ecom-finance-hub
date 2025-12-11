/**
 * Hook para Categorização Automática de Transações de Cartão de Crédito
 * 
 * Utiliza regras de categorização baseadas em padrões de estabelecimento/descrição
 * e aprendizado baseado em categorizações anteriores.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProcessarResult {
  total: number;
  categorizadas: number;
  erros: number;
}

// Regras de categorização para transações de cartão
interface RegraCartao {
  padrao: string[];
  categoria_nome: string;
  categoria_tipo: string;
  centro_custo_nome: string;
}

const REGRAS_CARTAO: RegraCartao[] = [
  // ALIMENTAÇÃO
  {
    padrao: ["ifood", "uber eats", "rappi", "restaurante", "lanchonete", "padaria", "pizza", "burger", "mcdonald", "subway", "starbucks"],
    categoria_nome: "Alimentação",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Administrativo",
  },
  // COMBUSTÍVEL
  {
    padrao: ["posto", "shell", "ipiranga", "br distribuidora", "combustível", "gasolina", "petrobras"],
    categoria_nome: "Combustível",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Operação / Logística",
  },
  // TRANSPORTE
  {
    padrao: ["uber", "99", "cabify", "taxi", "táxi", "estacionamento", "parking", "estapar", "zona azul"],
    categoria_nome: "Transporte / Deslocamento",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Administrativo",
  },
  // ASSINATURAS E SERVIÇOS
  {
    padrao: ["netflix", "spotify", "amazon prime", "disney", "hbo", "apple", "google", "microsoft", "adobe", "canva", "zoom", "slack"],
    categoria_nome: "Assinaturas e Serviços",
    categoria_tipo: "Despesas Administrativas / Gerais",
    centro_custo_nome: "Tecnologia / Sistemas",
  },
  // MATERIAL DE ESCRITÓRIO
  {
    padrao: ["papelaria", "kalunga", "staples", "escritório", "office"],
    categoria_nome: "Material de Escritório",
    categoria_tipo: "Despesas Administrativas / Gerais",
    centro_custo_nome: "Administrativo",
  },
  // TELECOMUNICAÇÕES
  {
    padrao: ["vivo", "claro", "tim", "oi", "net", "telefone", "celular", "internet"],
    categoria_nome: "Telecomunicações",
    categoria_tipo: "Despesas Administrativas / Gerais",
    centro_custo_nome: "Infraestrutura / Escritório",
  },
  // MARKETING E PUBLICIDADE
  {
    padrao: ["google ads", "facebook", "instagram", "meta", "tiktok ads", "linkedin", "twitter", "publicidade", "marketing"],
    categoria_nome: "Marketing / Anúncios",
    categoria_tipo: "Despesas Comercial / Marketing",
    centro_custo_nome: "Marketing",
  },
  // HOSPEDAGEM E VIAGENS
  {
    padrao: ["hotel", "airbnb", "booking", "decolar", "latam", "gol", "azul", "passagem", "viagem"],
    categoria_nome: "Hospedagem / Viagens",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Administrativo",
  },
  // FERRAMENTAS E EQUIPAMENTOS
  {
    padrao: ["ferragem", "ferramenta", "leroy merlin", "telhanorte", "c&c", "construção"],
    categoria_nome: "Ferramentas / Manutenção",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Infraestrutura / Escritório",
  },
  // SUPERMERCADO
  {
    padrao: ["supermercado", "mercado", "extra", "carrefour", "pão de açúcar", "atacadão", "assaí"],
    categoria_nome: "Suprimentos / Copa",
    categoria_tipo: "Despesas Administrativas / Gerais",
    centro_custo_nome: "Administrativo",
  },
  // FARMÁCIA
  {
    padrao: ["farmácia", "drogaria", "droga raia", "drogasil", "pacheco"],
    categoria_nome: "Saúde / Farmácia",
    categoria_tipo: "Despesas com Pessoal",
    centro_custo_nome: "Pessoas / RH",
  },
  // E-COMMERCE / FORNECEDORES
  {
    padrao: ["mercado livre", "shopee", "amazon", "aliexpress", "shein", "magalu", "americanas"],
    categoria_nome: "Compras E-commerce",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Operação",
  },
  // CORREIOS E LOGÍSTICA
  {
    padrao: ["correios", "sedex", "pac", "jadlog", "total express", "loggi"],
    categoria_nome: "Frete / Logística",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação / Logística",
  },
];

// Cache de categorias e centros de custo
let cacheCategoriasById: Map<string, { id: string; nome: string; tipo: string }> = new Map();
let cacheCategoriasByNome: Map<string, string> = new Map();
let cacheCentrosCustoByNome: Map<string, string> = new Map();
let cacheRegrasAprendidas: Map<string, { categoria_id: string | null; centro_custo_id: string | null }> = new Map();
let cacheCarregado = false;

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

  // Carregar regras aprendidas
  const { data: regras } = await supabase
    .from("regras_categorizacao")
    .select("estabelecimento_pattern, categoria_id, centro_custo_id")
    .eq("ativo", true)
    .order("uso_count", { ascending: false });

  if (regras) {
    regras.forEach(r => {
      cacheRegrasAprendidas.set(r.estabelecimento_pattern.toLowerCase(), {
        categoria_id: r.categoria_id,
        centro_custo_id: r.centro_custo_id,
      });
    });
  }

  cacheCarregado = true;
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

interface CategorizacaoEncontrada {
  categoria_id: string | null;
  centro_custo_id: string | null;
  fonte: 'regra_aprendida' | 'regra_padrao';
}

async function encontrarCategorizacao(descricao: string, estabelecimento: string | null): Promise<CategorizacaoEncontrada | null> {
  await carregarCaches();
  
  const textoParaBusca = `${estabelecimento || ''} ${descricao}`.toLowerCase().trim();
  
  // 1. Tentar regras aprendidas primeiro (baseado em estabelecimento)
  if (estabelecimento) {
    const estabNorm = estabelecimento.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    
    if (cacheRegrasAprendidas.has(estabNorm)) {
      const regra = cacheRegrasAprendidas.get(estabNorm)!;
      if (regra.categoria_id) {
        return { ...regra, fonte: 'regra_aprendida' };
      }
    }

    // Busca parcial nas regras aprendidas
    for (const [pattern, regra] of cacheRegrasAprendidas) {
      if (estabNorm.includes(pattern) || pattern.includes(estabNorm)) {
        if (regra.categoria_id) {
          return { ...regra, fonte: 'regra_aprendida' };
        }
      }
    }
  }

  // 2. Tentar regras padrão
  for (const regra of REGRAS_CARTAO) {
    const match = regra.padrao.some(p => textoParaBusca.includes(p.toLowerCase()));
    if (match) {
      const categoriaId = await buscarOuCriarCategoria(regra.categoria_nome, regra.categoria_tipo);
      const centroCustoId = await buscarOuCriarCentroCusto(regra.centro_custo_nome);
      return { categoria_id: categoriaId, centro_custo_id: centroCustoId, fonte: 'regra_padrao' };
    }
  }

  return null;
}

export function useCreditCardAutoCategorizacao() {
  const queryClient = useQueryClient();

  const categorizarAutomaticamente = useMutation<ProcessarResult, Error, { empresaId?: string }>({
    mutationFn: async ({ empresaId }) => {
      // Limpar cache para garantir dados atualizados
      cacheCarregado = false;
      
      // Buscar transações sem categoria
      let query = supabase
        .from("credit_card_transactions")
        .select(`
          id, 
          descricao, 
          estabelecimento,
          invoice:credit_card_invoices!inner(
            credit_card:credit_cards!inner(empresa_id)
          )
        `)
        .is("categoria_id", null)
        .eq("status", "pendente");

      const { data: transacoes, error } = await query.limit(500);

      if (error) throw error;
      if (!transacoes?.length) {
        return { total: 0, categorizadas: 0, erros: 0 };
      }

      // Filtrar por empresa se necessário
      let transacoesFiltradas = transacoes;
      if (empresaId) {
        transacoesFiltradas = transacoes.filter((t: any) => 
          t.invoice?.credit_card?.empresa_id === empresaId
        );
      }

      if (!transacoesFiltradas.length) {
        return { total: 0, categorizadas: 0, erros: 0 };
      }

      let categorizadas = 0;
      let erros = 0;

      for (const t of transacoesFiltradas) {
        const cat = await encontrarCategorizacao(t.descricao, t.estabelecimento);

        if (cat && cat.categoria_id) {
          const { error: updateError } = await supabase
            .from("credit_card_transactions")
            .update({
              categoria_id: cat.categoria_id,
              centro_custo_id: cat.centro_custo_id,
            })
            .eq("id", t.id);

          if (updateError) {
            erros++;
          } else {
            categorizadas++;
          }
        }
      }

      return { total: transacoesFiltradas.length, categorizadas, erros };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["credit_card_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transacoes-cartao"] });
      
      if (result.total === 0) {
        toast.info("Nenhuma transação pendente de categorização");
      } else if (result.categorizadas > 0) {
        toast.success(`${result.categorizadas} de ${result.total} transações categorizadas automaticamente`);
      } else {
        toast.warning(`${result.total} transações analisadas, mas nenhuma regra aplicável encontrada`);
      }
    },
    onError: (error) => {
      console.error("[Card Auto-Cat] Erro:", error);
      toast.error("Erro ao processar categorização automática");
    },
  });

  return {
    categorizarAutomaticamente,
    isProcessing: categorizarAutomaticamente.isPending,
  };
}
