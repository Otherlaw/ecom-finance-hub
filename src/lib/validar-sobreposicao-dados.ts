/**
 * Validação de Sobreposição de Dados
 * 
 * Verifica se as transações do arquivo já existem no banco
 * através de outros relatórios importados anteriormente.
 */

import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export interface ValidacaoSobreposicao {
  percentualExistente: number;
  transacoesAmostra: number;
  transacoesJaExistentes: number;
  alerta: boolean;
  alertaNivel: "info" | "warning" | "error";
  mensagem: string;
  periodoDetectado?: {
    dataInicio: string;
    dataFim: string;
  };
}

interface TransacaoAmostra {
  referenciaExterna?: string;
  dataTransacao?: string;
  valorLiquido?: number;
}

/**
 * Extrai amostra de transações do arquivo para verificação
 */
async function extrairAmostraTransacoes(
  file: File,
  tamanhoAmostra: number = 100
): Promise<TransacaoAmostra[]> {
  const fileName = file.name.toLowerCase();
  const transacoes: TransacaoAmostra[] = [];
  
  try {
    const buffer = await file.arrayBuffer();
    
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(buffer, { type: "array" });
      const primeiraAba = workbook.SheetNames[0];
      const sheet = workbook.Sheets[primeiraAba];
      const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      
      // Campos possíveis para referência externa
      const camposReferencia = [
        "SOURCE_ID", "source_id", "Id da operação", "ID_OPERACAO",
        "EXTERNAL_REFERENCE", "external_reference", "Referência",
        "id_transacao", "ID Transação", "Order", "order_id"
      ];
      
      // Campos possíveis para data
      const camposData = [
        "DATE_CREATED", "date_created", "Data", "data_transacao",
        "Data da tarifa", "TRANSACTION_DATE", "Data do pedido"
      ];
      
      // Campos possíveis para valor
      const camposValor = [
        "NET_CREDIT_AMOUNT", "net_credit_amount", "Valor líquido",
        "valor_liquido", "NET_AMOUNT", "Valor Líquido Total"
      ];
      
      // Encontrar índices dos campos
      const encontrarCampo = (registro: Record<string, unknown>, campos: string[]): unknown => {
        for (const campo of campos) {
          if (registro[campo] !== undefined) return registro[campo];
        }
        return undefined;
      };
      
      // Pegar amostra distribuída pelo arquivo
      const intervalo = Math.max(1, Math.floor(dados.length / tamanhoAmostra));
      
      for (let i = 0; i < dados.length && transacoes.length < tamanhoAmostra; i += intervalo) {
        const registro = dados[i];
        
        const referencia = encontrarCampo(registro, camposReferencia);
        const data = encontrarCampo(registro, camposData);
        const valor = encontrarCampo(registro, camposValor);
        
        if (referencia || data) {
          transacoes.push({
            referenciaExterna: referencia ? String(referencia) : undefined,
            dataTransacao: data ? String(data) : undefined,
            valorLiquido: valor ? Number(valor) : undefined
          });
        }
      }
    }
    
    if (fileName.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buffer);
      const linhas = text.split("\n");
      
      if (linhas.length < 2) return transacoes;
      
      const headers = linhas[0].split(/[,;]/);
      
      // Encontrar índices dos campos relevantes
      const indiceReferencia = headers.findIndex(h => 
        /source_id|id.*opera|external_reference|referencia|order/i.test(h)
      );
      const indiceData = headers.findIndex(h => 
        /date|data|tarifa/i.test(h)
      );
      const indiceValor = headers.findIndex(h => 
        /net.*amount|valor.*liquido|liquido/i.test(h)
      );
      
      const intervalo = Math.max(1, Math.floor((linhas.length - 1) / tamanhoAmostra));
      
      for (let i = 1; i < linhas.length && transacoes.length < tamanhoAmostra; i += intervalo) {
        const valores = linhas[i].split(/[,;]/);
        
        if (indiceReferencia >= 0 || indiceData >= 0) {
          transacoes.push({
            referenciaExterna: indiceReferencia >= 0 ? valores[indiceReferencia]?.trim() : undefined,
            dataTransacao: indiceData >= 0 ? valores[indiceData]?.trim() : undefined,
            valorLiquido: indiceValor >= 0 ? parseFloat(valores[indiceValor]) : undefined
          });
        }
      }
    }
    
    return transacoes;
  } catch (error) {
    console.error("Erro ao extrair amostra de transações:", error);
    return transacoes;
  }
}

