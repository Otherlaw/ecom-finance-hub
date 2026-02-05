 /**
  * Modal para visualizar detalhes de uma NF-e
  * Exibe resumo, itens e informações de crédito ICMS
  */
 
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Separator } from "@/components/ui/separator";
 import { Download, FileText, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
 import { NfeDocumentParsed } from "@/hooks/useNfeDocuments";
 import { formatCurrency } from "@/lib/icms-data";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { useMemo } from "react";
 
 interface NfeDocumentDetailModalProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   document: NfeDocumentParsed | null;
 }
 
 interface NfeItem {
   numero: number;
   codigo: string | null;
   descricao: string;
   ncm: string | null;
   cfop: string | null;
   quantidade: number;
   valorUnitario: number;
   valorTotal: number;
   aliquotaIcms: number | null;
   valorIcms: number | null;
 }
 
 function parseNfeItems(xmlContent: string | null): NfeItem[] {
   if (!xmlContent) return [];
 
   try {
     const parser = new DOMParser();
     const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
     const items: NfeItem[] = [];
 
     const detElements = xmlDoc.querySelectorAll("det");
     detElements.forEach((det, index) => {
       const prod = det.querySelector("prod");
       const imposto = det.querySelector("imposto");
       const icms = imposto?.querySelector("ICMS > *"); // ICMS00, ICMS10, etc.
 
       items.push({
         numero: index + 1,
         codigo: prod?.querySelector("cProd")?.textContent || null,
         descricao: prod?.querySelector("xProd")?.textContent || "Sem descrição",
         ncm: prod?.querySelector("NCM")?.textContent || null,
         cfop: prod?.querySelector("CFOP")?.textContent || null,
         quantidade: parseFloat(prod?.querySelector("qCom")?.textContent || "0"),
         valorUnitario: parseFloat(prod?.querySelector("vUnCom")?.textContent || "0"),
         valorTotal: parseFloat(prod?.querySelector("vProd")?.textContent || "0"),
         aliquotaIcms: icms?.querySelector("pICMS")
           ? parseFloat(icms.querySelector("pICMS")?.textContent || "0")
           : null,
         valorIcms: icms?.querySelector("vICMS")
           ? parseFloat(icms.querySelector("vICMS")?.textContent || "0")
           : null,
       });
     });
 
     return items;
   } catch {
     return [];
   }
 }
 
 export function NfeDocumentDetailModal({
   open,
   onOpenChange,
   document,
 }: NfeDocumentDetailModalProps) {
   const items = useMemo(() => {
     return document ? parseNfeItems(document.xml_content) : [];
   }, [document]);
 
   const handleDownloadXml = () => {
     if (!document?.xml_content || !document?.access_key) return;
 
     const blob = new Blob([document.xml_content], { type: "application/xml" });
     const url = URL.createObjectURL(blob);
     const a = window.document.createElement("a");
     a.href = url;
     a.download = `NFe_${document.access_key}.xml`;
     window.document.body.appendChild(a);
     a.click();
     window.document.body.removeChild(a);
     URL.revokeObjectURL(url);
   };
 
   if (!document) return null;
 
   const getCreditStatusBadge = () => {
     if (!document.credit_info) {
       return (
         <Badge variant="outline" className="bg-muted text-muted-foreground">
           <AlertCircle className="h-3 w-3 mr-1" />
           Pendente
         </Badge>
       );
     }
 
     switch (document.credit_info.status) {
       case "gerado":
         return (
           <Badge className="bg-success/10 text-success border-success/20">
             <CheckCircle2 className="h-3 w-3 mr-1" />
             Crédito Gerado
           </Badge>
         );
       case "pendente":
         return (
           <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
             <AlertCircle className="h-3 w-3 mr-1" />
             Processando
           </Badge>
         );
       case "nao_elegivel":
         return (
           <Badge variant="outline" className="bg-muted text-muted-foreground">
             <XCircle className="h-3 w-3 mr-1" />
             Não Elegível
           </Badge>
         );
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-4xl max-h-[90vh]">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <FileText className="h-5 w-5" />
             NF-e {document.numero_nf || document.access_key.slice(-8)}
           </DialogTitle>
           <DialogDescription>
             Detalhes da Nota Fiscal Eletrônica
           </DialogDescription>
         </DialogHeader>
 
         <ScrollArea className="max-h-[70vh]">
           <div className="space-y-6 pr-4">
             {/* Resumo */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div>
                 <p className="text-sm text-muted-foreground">Número</p>
                 <p className="font-medium">{document.numero_nf || "-"}</p>
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Data Emissão</p>
                 <p className="font-medium">
                   {document.issue_date
                     ? format(new Date(document.issue_date), "dd/MM/yyyy", { locale: ptBR })
                     : "-"}
                 </p>
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Valor Total</p>
                 <p className="font-medium">{formatCurrency(document.total_value || 0)}</p>
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Status SEFAZ</p>
                 <Badge className="bg-success/10 text-success">Autorizada</Badge>
               </div>
             </div>
 
             <Separator />
 
             {/* Emitente */}
             <div>
               <h4 className="font-medium mb-2">Emitente</h4>
               <div className="grid grid-cols-2 gap-4 text-sm">
                 <div>
                   <p className="text-muted-foreground">Razão Social</p>
                   <p>{document.emitente_nome || "-"}</p>
                 </div>
                 <div>
                   <p className="text-muted-foreground">CNPJ</p>
                   <p>{document.issuer_cnpj || "-"}</p>
                 </div>
               </div>
             </div>
 
             <Separator />
 
             {/* Crédito ICMS */}
             <div>
               <h4 className="font-medium mb-2">Crédito ICMS</h4>
               <div className="flex items-center gap-4">
                 {getCreditStatusBadge()}
                 {document.credit_info && document.credit_info.valor_credito > 0 && (
                   <div className="flex items-center gap-2">
                     <span className="text-sm text-muted-foreground">Valor:</span>
                     <span className="font-medium text-success">
                       {formatCurrency(document.credit_info.valor_credito)}
                     </span>
                     <Badge variant="outline" className="text-xs">
                       {document.credit_info.tipo === "compensavel"
                         ? "Compensável"
                         : "Não Compensável"}
                     </Badge>
                   </div>
                 )}
               </div>
             </div>
 
             <Separator />
 
             {/* Chave de Acesso */}
             <div>
               <h4 className="font-medium mb-2">Chave de Acesso</h4>
               <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                 {document.access_key}
               </p>
             </div>
 
             <Separator />
 
             {/* Itens */}
             <div>
               <h4 className="font-medium mb-2">Itens ({items.length})</h4>
               {items.length > 0 ? (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead className="w-12">#</TableHead>
                       <TableHead>Descrição</TableHead>
                       <TableHead>NCM</TableHead>
                       <TableHead>CFOP</TableHead>
                       <TableHead className="text-right">Qtd</TableHead>
                       <TableHead className="text-right">Valor Unit.</TableHead>
                       <TableHead className="text-right">Total</TableHead>
                       <TableHead className="text-right">ICMS</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {items.map((item) => (
                       <TableRow key={item.numero}>
                         <TableCell>{item.numero}</TableCell>
                         <TableCell className="max-w-[200px] truncate" title={item.descricao}>
                           {item.descricao}
                         </TableCell>
                         <TableCell className="font-mono text-xs">{item.ncm || "-"}</TableCell>
                         <TableCell>{item.cfop || "-"}</TableCell>
                         <TableCell className="text-right">{item.quantidade}</TableCell>
                         <TableCell className="text-right">
                           {formatCurrency(item.valorUnitario)}
                         </TableCell>
                         <TableCell className="text-right">
                           {formatCurrency(item.valorTotal)}
                         </TableCell>
                         <TableCell className="text-right">
                           {item.valorIcms !== null
                             ? formatCurrency(item.valorIcms)
                             : "-"}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               ) : (
                 <p className="text-sm text-muted-foreground">
                   {document.xml_content
                     ? "Não foi possível extrair os itens do XML"
                     : "XML não disponível"}
                 </p>
               )}
             </div>
 
             {/* Ações */}
             <div className="flex justify-end gap-2 pt-4">
               {document.xml_content && (
                 <Button variant="outline" onClick={handleDownloadXml}>
                   <Download className="h-4 w-4 mr-2" />
                   Baixar XML
                 </Button>
               )}
             </div>
           </div>
         </ScrollArea>
       </DialogContent>
     </Dialog>
   );
 }