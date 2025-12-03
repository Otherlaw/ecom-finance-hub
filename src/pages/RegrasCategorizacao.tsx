import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  Download,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RegraFormModal } from "@/components/regras-categorizacao/RegraFormModal";
import { ImportRegrasCSVModal } from "@/components/regras-categorizacao/ImportRegrasCSVModal";

interface RegraCategorizacao {
  id: string;
  estabelecimento_pattern: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  uso_count: number;
  ativo: boolean;
  created_at: string;
  categoria?: { nome: string } | null;
  centro_custo?: { nome: string } | null;
  responsavel?: { nome: string } | null;
}

export default function RegrasCategorizacao() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingRegra, setEditingRegra] = useState<RegraCategorizacao | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: regras, isLoading } = useQuery({
    queryKey: ["regras-categorizacao-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regras_categorizacao")
        .select(`
          *,
          categoria:categorias_financeiras(nome),
          centro_custo:centros_de_custo(nome),
          responsavel:responsaveis(nome)
        `)
        .order("uso_count", { ascending: false });

      if (error) throw error;
      return data as RegraCategorizacao[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("regras_categorizacao")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao-full"] });
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao"] });
      toast.success("Regra excluída com sucesso");
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const handleEdit = (regra: RegraCategorizacao) => {
    setEditingRegra(regra);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingRegra(null);
    setModalOpen(true);
  };

  const handleExportCSV = () => {
    if (!regras?.length) {
      toast.error("Nenhuma regra para exportar");
      return;
    }

    const headers = ["estabelecimento_pattern", "categoria", "centro_custo", "responsavel", "uso_count"];
    const rows = regras.map((r) => [
      r.estabelecimento_pattern,
      r.categoria?.nome || "",
      r.centro_custo?.nome || "",
      r.responsavel?.nome || "",
      r.uso_count.toString(),
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `regras-categorizacao-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo exportado com sucesso");
  };

  const filteredRegras = regras?.filter((r) =>
    r.estabelecimento_pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.categoria?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsos = regras?.reduce((acc, r) => acc + r.uso_count, 0) || 0;

  return (
    <MainLayout
      title="Regras de Categorização"
      subtitle="Gerencie as regras de categorização automática baseadas em estabelecimentos"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Regras</p>
                  <p className="text-2xl font-bold">{regras?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Aplicações</p>
                  <p className="text-2xl font-bold">{totalUsos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <Sparkles className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Média de Uso/Regra</p>
                  <p className="text-2xl font-bold">
                    {regras?.length ? (totalUsos / regras.length).toFixed(1) : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por estabelecimento ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                Carregando regras...
              </div>
            ) : !filteredRegras?.length ? (
              <div className="py-12 text-center text-muted-foreground">
                Nenhuma regra encontrada. As regras são criadas automaticamente quando você categoriza transações de cartão de crédito.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Padrão do Estabelecimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-center">Usos</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegras.map((regra) => (
                    <TableRow key={regra.id}>
                      <TableCell className="font-medium">
                        {regra.estabelecimento_pattern}
                      </TableCell>
                      <TableCell>{regra.categoria?.nome || "—"}</TableCell>
                      <TableCell>{regra.centro_custo?.nome || "—"}</TableCell>
                      <TableCell>{regra.responsavel?.nome || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{regra.uso_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={regra.ativo ? "default" : "secondary"}
                          className={regra.ativo ? "bg-emerald-500/10 text-emerald-600" : ""}
                        >
                          {regra.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleEdit(regra)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(regra.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <RegraFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        regra={editingRegra}
      />

      <ImportRegrasCSVModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta regra? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
