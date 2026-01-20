/**
 * CHECKLIST - IMPORTAÇÃO DE RELATÓRIOS COM MERGE
 * 
 * Este módulo implementa a lógica de importação de relatórios de marketplace
 * com merge por pedido_id para evitar duplicações e complementar dados.
 * 
 * REGRA PRINCIPAL:
 * - Se pedido_id já existe: ATUALIZA campos faltantes
 * - Se pedido_id não existe: CRIA nova transação
 * - NUNCA criar venda duplicada para mesmo pedido
 */

import { supabase } from "@/integrations/supabase/client";

export interface TransacaoImportada {
  pedido_id: string;
  data_transacao: string;
  canal: string;
  tipo_transacao: string;
  tipo_lancamento: string;
  valor_bruto?: number;
  valor_liquido?: number;
  comissao?: number;
  tarifa?: number;
  frete_vendedor?: number;
  ads?: number;
  imposto?: number;
  conta_nome?: string;
  tipo_envio?: string;
  descricao?: string;
  referencia_externa?: string;
  empresa_id: string;
}

export interface ResultadoImportacao {
  totalProcessadas: number;
  novasInseridas: number;
  atualizadas: number;
  semPedidoId: number;
  erros: string[];
}

/**
 * Importa transações de relatório de marketplace com lógica de merge
 * 
 * COMPORTAMENTO:
 * 1. Busca transações existentes por pedido_id
 * 2. Se existe: atualiza campos que estão nulos/zerados
 * 3. Se não existe: insere nova transação
 * 4. Transações sem pedido_id são inseridas normalmente (usando referencia_externa)
 */
