/**
 * Validação de Empresa do Arquivo
 * 
 * Verifica se o CNPJ contido no relatório corresponde à empresa
 * associada ao checklist para evitar importação de dados errados.
 */

import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export interface ValidacaoEmpresa {
  valida: boolean;
  cnpjArquivo: string | null;
  cnpjEmpresa: string;
  nomeEmpresa: string;
  alertaIncompatibilidade: boolean;
  mensagem?: string;
}

/**
 * Limpa CNPJ removendo caracteres especiais
 */
function limparCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  return cnpj.replace(/[^\d]/g, "");
}

/**
 * Formata CNPJ para exibição
 */
function formatarCNPJ(cnpj: string): string {
  const limpo = limparCNPJ(cnpj);
  if (limpo.length !== 14) return cnpj;
  return limpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Extrai CNPJ do arquivo baseado no tipo de relatório
 */
async function extrairCNPJDoArquivo(file: File): Promise<string | null> {
  const fileName = file.name.toLowerCase();
  
  try {
    // Ler o arquivo como ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(buffer, { type: "array" });
      const primeiraAba = workbook.SheetNames[0];
      const sheet = workbook.Sheets[primeiraAba];
      const dados = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      
      // Procurar por campos que contenham CNPJ
      const camposCNPJ = [
        "CNPJ Vendedor",
        "CNPJ_Vendedor", 
        "CNPJ do Vendedor",
        "CNPJ",
        "cnpj_vendedor",
        "cnpj",
        "Seller CNPJ"
      ];
      
      // Primeira linha geralmente é o header
      const headers = (dados[0] as unknown[]) || [];
      
      for (const campo of camposCNPJ) {
        const indice = headers.findIndex(
          (h) => h?.toString().toLowerCase().includes(campo.toLowerCase())
        );
        
        if (indice >= 0 && dados[1]) {
          const valorCNPJ = dados[1][indice];
          if (valorCNPJ) {
            return limparCNPJ(String(valorCNPJ));
          }
        }
      }
      
      // Se não encontrou no header, procurar em células específicas
      // Mercado Livre pode ter em formato diferente
      for (let i = 0; i < Math.min(10, dados.length); i++) {
        const linha = dados[i];
        if (!linha || !Array.isArray(linha)) continue;
        
        for (const celula of linha) {
          if (!celula) continue;
          const texto = String(celula);
          // Verificar se parece um CNPJ (14 dígitos ou formatado)
          const cnpjMatch = texto.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
          if (cnpjMatch) {
            return limparCNPJ(cnpjMatch[0]);
          }
        }
      }
    }
    
    if (fileName.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buffer);
      const linhas = text.split("\n");
      
      if (linhas.length < 2) return null;
      
      // Procurar CNPJ nas primeiras linhas
      for (let i = 0; i < Math.min(5, linhas.length); i++) {
        const cnpjMatch = linhas[i].match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
        if (cnpjMatch) {
          return limparCNPJ(cnpjMatch[0]);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao extrair CNPJ do arquivo:", error);
    return null;
  }
}

/**
 * Busca dados da empresa no banco
 */
async function buscarDadosEmpresa(empresaId: string): Promise<{ cnpj: string; nome: string } | null> {
  const { data, error } = await supabase
    .from("empresas")
    .select("cnpj, razao_social, nome_fantasia")
    .eq("id", empresaId)
    .single();
  
  if (error || !data) {
    console.error("Erro ao buscar empresa:", error);
    return null;
  }
  
  return {
    cnpj: limparCNPJ(data.cnpj),
    nome: data.nome_fantasia || data.razao_social
  };
}

/**
 * Valida se o arquivo pertence à empresa do checklist
 */
export async function validarEmpresaArquivo(
  file: File,
  empresaId: string
): Promise<ValidacaoEmpresa> {
  // Buscar dados da empresa
  const dadosEmpresa = await buscarDadosEmpresa(empresaId);
  
  if (!dadosEmpresa) {
    return {
      valida: false,
      cnpjArquivo: null,
      cnpjEmpresa: "",
      nomeEmpresa: "",
      alertaIncompatibilidade: true,
      mensagem: "Não foi possível obter os dados da empresa"
    };
  }
  
  // Extrair CNPJ do arquivo
  const cnpjArquivo = await extrairCNPJDoArquivo(file);
  
  // Se não conseguiu extrair CNPJ, não podemos validar
  if (!cnpjArquivo) {
    return {
      valida: true, // Considera válido pois não podemos verificar
      cnpjArquivo: null,
      cnpjEmpresa: dadosEmpresa.cnpj,
      nomeEmpresa: dadosEmpresa.nome,
      alertaIncompatibilidade: false,
      mensagem: "Não foi possível extrair CNPJ do arquivo para validação"
    };
  }
  
  // Comparar CNPJs
  const cnpjsIguais = cnpjArquivo === dadosEmpresa.cnpj;
  
  return {
    valida: cnpjsIguais,
    cnpjArquivo: formatarCNPJ(cnpjArquivo),
    cnpjEmpresa: formatarCNPJ(dadosEmpresa.cnpj),
    nomeEmpresa: dadosEmpresa.nome,
    alertaIncompatibilidade: !cnpjsIguais,
    mensagem: cnpjsIguais 
      ? "CNPJ do arquivo corresponde à empresa"
      : `CNPJ do arquivo (${formatarCNPJ(cnpjArquivo)}) não corresponde ao CNPJ da empresa ${dadosEmpresa.nome} (${formatarCNPJ(dadosEmpresa.cnpj)})`
  };
}
