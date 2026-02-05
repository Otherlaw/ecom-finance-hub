 /**
  * Hook para buscar documentos NF-e sincronizados automaticamente
  * Estilo Qive/Arquivei - apenas visualização, sem ações manuais de sync
  */
 
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useMemo } from "react";
 
 export interface NfeDocument {
   id: string;
   access_key: string;
   empresa_id: string;
   issuer_cnpj: string | null;
   dest_cnpj: string | null;
   issue_date: string | null;
   total_value: number | null;
   nsu: number | null;
   processed: boolean;
   credits_generated: number;
   schema_type: string | null;
   xml_content: string | null;
   created_at: string;
 }
 
 export interface NfeDocumentParsed extends NfeDocument {
   numero_nf: string | null;
   emitente_nome: string | null;
   cfop_principal: string | null;
   status_sefaz: string;
   credit_info: {
     valor_credito: number;
     tipo: 'compensavel' | 'nao_compensavel' | null;
     status: 'gerado' | 'pendente' | 'nao_elegivel';
   } | null;
 }
 
 export type NfeDocumentType = 'recebidas' | 'emitidas';
 
 interface UseNfeDocumentsParams {
   empresaId?: string;
   empresaCnpj?: string;
   type: NfeDocumentType;
   dateFrom?: Date;
   dateTo?: Date;
 }
 
 // Parse XML para extrair dados adicionais
 function parseNfeXml(xmlContent: string | null): {
   numero_nf: string | null;
   emitente_nome: string | null;
   cfop_principal: string | null;
 } {
   if (!xmlContent) {
     return { numero_nf: null, emitente_nome: null, cfop_principal: null };
   }
 
   try {
     const parser = new DOMParser();
     const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
     
     // Número da NF
     const nNF = xmlDoc.querySelector("nNF")?.textContent || null;
     
     // Nome do emitente
     const xNome = xmlDoc.querySelector("emit > xNome")?.textContent || null;
     
     // CFOP principal (primeiro item)
     const cfop = xmlDoc.querySelector("det > prod > CFOP")?.textContent || null;
     
     return {
       numero_nf: nNF,
       emitente_nome: xNome,
       cfop_principal: cfop,
     };
   } catch {
     return { numero_nf: null, emitente_nome: null, cfop_principal: null };
   }
 }
 
 export function useNfeDocuments({
   empresaId,
   empresaCnpj,
   type,
   dateFrom,
   dateTo,
 }: UseNfeDocumentsParams) {
   // Buscar documentos
   const { data: documents = [], isLoading: docsLoading, refetch } = useQuery({
     queryKey: ["nfe_documents", empresaId, type, dateFrom?.toISOString(), dateTo?.toISOString()],
     queryFn: async () => {
       if (!empresaId || !empresaCnpj) return [];
 
       // Normalizar CNPJ para comparação (remover pontuação)
       const cnpjNormalizado = empresaCnpj.replace(/\D/g, "");
 
       let query = supabase
         .from("nfe_documents")
         .select("*")
         .eq("empresa_id", empresaId)
         .order("issue_date", { ascending: false });
 
       // Filtrar por tipo: recebidas = dest_cnpj é a empresa, emitidas = issuer_cnpj é a empresa
       if (type === "recebidas") {
         query = query.eq("dest_cnpj", cnpjNormalizado);
       } else {
         query = query.eq("issuer_cnpj", cnpjNormalizado);
       }
 
       // Filtro de período
       if (dateFrom) {
         query = query.gte("issue_date", dateFrom.toISOString().split("T")[0]);
       }
       if (dateTo) {
         query = query.lte("issue_date", dateTo.toISOString().split("T")[0]);
       }
 
       const { data, error } = await query;
 
       if (error) {
         console.error("Erro ao buscar NF-e:", error);
         throw error;
       }
 
       return (data || []) as NfeDocument[];
     },
     enabled: !!empresaId && !!empresaCnpj,
   });
 
   // Buscar créditos ICMS vinculados aos documentos
   const documentIds = documents.map((d) => d.id);
   
   const { data: creditos = [], isLoading: creditosLoading } = useQuery({
     queryKey: ["nfe_documents_credits", documentIds],
     queryFn: async () => {
       if (documentIds.length === 0) return [];
 
       const { data, error } = await supabase
         .from("creditos_icms")
         .select("id, nfe_document_id, valor_credito, tipo_credito, status_credito")
         .in("nfe_document_id", documentIds);
 
       if (error) {
         console.error("Erro ao buscar créditos:", error);
         return [];
       }
 
       return data || [];
     },
     enabled: documentIds.length > 0,
   });
 
   // Combinar documentos com créditos e parse XML
   const parsedDocuments = useMemo((): NfeDocumentParsed[] => {
     return documents.map((doc) => {
       const xmlData = parseNfeXml(doc.xml_content);
       const credito = creditos.find((c) => c.nfe_document_id === doc.id);
 
       let creditInfo: NfeDocumentParsed["credit_info"] = null;
       if (credito) {
         creditInfo = {
           valor_credito: Number(credito.valor_credito),
           tipo: credito.tipo_credito === "compensavel" ? "compensavel" : "nao_compensavel",
           status: credito.status_credito === "ativo" ? "gerado" : "pendente",
         };
       } else if (doc.processed && doc.credits_generated === 0) {
         creditInfo = {
           valor_credito: 0,
           tipo: null,
           status: "nao_elegivel",
         };
       }
 
       return {
         ...doc,
         numero_nf: xmlData.numero_nf,
         emitente_nome: xmlData.emitente_nome,
         cfop_principal: xmlData.cfop_principal,
         status_sefaz: "Autorizada", // Documentos sincronizados são autorizados
         credit_info: creditInfo,
       };
     });
   }, [documents, creditos]);
 
   // Calcular resumos
   const summary = useMemo(() => {
     const totalNotas = parsedDocuments.length;
     const valorTotal = parsedDocuments.reduce(
       (sum, doc) => sum + (doc.total_value || 0),
       0
     );
     const totalCredito = parsedDocuments.reduce(
       (sum, doc) => sum + (doc.credit_info?.valor_credito || 0),
       0
     );
     const notasComCredito = parsedDocuments.filter(
       (doc) => doc.credit_info?.status === "gerado"
     ).length;
 
     return {
       totalNotas,
       valorTotal,
       totalCredito,
       notasComCredito,
     };
   }, [parsedDocuments]);
 
   return {
     documents: parsedDocuments,
     isLoading: docsLoading || creditosLoading,
     refetch,
     summary,
   };
 }