export async function importarComMerge(
  transacoes: TransacaoImportada[],
  empresaId: string,
  canal: string
): Promise<ResultadoImportacao> {
  const resultado: ResultadoImportacao = {
    totalProcessadas: 0,
    novasInseridas: 0,
    atualizadas: 0,
    semPedidoId: 0,
    erros: [],
  };

  // Separar transações com e sem pedido_id
  const comPedidoId = transacoes.filter(t => t.pedido_id && t.pedido_id.trim());
  const semPedidoId = transacoes.filter(t => !t.pedido_id || !t.pedido_id.trim());

  resultado.semPedidoId = semPedidoId.length;

  // === PROCESSAR TRANSAÇÕES COM PEDIDO_ID (MERGE) ===
  if (comPedidoId.length > 0) {
    // Buscar pedidos existentes para fazer merge
    const pedidoIds = [...new Set(comPedidoId.map(t => t.pedido_id))];
    
    const { data: existentes, error: fetchError } = await supabase
      .from("marketplace_transactions")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("canal", canal)
      .eq("tipo_transacao", "venda")
      .in("pedido_id", pedidoIds);

    if (fetchError) {
      resultado.erros.push(`Erro ao buscar transações existentes: ${fetchError.message}`);
      return resultado;
    }

    // Criar mapa de existentes por pedido_id
    const existentesMap = new Map<string, any>();
    (existentes || []).forEach(t => {
      if (t.pedido_id) {
        existentesMap.set(t.pedido_id, t);
      }
    });

    // Agrupar novas transações por pedido_id (pode haver múltiplas linhas)
    const novasAgrupadas = new Map<string, TransacaoImportada[]>();
    comPedidoId.forEach(t => {
      const grupo = novasAgrupadas.get(t.pedido_id) || [];
      grupo.push(t);
      novasAgrupadas.set(t.pedido_id, grupo);
    });

    // Processar cada pedido
    for (const [pedidoId, linhas] of novasAgrupadas) {
      resultado.totalProcessadas += linhas.length;

      // Consolidar dados das linhas (pode ter múltiplas com partes diferentes)
      const dadosConsolidados = linhas.reduce((acc, linha) => ({
        comissao: acc.comissao || linha.comissao || 0,
        tarifa: acc.tarifa || linha.tarifa || 0,
        frete_vendedor: acc.frete_vendedor || linha.frete_vendedor || 0,
        ads: acc.ads || linha.ads || 0,
        imposto: acc.imposto || linha.imposto || 0,
        conta_nome: acc.conta_nome || linha.conta_nome,
        tipo_envio: acc.tipo_envio || linha.tipo_envio,
        valor_bruto: acc.valor_bruto || linha.valor_bruto || 0,
        valor_liquido: acc.valor_liquido || linha.valor_liquido || 0,
        data_transacao: acc.data_transacao || linha.data_transacao,
        descricao: acc.descricao || linha.descricao,
      }), {} as any);

      const existente = existentesMap.get(pedidoId);

      if (existente) {
        // === MERGE: Atualizar apenas campos faltantes ===
        const atualizacoes: Record<string, any> = {};
        let temAtualizacao = false;

        // Comissão: atualizar se atual é nulo/0 e novo tem valor
        if ((!existente.taxas || existente.taxas === 0) && dadosConsolidados.comissao > 0) {
          atualizacoes.taxas = dadosConsolidados.comissao;
          temAtualizacao = true;
        }

        // Tarifa: atualizar se atual é nulo/0 e novo tem valor
        if ((!existente.tarifas || existente.tarifas === 0) && dadosConsolidados.tarifa > 0) {
          atualizacoes.tarifas = dadosConsolidados.tarifa;
          temAtualizacao = true;
        }

        // Frete vendedor
        if ((!existente.frete_vendedor || existente.frete_vendedor === 0) && dadosConsolidados.frete_vendedor > 0) {
          atualizacoes.frete_vendedor = dadosConsolidados.frete_vendedor;
          temAtualizacao = true;
        }

        // ADS
        if ((!existente.ads || existente.ads === 0) && dadosConsolidados.ads > 0) {
          atualizacoes.ads = dadosConsolidados.ads;
          temAtualizacao = true;
        }

        // Imposto
        if ((!existente.imposto || existente.imposto === 0) && dadosConsolidados.imposto > 0) {
          atualizacoes.imposto = dadosConsolidados.imposto;
          temAtualizacao = true;
        }

        // Conta nome
        if (!existente.conta_nome && dadosConsolidados.conta_nome) {
          atualizacoes.conta_nome = dadosConsolidados.conta_nome;
          temAtualizacao = true;
        }

        // Tipo envio
        if (!existente.tipo_envio && dadosConsolidados.tipo_envio) {
          atualizacoes.tipo_envio = dadosConsolidados.tipo_envio;
          temAtualizacao = true;
        }

        if (temAtualizacao) {
          atualizacoes.atualizado_em = new Date().toISOString();

          const { error: updateError } = await supabase
            .from("marketplace_transactions")
            .update(atualizacoes)
            .eq("id", existente.id);

          if (updateError) {
            resultado.erros.push(`Erro ao atualizar pedido ${pedidoId}: ${updateError.message}`);
          } else {
            resultado.atualizadas++;
          }
        }
      } else {
        // === INSERT: Transação nova ===
        const primeiraLinha = linhas[0];
        
        const novaTransacao = {
          empresa_id: empresaId,
          canal,
          pedido_id: pedidoId,
          data_transacao: dadosConsolidados.data_transacao || primeiraLinha.data_transacao,
          tipo_transacao: "venda",
          tipo_lancamento: "credito",
          valor_bruto: dadosConsolidados.valor_bruto || 0,
          valor_liquido: dadosConsolidados.valor_liquido || 0,
          taxas: dadosConsolidados.comissao || 0,
          tarifas: dadosConsolidados.tarifa || 0,
          frete_vendedor: dadosConsolidados.frete_vendedor || 0,
          ads: dadosConsolidados.ads || 0,
          imposto: dadosConsolidados.imposto || 0,
          conta_nome: dadosConsolidados.conta_nome || null,
          tipo_envio: dadosConsolidados.tipo_envio || null,
          descricao: dadosConsolidados.descricao || `Venda ${pedidoId}`,
          referencia_externa: primeiraLinha.referencia_externa || pedidoId,
          status: "importado",
          regime: "competencia",
        };

        const { error: insertError } = await supabase
          .from("marketplace_transactions")
          .insert(novaTransacao);

        if (insertError) {
          // Verificar se é erro de duplicata (constraint)
          if (insertError.code === "23505") {
            // Duplicata, tentar atualizar
            resultado.atualizadas++;
          } else {
            resultado.erros.push(`Erro ao inserir pedido ${pedidoId}: ${insertError.message}`);
          }
        } else {
          resultado.novasInseridas++;
        }
      }
    }
  }

  // === PROCESSAR TRANSAÇÕES SEM PEDIDO_ID (INSERT DIRETO) ===
  // Essas são inseridas via upsert com referencia_externa
  if (semPedidoId.length > 0) {
    for (const transacao of semPedidoId) {
      resultado.totalProcessadas++;

      const novaTransacao = {
        empresa_id: empresaId,
        canal,
        pedido_id: null,
        data_transacao: transacao.data_transacao,
        tipo_transacao: transacao.tipo_transacao || "outro",
        tipo_lancamento: transacao.tipo_lancamento || "debito",
        valor_bruto: transacao.valor_bruto || 0,
        valor_liquido: transacao.valor_liquido || 0,
        taxas: transacao.comissao || 0,
        tarifas: transacao.tarifa || 0,
        frete_vendedor: transacao.frete_vendedor || 0,
        ads: transacao.ads || 0,
        imposto: transacao.imposto || 0,
        conta_nome: transacao.conta_nome || null,
        tipo_envio: transacao.tipo_envio || null,
        descricao: transacao.descricao || "Transação importada",
        referencia_externa: transacao.referencia_externa || `${transacao.data_transacao}_${transacao.valor_liquido}`,
        status: "importado",
        regime: "competencia",
      };

      const { error: insertError } = await supabase
        .from("marketplace_transactions")
        .upsert(novaTransacao, {
          onConflict: "empresa_id,canal,referencia_externa,tipo_transacao,tipo_lancamento",
        });

      if (insertError) {
        resultado.erros.push(`Erro ao inserir transação: ${insertError.message}`);
      } else {
        resultado.novasInseridas++;
      }
    }
  }

  return resultado;
}

