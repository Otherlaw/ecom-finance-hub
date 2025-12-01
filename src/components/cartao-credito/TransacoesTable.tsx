import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Eye, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export function TransacoesTable() {
  // TODO: Integrar com Supabase para buscar dados reais
  const transacoes = [];

  if (transacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma transação cadastrada</h3>
        <p className="text-sm text-muted-foreground mb-4">
          As transações serão exibidas após o cadastro de faturas
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Centro de Custo</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transacoes.map((transacao: any) => (
          <TableRow key={transacao.id}>
            <TableCell>{format(new Date(transacao.data_transacao), "dd/MM/yyyy")}</TableCell>
            <TableCell className="font-medium max-w-xs truncate">{transacao.descricao}</TableCell>
            <TableCell>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(transacao.valor)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{transacao.categoria?.nome || "-"}</Badge>
            </TableCell>
            <TableCell>{transacao.centro_custo?.nome || "-"}</TableCell>
            <TableCell>{transacao.responsavel?.nome || "-"}</TableCell>
            <TableCell>
              <Badge variant={transacao.tipo === "recorrente" ? "default" : "secondary"}>
                {transacao.tipo}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  transacao.status === "aprovado"
                    ? "default"
                    : transacao.status === "reprovado"
                    ? "destructive"
                    : transacao.status === "conciliado"
                    ? "default"
                    : "outline"
                }
              >
                {transacao.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
                {transacao.status === "pendente" && (
                  <>
                    <Button variant="ghost" size="icon">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
