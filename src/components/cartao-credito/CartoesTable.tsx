import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash, AlertCircle } from "lucide-react";
import { useCartoes } from "@/hooks/useCartoes";

interface CartoesTableProps {
  onEdit: (id: string) => void;
}

export function CartoesTable({ onEdit }: CartoesTableProps) {
  const { cartoes, isLoading } = useCartoes();

  if (isLoading) {
    return <div className="text-center py-8">Carregando cartões...</div>;
  }

  if (!cartoes || cartoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum cartão cadastrado</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Clique em "Novo Cartão" para cadastrar o primeiro cartão
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Empresa</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Instituição</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Limite</TableHead>
          <TableHead>Fechamento</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cartoes.map((cartao: any) => (
          <TableRow key={cartao.id}>
            <TableCell className="font-medium">
              {cartao.empresa?.nome_fantasia || cartao.empresa?.razao_social}
            </TableCell>
            <TableCell>{cartao.nome}</TableCell>
            <TableCell>{cartao.instituicao_financeira}</TableCell>
            <TableCell>
              <Badge variant={cartao.tipo === "credito" ? "default" : "secondary"}>
                {cartao.tipo === "credito" ? "Crédito" : "Débito"}
              </Badge>
            </TableCell>
            <TableCell>
              {cartao.limite_credito
                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cartao.limite_credito)
                : "-"}
            </TableCell>
            <TableCell>Dia {cartao.dia_fechamento}</TableCell>
            <TableCell>Dia {cartao.dia_vencimento}</TableCell>
            <TableCell>{cartao.responsavel?.nome || "-"}</TableCell>
            <TableCell>
              <Badge variant={cartao.ativo ? "default" : "secondary"}>
                {cartao.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon" onClick={() => onEdit(cartao.id)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}