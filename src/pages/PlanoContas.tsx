import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  ToggleLeft,
  ToggleRight,
  FolderTree,
  Tag,
} from "lucide-react";
import { useCategoriasFinanceiras, type CategoriaFinanceira } from "@/hooks/useCategoriasFinanceiras";
import { CategoriaFormModal } from "@/components/plano-contas/CategoriaFormModal";
import { cn } from "@/lib/utils";

const TIPO_COLORS: Record<string, string> = {
  "Receitas": "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  "Custos": "bg-orange-500/10 text-orange-600 border-orange-500/30",
  "Despesas Operacionais": "bg-blue-500/10 text-blue-600 border-blue-500/30",
  "Despesas Comercial / Marketing": "bg-pink-500/10 text-pink-600 border-pink-500/30",
  "Despesas Administrativas / Gerais": "bg-slate-500/10 text-slate-600 border-slate-500/30",
  "Despesas com Pessoal": "bg-purple-500/10 text-purple-600 border-purple-500/30",
  "Despesas Financeiras": "bg-amber-500/10 text-amber-600 border-amber-500/30",
  "Impostos Sobre o Resultado": "bg-red-600/10 text-red-700 border-red-600/30",
  "Outras Receitas / Despesas": "bg-gray-500/10 text-gray-600 border-gray-500/30",
};

export default function PlanoContas() {
  const {
    categoriasPorTipo,
    tiposDisponiveis,
    isLoading,
    createCategoria,
    updateCategoria,
    toggleAtivo,
  } = useCategoriasFinanceiras();

  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedTipos, setExpandedTipos] = useState<Set<string>>(new Set(tiposDisponiveis));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaFinanceira | null>(null);

  const toggleTipo = (tipo: string) => {
    const newExpanded = new Set(expandedTipos);
    if (newExpanded.has(tipo)) {
      newExpanded.delete(tipo);
    } else {
      newExpanded.add(tipo);
    }
    setExpandedTipos(newExpanded);
  };

  const expandAll = () => setExpandedTipos(new Set(tiposDisponiveis));
  const collapseAll = () => setExpandedTipos(new Set());

  const handleCreate = () => {
    setEditingCategoria(null);
    setModalOpen(true);
  };

  const handleEdit = (categoria: CategoriaFinanceira) => {
    setEditingCategoria(categoria);
    setModalOpen(true);
  };

  const handleToggleAtivo = (categoria: CategoriaFinanceira) => {
    toggleAtivo.mutate({ id: categoria.id, ativo: !categoria.ativo });
  };

  const handleSubmit = (data: { nome: string; tipo: string; descricao?: string }) => {
    if (editingCategoria) {
      updateCategoria.mutate(
        { id: editingCategoria.id, ...data },
        { onSuccess: () => setModalOpen(false) }
      );
    } else {
      createCategoria.mutate(data, { onSuccess: () => setModalOpen(false) });
    }
  };

  // Filter categories based on search and active status
  const filteredCategoriasPorTipo = categoriasPorTipo
    .map((grupo) => ({
      ...grupo,
      categorias: grupo.categorias.filter((cat) => {
        const matchesSearch = cat.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = showInactive || cat.ativo;
        return matchesSearch && matchesStatus;
      }),
    }))
    .filter((grupo) => grupo.categorias.length > 0);

  const totalCategorias = categoriasPorTipo.reduce((acc, g) => acc + g.categorias.length, 0);
  const categoriasAtivas = categoriasPorTipo.reduce(
    (acc, g) => acc + g.categorias.filter((c) => c.ativo).length,
    0
  );

  return (
    <MainLayout
      title="Plano de Contas"
      subtitle="Gerencie as categorias financeiras do sistema"
      actions={
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FolderTree className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Categorias</p>
                  <p className="text-2xl font-bold">{totalCategorias}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <Tag className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categorias Ativas</p>
                  <p className="text-2xl font-bold">{categoriasAtivas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Tag className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grupos (Tipos)</p>
                  <p className="text-2xl font-bold">{categoriasPorTipo.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-inactive"
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                  />
                  <label htmlFor="show-inactive" className="text-sm cursor-pointer">
                    Mostrar inativas
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    Expandir
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    Recolher
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hierarchical List */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Carregando categorias...
            </CardContent>
          </Card>
        ) : filteredCategoriasPorTipo.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma categoria encontrada.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCategoriasPorTipo.map((grupo) => (
              <Card key={grupo.tipo}>
                <Collapsible
                  open={expandedTipos.has(grupo.tipo)}
                  onOpenChange={() => toggleTipo(grupo.tipo)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedTipos.has(grupo.tipo) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <CardTitle className="text-base font-semibold">
                            {grupo.tipo}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={cn("font-normal", TIPO_COLORS[grupo.tipo])}
                          >
                            {grupo.categorias.length} categoria{grupo.categorias.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/50 border-b">
                              <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground">
                                Nome
                              </th>
                              <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground hidden md:table-cell">
                                Descrição
                              </th>
                              <th className="text-center px-4 py-2 text-sm font-medium text-muted-foreground w-24">
                                Status
                              </th>
                              <th className="text-center px-4 py-2 text-sm font-medium text-muted-foreground w-16">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.categorias.map((categoria) => (
                              <tr
                                key={categoria.id}
                                className={cn(
                                  "border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                                  !categoria.ativo && "opacity-50"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <span className="font-medium">{categoria.nome}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                                  {categoria.descricao || "—"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Badge
                                    variant={categoria.ativo ? "default" : "secondary"}
                                    className={cn(
                                      "text-xs",
                                      categoria.ativo
                                        ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                        : ""
                                    )}
                                  >
                                    {categoria.ativo ? "Ativa" : "Inativa"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-popover">
                                      <DropdownMenuItem onClick={() => handleEdit(categoria)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleToggleAtivo(categoria)}>
                                        {categoria.ativo ? (
                                          <>
                                            <ToggleLeft className="h-4 w-4 mr-2" />
                                            Desativar
                                          </>
                                        ) : (
                                          <>
                                            <ToggleRight className="h-4 w-4 mr-2" />
                                            Ativar
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CategoriaFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        categoria={editingCategoria}
        tiposDisponiveis={tiposDisponiveis}
        onSubmit={handleSubmit}
        isLoading={createCategoria.isPending || updateCategoria.isPending}
      />
    </MainLayout>
  );
}
