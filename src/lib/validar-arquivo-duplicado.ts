/**
 * Validação de Arquivo Duplicado
 * 
 * Verifica se o mesmo arquivo já foi importado anteriormente
 * baseado no hash SHA-256 do conteúdo.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ArquivoOriginal {
  id: string;
  nome: string;
  dataUpload: Date;
  checklistNome: string;
  checklistMesAno: string;
}

export interface ValidacaoDuplicidade {
  duplicado: boolean;
  hashArquivo: string;
  arquivoOriginal?: ArquivoOriginal;
  mensagem?: string;
}

/**
 * Calcula hash SHA-256 do conteúdo do arquivo
 */
export async function calcularHashArquivo(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifica se o arquivo já foi importado anteriormente
 */
export async function verificarArquivoDuplicado(
  file: File,
  empresaId: string,
  canal: string
): Promise<ValidacaoDuplicidade> {
  try {
    // Calcular hash do arquivo
    const hashArquivo = await calcularHashArquivo(file);
    
    // Buscar arquivo com mesmo hash
    const { data: arquivosExistentes, error } = await supabase
      .from("checklist_canal_arquivos")
      .select(`
        id,
        nome_arquivo,
        data_upload,
        checklist_item_id,
        checklist_canal_itens!inner (
          checklist_id,
          checklists_canal!inner (
            empresa_id,
            canal_id,
            canal_nome,
            mes,
            ano
          )
        )
      `)
      .eq("hash_arquivo", hashArquivo);
    
    if (error) {
      console.error("Erro ao verificar duplicidade:", error);
      return {
        duplicado: false,
        hashArquivo,
        mensagem: "Não foi possível verificar duplicidade"
      };
    }
    
    // Filtrar apenas arquivos da mesma empresa
    const arquivoDuplicado = arquivosExistentes?.find(arquivo => {
      const item = arquivo.checklist_canal_itens as unknown as {
        checklists_canal: {
          empresa_id: string;
          canal_id: string;
          canal_nome: string;
          mes: number;
          ano: number;
        }
      };
      return item?.checklists_canal?.empresa_id === empresaId;
    });
    
    if (arquivoDuplicado) {
      const item = arquivoDuplicado.checklist_canal_itens as unknown as {
        checklists_canal: {
          canal_nome: string;
          mes: number;
          ano: number;
        }
      };
      
      const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      
      return {
        duplicado: true,
        hashArquivo,
        arquivoOriginal: {
          id: arquivoDuplicado.id,
          nome: arquivoDuplicado.nome_arquivo,
          dataUpload: new Date(arquivoDuplicado.data_upload),
          checklistNome: item?.checklists_canal?.canal_nome || "Desconhecido",
          checklistMesAno: `${meses[(item?.checklists_canal?.mes || 1) - 1]}/${item?.checklists_canal?.ano}`
        },
        mensagem: `Este arquivo já foi importado anteriormente em ${new Date(arquivoDuplicado.data_upload).toLocaleDateString("pt-BR")}`
      };
    }
    
    return {
      duplicado: false,
      hashArquivo,
      mensagem: "Arquivo não encontrado anteriormente"
    };
  } catch (error) {
    console.error("Erro ao verificar duplicidade:", error);
    return {
      duplicado: false,
      hashArquivo: "",
      mensagem: "Erro ao calcular hash do arquivo"
    };
  }
}