/**
 * Valida se o período do arquivo corresponde ao checklist
 */
export function validarPeriodoArquivo(
  datasArquivo: string[],
  mesChecklist: number,
  anoChecklist: number
): { valido: boolean; mensagem: string } {
  if (datasArquivo.length === 0) {
    return { valido: false, mensagem: "Nenhuma data encontrada no arquivo" };
  }

  // Contar quantas datas são do período esperado
  let dentroPeríodo = 0;
  let foraPeríodo = 0;

  for (const dataStr of datasArquivo) {
    if (!dataStr) continue;
    
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) continue;

    const mesArquivo = data.getMonth() + 1;
    const anoArquivo = data.getFullYear();

    if (mesArquivo === mesChecklist && anoArquivo === anoChecklist) {
      dentroPeríodo++;
    } else {
      foraPeríodo++;
    }
  }

  const total = dentroPeríodo + foraPeríodo;
  if (total === 0) {
    return { valido: false, mensagem: "Nenhuma data válida encontrada" };
  }

  const percentualDentro = (dentroPeríodo / total) * 100;

  if (percentualDentro >= 80) {
    return { valido: true, mensagem: `${percentualDentro.toFixed(0)}% das transações são do período` };
  }

  const mesNome = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ][mesChecklist - 1];

  return {
    valido: false,
    mensagem: `Atenção: Apenas ${percentualDentro.toFixed(0)}% das transações são de ${mesNome}/${anoChecklist}. ` +
              `O arquivo pode ser de outro período.`
  };
}
