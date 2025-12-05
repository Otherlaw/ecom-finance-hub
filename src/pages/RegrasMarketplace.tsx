import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Store,
  Sparkles,
  Filter,
} from "lucide-react";
import { useMarketplaceRules, MarketplaceRule } from "@/hooks/useMarketplaceRules";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useEmpresas } from "@/hooks/useEmpresas";
import { toast } from "sonner";

const CANAIS = [
  { value: "mercado_livre", label: "Mercado Livre" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "shopee", label: "Shopee" },
  { value: "shein", label: "Shein" },
  { value: "tiktok_shop", label: "TikTok Shop" },
];

const TIPOS_LANCAMENTO = [
  { value: "credito", label: "Crédito (Entrada)" },
  { value: "debito", label: "Débito (Saída)" },
];

export default function RegrasMarketplace() {
  const { empresas } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id || "");
  const { regras, isLoading, createRegra, updateRegra, deleteRegra } = useMarketplaceRules(empresaId);
  const { categorias } = useCategoriasFinanceiras();
  const { centrosFlat } = useCentrosCusto();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCanal, setFilterCanal] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRegra, setEditingRegra] = useState<MarketplaceRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    canal: "mercado_livre",
    texto_contem: "",
    tipo_lancamento: "debito" as "credito" | "debito",
    tipo_transacao: "",
    categoria_id: "",
    centro_custo_id: "",
    prioridade: 10,
  });

  // Set empresa when loaded
  if (empresas.length > 0 && !empresaId) {
    setEmpresaId(empresas[0].id);
  }

  const filteredRegras = regras.filter((regra) => {
    const matchSearch = regra.texto_contem.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCanal = filterCanal === "todos" || regra.canal === filterCanal;
    const matchTipo = filterTipo === "todos" || regra.tipo_lancamento === filterTipo;
    return matchSearch && matchCanal && matchTipo;
  });

  const handleOpenModal = (regra?: MarketplaceRule) => {
    if (regra) {
      setEditingRegra(regra);
      setFormData({
        canal: regra.canal,
        texto_contem: regra.texto_contem,
        tipo_lancamento: regra.tipo_lancamento as "credito" | "debito",
        tipo_transacao: regra.tipo_transacao || "",
        categoria_id: regra.categoria_id || "",
        centro_custo_id: regra.centro_custo_id || "",
        prioridade: regra.prioridade,
      });
    } else {
      setEditingRegra(null);
      setFormData({
        canal: "mercado_livre",
        texto_contem: "",
        tipo_lancamento: "debito",
        tipo_transacao: "",
        categoria_id: "",
        centro_custo_id: "",
        prioridade: 10,
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingRegra(null);
  };

  const handleSave = async () => {
    if (!formData.texto_contem.trim()) {
      toast.error("Informe o texto que a descrição deve conter");
      return;
    }
    if (!empresaId) {
      toast.error("Selecione uma empresa");
      return;
    }

    try {
      if (editingRegra) {
        await updateRegra.mutateAsync({
          id: editingRegra.id,
          ...formData,
          categoria_id: formData.categoria_id || null,
          centro_custo_id: formData.centro_custo_id || null,
          tipo_transacao: formData.tipo_transacao || null,
        });
      } else {
        await createRegra.mutateAsync({
          empresa_id: empresaId,
          ...formData,
          categoria_id: formData.categoria_id || null,
          centro_custo_id: formData.centro_custo_id || null,
          tipo_transacao: formData.tipo_transacao || null,
          ativo: true,
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Erro ao salvar regra:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRegra.mutateAsync(deleteId);
      setDeleteId(null);
    } catch (error) {
      console.error("Erro ao excluir regra:", error);
    }
  };

  const getCanalLabel = (canal: string) => {
    return CANAIS.find((c) => c.value === canal)?.label || canal;
  };

  return (
    <MainLayout title="Regras de Marketplace">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              Regras de Marketplace
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie regras para categorização automática de transações de marketplace
            </p>
          </div>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Regras</p>
                  <p className="text-2xl font-bold">{regras.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {CANAIS.slice(0, 3).map((canal) => (
            <Card key={canal.value}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <Store className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{canal.label}</p>
                    <p className="text-2xl font-bold">
                      {regras.filter((r) => r.canal === canal.value).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label className="mb-2 block">Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_fantasia || empresa.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="mb-2 block">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por texto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Label className="mb-2 block">Canal</Label>
                <Select value={filterCanal} onValueChange={setFilterCanal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os canais</SelectItem>
                    {CANAIS.map((canal) => (
                      <SelectItem key={canal.value} value={canal.value}>
                        {canal.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Label className="mb-2 block">Tipo</Label>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    {TIPOS_LANCAMENTO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Texto Contém</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tipo Transação</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead className="text-center">Prioridade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Carregando regras...
                    </TableCell>
                  </TableRow>
                ) : filteredRegras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {searchTerm || filterCanal !== "todos" || filterTipo !== "todos"
                        ? "Nenhuma regra encontrada com os filtros aplicados"
                        : "Nenhuma regra cadastrada. Clique em 'Nova Regra' para começar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegras.map((regra) => (
                    <TableRow key={regra.id}>
                      <TableCell className="font-medium">{regra.texto_contem}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCanalLabel(regra.canal)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={regra.tipo_lancamento === "credito" ? "default" : "secondary"}
                        >
                          {regra.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {regra.tipo_transacao || "-"}
                      </TableCell>
                      <TableCell>{regra.categoria?.nome || "-"}</TableCell>
                      <TableCell>{regra.centro_custo?.nome || "-"}</TableCell>
                      <TableCell className="text-center">{regra.prioridade}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={regra.ativo ? "default" : "secondary"}>
                          {regra.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenModal(regra)}>
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Form Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRegra ? "Editar Regra" : "Nova Regra de Categorização"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Canal *</Label>
                  <Select
                    value={formData.canal}
                    onValueChange={(v) => setFormData({ ...formData, canal: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CANAIS.map((canal) => (
                        <SelectItem key={canal.value} value={canal.value}>
                          {canal.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Lançamento *</Label>
                  <Select
                    value={formData.tipo_lancamento}
                    onValueChange={(v) =>
                      setFormData({ ...formData, tipo_lancamento: v as "credito" | "debito" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_LANCAMENTO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Texto que a descrição deve conter *</Label>
                <Input
                  placeholder="Ex: comissão por venda"
                  value={formData.texto_contem}
                  onChange={(e) => setFormData({ ...formData, texto_contem: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  A regra será aplicada quando a descrição da transação contiver este texto
                  (case-insensitive)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Transação</Label>
                <Input
                  placeholder="Ex: taxa_marketplace, frete, publicidade"
                  value={formData.tipo_transacao}
                  onChange={(e) => setFormData({ ...formData, tipo_transacao: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria Financeira</Label>
                <Select
                  value={formData.categoria_id}
                  onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {categorias
                      .filter((c) => c.ativo)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Select
                  value={formData.centro_custo_id}
                  onValueChange={(v) => setFormData({ ...formData, centro_custo_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {centrosFlat.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.fullPath}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.prioridade}
                  onChange={(e) =>
                    setFormData({ ...formData, prioridade: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Regras com maior prioridade são aplicadas primeiro. Use valores maiores para
                  regras mais específicas.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={createRegra.isPending || updateRegra.isPending}>
                {editingRegra ? "Salvar" : "Criar Regra"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
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
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
