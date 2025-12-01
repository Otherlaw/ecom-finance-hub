import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface FaturasTableProps {
  onViewTransactions: (id: string) => void;
}

export function FaturasTable({ onViewTransactions }: FaturasTableProps) {
  // TODO: Integrar com Supabase para buscar dados reais
  const faturas = [];

  if (faturas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma fatura cadastrada</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Clique em "Nova Fatura" para cadastrar a primeira fatura
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cartão</TableHead>
          <TableHead>Mês Referência</TableHead>
          <TableHead>Valor Total</TableHead>
          <TableHead>Fechamento</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Pagamento</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {faturas.map((fatura: any) => (
          <TableRow key={fatura.id}>
            <TableCell className="font-medium">
              {fatura.credit_card?.nome} - {fatura.credit_card?.ultimos_digitos}
            </TableCell>
            <TableCell>{format(new Date(fatura.mes_referencia), "MM/yyyy")}</TableCell>
            <TableCell>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(fatura.valor_total)}
            </TableCell>
            <TableCell>{format(new Date(fatura.data_fechamento), "dd/MM/yyyy")}</TableCell>
            <TableCell>{format(new Date(fatura.data_vencimento), "dd/MM/yyyy")}</TableCell>
            <TableCell>
              <Badge variant={fatura.status === "pendente" ? "outline" : "default"}>
                {fatura.status}
              </Badge>
            </TableCell>
            <TableCell>
              {fatura.pago ? (
                <div className="flex items-center gap-1 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {format(new Date(fatura.data_pagamento), "dd/MM/yyyy")}
                  </span>
                </div>
              ) : (
                <Badge variant="secondary">Não pago</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon" onClick={() => onViewTransactions(fatura.id)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
