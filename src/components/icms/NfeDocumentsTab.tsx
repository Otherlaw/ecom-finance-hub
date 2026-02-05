 /**
  * Aba de documentos NF-e estilo Qive/Arquivei
  * Exibe notas recebidas/emitidas com status de crédito ICMS
  */
 
 import { useState, useMemo } from "react";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Skeleton } from "@/components/ui/skeleton";
 import { KPICard } from "@/components/KPICard";
 import { 
   FileText, Download, Eye, RefreshCw, 
   CheckCircle2, AlertCircle, XCircle,
   TrendingUp, Receipt, CreditCard, Clock
 } from "lucide-react";
 import { useNfeDocuments, NfeDocumentParsed, NfeDocumentType } from "@/hooks/useNfeDocuments";
 import { NfeDocumentDetailModal } from "./NfeDocumentDetailModal";
 import { NfeSyncStatus } from "./NfeSyncStatus";
 import { formatCurrency } from "@/lib/icms-data";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { DateRange } from "@/components/PeriodFilter";
 
 interface NfeDocumentsTabProps {
   empresaId: string;
   empresaCnpj: string;
   dateRange: DateRange;
 }
 
 export function NfeDocumentsTab({ empresaId, empresaCnpj, dateRange }: NfeDocumentsTabProps) {
   const [activeTab, setActiveTab] = useState<NfeDocumentType>("recebidas");
   const [selectedDocument, setSelectedDocument] = useState<NfeDocumentParsed | null>(null);
   const [detailModalOpen, setDetailModalOpen] = useState(false);
 
   const { documents, isLoading, summary } = useNfeDocuments({
     empresaId,
     empresaCnpj,
     type: activeTab,
     dateFrom: dateRange.from,
     dateTo: dateRange.to,
   });
 
   const handleViewDocument = (doc: NfeDocumentParsed) => {
     setSelectedDocument(doc);
     setDetailModalOpen(true);
   };
 
   const handleDownloadXml = (doc: NfeDocumentParsed) => {
     if (!doc.xml_content) return;
 
     const blob = new Blob([doc.xml_content], { type: "application/xml" });
     const url = URL.createObjectURL(blob);
     const a = window.document.createElement("a");
     a.href = url;
     a.download = `NFe_${doc.access_key}.xml`;
     window.document.body.appendChild(a);
     a.click();
     window.document.body.removeChild(a);
     URL.revokeObjectURL(url);
   };
 
   const getCreditBadge = (doc: NfeDocumentParsed) => {
     if (!doc.credit_info) {
       return (
         <Badge variant="outline" className="text-muted-foreground">
           <Clock className="h-3 w-3 mr-1" />
           Pendente
         </Badge>
       );
     }
 
     switch (doc.credit_info.status) {
       case "gerado":
         return (
           <Badge className="bg-success/10 text-success border-success/20">
             <CheckCircle2 className="h-3 w-3 mr-1" />
             {formatCurrency(doc.credit_info.valor_credito)}
           </Badge>
         );
       case "pendente":
         return (
           <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
             <AlertCircle className="h-3 w-3 mr-1" />
             Processando
           </Badge>
         );
       case "nao_elegivel":
         return (
           <Badge variant="outline" className="text-muted-foreground">
             <XCircle className="h-3 w-3 mr-1" />
             N/A
           </Badge>
         );
     }
   };
 
   const formatCnpj = (cnpj: string | null) => {
     if (!cnpj) return "-";
     const clean = cnpj.replace(/\D/g, "");
     if (clean.length !== 14) return cnpj;
     return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
   };
 
   return (
     <div className="space-y-6">
       {/* Status da sincronização automática */}
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <NfeSyncStatus empresaId={empresaId} />
         </div>
       </div>
 
       {/* KPIs de Resumo */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <KPICard
           title="Total de Notas"
           value={summary.totalNotas.toString()}
           icon={FileText}
           iconColor="text-primary"
           changeLabel={`${activeTab === "recebidas" ? "Recebidas" : "Emitidas"} no período`}
         />
         <KPICard
           title="Valor Total"
           value={formatCurrency(summary.valorTotal)}
           icon={Receipt}
           iconColor="text-blue-500"
         />
         <KPICard
           title="Crédito ICMS Gerado"
           value={formatCurrency(summary.totalCredito)}
           icon={TrendingUp}
           iconColor="text-success"
           changeLabel={`${summary.notasComCredito} notas com crédito`}
         />
         <KPICard
           title="Notas com Crédito"
           value={`${summary.notasComCredito}/${summary.totalNotas}`}
           icon={CreditCard}
           iconColor="text-amber-500"
           changeLabel={
             summary.totalNotas > 0
               ? `${Math.round((summary.notasComCredito / summary.totalNotas) * 100)}% elegíveis`
               : "Sem notas"
           }
         />
       </div>
 
       {/* Tabs Recebidas / Emitidas */}
       <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NfeDocumentType)}>
         <TabsList>
           <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
           <TabsTrigger value="emitidas">Emitidas</TabsTrigger>
         </TabsList>
 
         <TabsContent value={activeTab} className="mt-4">
           {isLoading ? (
             <div className="space-y-2">
               {[1, 2, 3, 4, 5].map((i) => (
                 <Skeleton key={i} className="h-12 w-full" />
               ))}
             </div>
           ) : documents.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground">
               <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
               <p>Nenhuma NF-e {activeTab === "recebidas" ? "recebida" : "emitida"} encontrada no período.</p>
               <p className="text-sm mt-2">
                 As notas são sincronizadas automaticamente da SEFAZ.
               </p>
             </div>
           ) : (
             <div className="border rounded-lg overflow-hidden">
               <Table>
                 <TableHeader>
                   <TableRow className="bg-muted/50">
                     <TableHead>Data</TableHead>
                     <TableHead>Número</TableHead>
                     <TableHead>Emitente</TableHead>
                     <TableHead>CNPJ</TableHead>
                     <TableHead>CFOP</TableHead>
                     <TableHead className="text-right">Valor</TableHead>
                     <TableHead>Crédito ICMS</TableHead>
                     <TableHead className="text-center">Ações</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {documents.map((doc) => (
                     <TableRow key={doc.id} className="hover:bg-muted/30">
                       <TableCell>
                         {doc.issue_date
                           ? format(new Date(doc.issue_date), "dd/MM/yyyy", { locale: ptBR })
                           : "-"}
                       </TableCell>
                       <TableCell className="font-medium">
                         {doc.numero_nf || doc.access_key.slice(-8)}
                       </TableCell>
                       <TableCell className="max-w-[200px] truncate" title={doc.emitente_nome || undefined}>
                         {doc.emitente_nome || "-"}
                       </TableCell>
                       <TableCell className="font-mono text-xs">
                         {formatCnpj(doc.issuer_cnpj)}
                       </TableCell>
                       <TableCell>{doc.cfop_principal || "-"}</TableCell>
                       <TableCell className="text-right font-medium">
                         {formatCurrency(doc.total_value || 0)}
                       </TableCell>
                       <TableCell>{getCreditBadge(doc)}</TableCell>
                       <TableCell>
                         <div className="flex items-center justify-center gap-1">
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => handleViewDocument(doc)}
                             title="Visualizar NF-e"
                           >
                             <Eye className="h-4 w-4" />
                           </Button>
                           {doc.xml_content && (
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleDownloadXml(doc)}
                               title="Baixar XML"
                             >
                               <Download className="h-4 w-4" />
                             </Button>
                           )}
                         </div>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
           )}
         </TabsContent>
       </Tabs>
 
       {/* Modal de detalhes */}
       <NfeDocumentDetailModal
         open={detailModalOpen}
         onOpenChange={setDetailModalOpen}
         document={selectedDocument}
       />
     </div>
   );
 }