/**
 * Verifica quantas transações da amostra já existem no banco
 */
async function verificarTransacoesExistentes(
  empresaId: string,
  canal: string,
  amostra: TransacaoAmostra[]
): Promise<number> {
  if (amostra.length === 0) return 0;
  
  // Filtrar apenas transações com referência externa
  const referencias = amostra
    .filter(t => t.referenciaExterna)
    .map(t => t.referenciaExterna!);
  
  if (referencias.length === 0) return 0;
  
  // Normalizar canal
  const canalNormalizado = canal.toLowerCase().replace(/\s+/g, "_");
  
  try {
    const { count, error } = await supabase
      .from("marketplace_transactions")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("canal", canalNormalizado)
      .in("referencia_externa", referencias);
    
    if (error) {
      console.error("Erro ao verificar transações existentes:", error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error("Erro ao verificar transações:", error);
    return 0;
  }
}

/**
 * Detecta período dos dados no arquivo
 */
function detectarPeriodo(amostra: TransacaoAmostra[]): { dataInicio: string; dataFim: string } | undefined {
  const datas: Date[] = [];
  
  for (const transacao of amostra) {
    if (transacao.dataTransacao) {
      const data = new Date(transacao.dataTransacao);
      if (!isNaN(data.getTime())) {
        datas.push(data);
      }
    }
  }
  
  if (datas.length === 0) return undefined;
  
  datas.sort((a, b) => a.getTime() - b.getTime());
  
  return {
    dataInicio: datas[0].toISOString().split("T")[0],
    dataFim: datas[datas.length - 1].toISOString().split("T")[0]
  };
}

/**
 * Valida se os dados do arquivo já existem no sistema
 */
export async function validarSobreposicaoDados(
  file: File,
  empresaId: string,
  canal: string,
  tamanhoAmostra: number = 100
): Promise<ValidacaoSobreposicao> {
  try {
    // Extrair amostra de transações
    const amostra = await extrairAmostraTransacoes(file, tamanhoAmostra);
    
    if (amostra.length === 0) {
      return {
        percentualExistente: 0,
        transacoesAmostra: 0,
        transacoesJaExistentes: 0,
        alerta: false,
        alertaNivel: "info",
        mensagem: "Não foi possível extrair transações para validação"
      };
    }
    
    // Verificar quantas já existem
    const existentes = await verificarTransacoesExistentes(empresaId, canal, amostra);
    const percentual = Math.round((existentes / amostra.length) * 100);
    
    // Detectar período
    const periodoDetectado = detectarPeriodo(amostra);
    
    // Determinar nível do alerta
    let alertaNivel: "info" | "warning" | "error" = "info";
    let alerta = false;
    let mensagem = "";
    
    if (percentual >= 95) {
      alertaNivel = "error";
      alerta = true;
      mensagem = `${percentual}% das transações já existem. Este arquivo provavelmente já foi importado.`;
    } else if (percentual >= 80) {
      alertaNivel = "warning";
      alerta = true;
      mensagem = `${percentual}% das transações já existem. Verifique se este arquivo já foi importado parcialmente.`;
    } else if (percentual >= 50) {
      alertaNivel = "warning";
      alerta = true;
      mensagem = `${percentual}% das transações já existem. Pode haver sobreposição com outro relatório.`;
    } else if (percentual > 0) {
      alertaNivel = "info";
      alerta = false;
      mensagem = `${percentual}% das transações já existem (duplicatas serão ignoradas automaticamente).`;
    } else {
      mensagem = "Transações novas detectadas - nenhuma duplicidade encontrada.";
    }
    
    return {
      percentualExistente: percentual,
      transacoesAmostra: amostra.length,
      transacoesJaExistentes: existentes,
      alerta,
      alertaNivel,
      mensagem,
      periodoDetectado
    };
  } catch (error) {
    console.error("Erro ao validar sobreposição:", error);
    return {
      percentualExistente: 0,
      transacoesAmostra: 0,
      transacoesJaExistentes: 0,
      alerta: false,
      alertaNivel: "info",
      mensagem: "Erro ao validar sobreposição de dados"
    };
  }
}
