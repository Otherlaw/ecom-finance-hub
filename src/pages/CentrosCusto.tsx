import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FolderTree,
  Plus,
  ChevronRight,
  ChevronDown,
  Edit,
  Building2,
  ShoppingCart,
  Truck,
  Search,
} from "lucide-react";
import { useCentrosCusto, CentroCustoHierarquico } from "@/hooks/useCentrosCusto";
import { cn } from "@/lib/utils";

export default function CentrosCusto() {
  const {
    centrosHierarquicos,
    centrosPrincipais,
    isLoading,
    createCentroCusto,
    updateCentroCusto,
    toggleAtivo,
  } = useCentrosCusto();

  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCentro, setEditingCentro] = useState<CentroCustoHierarquico | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(centrosPrincipais.map(c => c.id)));

  // Form state
  const [formNome, setFormNome] = useState("");
  const [formCodigo, setFormCodigo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formParentId, setFormParentId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const openCreateModal = (parentId?: string) => {
    setEditingCentro(null);
    setFormNome("");
    setFormCodigo("");
    setFormDescricao("");
    setFormParentId(parentId || null);
    setModalOpen(true);
  };

  const openEditModal = (centro: CentroCustoHierarquico) => {
    setEditingCentro(centro);
    setFormNome(centro.nome);
    setFormCodigo(centro.codigo || "");
    setFormDescricao(centro.descricao || "");
    setFormParentId(centro.parent_id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formNome.trim()) return;

    if (editingCentro) {
      await updateCentroCusto.mutateAsync({
        id: editingCentro.id,
        nome: formNome,
        codigo: formCodigo || undefined,
        descricao: formDescricao || undefined,
        parent_id: formParentId,
      });
    } else {
      await createCentroCusto.mutateAsync({
        nome: formNome,
        codigo: formCodigo || undefined,
        descricao: formDescricao || undefined,
        parent_id: formParentId || undefined,
      });
    }

    setModalOpen(false);
  };

  const getIconForCentro = (codigo: string | null) => {
    if (!codigo) return FolderTree;
    if (codigo.includes("OP")) return Building2;
    if (codigo.includes("ECOM")) return ShoppingCart;
    if (codigo.includes("DIST")) return Truck;
    return FolderTree;
  };

  const renderCentroRow = (centro: CentroCustoHierarquico, depth = 0) => {
    const hasChildren = centro.children.length > 0;
    const isExpanded = expandedIds.has(centro.id);
    const Icon = getIconForCentro(centro.codigo);
    
    // Filter logic
    if (!showInactive && !centro.ativo) return null;
    if (searchTerm && !centro.nome.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !centro.codigo?.toLowerCase().includes(searchTerm.toLowerCase())) {
      // Check if any children match
      const hasMatchingChildren = centro.children.some(child => 
        child.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!hasMatchingChildren) return null;
    }

    return (
      <div key={centro.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-3 px-4 border-b border-border hover:bg-secondary/30 transition-colors",
            depth > 0 && "bg-secondary/10"
          )}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(centro.id)}
              className="p-1 rounded hover:bg-secondary"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <div className={cn(
            "p-1.5 rounded-lg",
            depth === 0 ? "bg-primary/10" : "bg-secondary"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              depth === 0 ? "text-primary" : "text-muted-foreground"
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-medium truncate",
                depth === 0 && "text-foreground",
                !centro.ativo && "text-muted-foreground line-through"
              )}>
                {centro.nome}
              </span>
              {centro.codigo && (
                <Badge variant="outline" className="text-xs font-mono">
                  {centro.codigo}
                </Badge>
              )}
              {!centro.ativo && (
                <Badge variant="secondary" className="text-xs">Inativo</Badge>
              )}
            </div>
            {centro.descricao && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {centro.descricao}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={centro.ativo}
              onCheckedChange={(checked) => toggleAtivo.mutate({ id: centro.id, ativo: checked })}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditModal(centro)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            {depth === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCreateModal(centro.id)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Subcentro
              </Button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {centro.children.map(child => renderCentroRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <MainLayout
      title="Centros de Custo"
      subtitle="Estrutura hierárquica de centros de custo"
      actions={
        <Button onClick={() => openCreateModal()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Centro
        </Button>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Operação</span>
          </div>
          <p className="text-2xl font-bold">CC-OP</p>
          <p className="text-sm text-muted-foreground">Administrativo e Gestão</p>
        </div>

        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-success/10">
              <ShoppingCart className="h-5 w-5 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">E-commerce</span>
          </div>
          <p className="text-2xl font-bold">CC-ECOM</p>
          <p className="text-sm text-muted-foreground">Operações Marketplace</p>
        </div>

        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Truck className="h-5 w-5 text-warning" />
            </div>
            <span className="text-sm text-muted-foreground">Distribuição</span>
          </div>
          <p className="text-2xl font-bold">CC-DIST</p>
          <p className="text-sm text-muted-foreground">Logística e Entregas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive" className="text-sm">Mostrar inativos</Label>
        </div>
      </div>

      {/* Hierarchy Tree */}
      <ModuleCard
        title="Estrutura de Centros de Custo"
        description="Clique para expandir/recolher os subcentros"
        icon={FolderTree}
        noPadding
      >
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando centros de custo...
          </div>
        ) : centrosHierarquicos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum centro de custo encontrado
          </div>
        ) : (
          <div className="divide-y divide-border">
            {centrosHierarquicos.map(centro => renderCentroRow(centro))}
          </div>
        )}
      </ModuleCard>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCentro ? "Editar Centro de Custo" : "Novo Centro de Custo"}
            </DialogTitle>
            <DialogDescription>
              {editingCentro 
                ? "Atualize as informações do centro de custo"
                : "Preencha os dados do novo centro de custo"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Marketing Digital"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Ex: CC-ECOM-MKT"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Descrição do centro de custo..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Centro Principal</Label>
              <Select
                value={formParentId || "none"}
                onValueChange={(value) => setFormParentId(value === "none" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Centro Principal)</SelectItem>
                  {centrosPrincipais.map(centro => (
                    <SelectItem key={centro.id} value={centro.id}>
                      {centro.nome} ({centro.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formNome.trim() || createCentroCusto.isPending || updateCentroCusto.isPending}
            >
              {editingCentro ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
