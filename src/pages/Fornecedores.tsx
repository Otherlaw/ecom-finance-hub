import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Edit, Building2, Phone, Mail, MoreHorizontal, Ban, Check } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FornecedorFormModal } from '@/components/fornecedores/FornecedorFormModal';
import { FornecedorDetailModal } from '@/components/fornecedores/FornecedorDetailModal';
import { useFornecedores, FornecedorDB, FornecedorInsert } from '@/hooks/useFornecedores';
import {
  TIPO_FORNECEDOR_CONFIG,
  SEGMENTO_FORNECEDOR_CONFIG,
  Fornecedor,
} from '@/lib/fornecedores-data';
import { mockPurchases } from '@/lib/purchases-data';
import { mockContasPagar } from '@/lib/contas-pagar-data';

// Função para converter DB para formato do modal
const dbToModalFormat = (db: FornecedorDB): Fornecedor => ({
  id: db.id,
  razaoSocial: db.razao_social,
  nomeFantasia: db.nome_fantasia || '',
  cnpj: db.cnpj || '',
  inscricaoEstadual: db.inscricao_estadual || '',
  regimeTributario: (db.regime_tributario || 'nao_informado') as any,
  tipo: (db.tipo || 'mercadoria') as any,
  segmento: (db.segmento || 'outros') as any,
  origem: (db.origem || 'cadastro_manual') as any,
  status: (db.status || 'ativo') as 'ativo' | 'inativo',
  endereco: {
    cep: db.endereco_cep || '',
    logradouro: db.endereco_logradouro || '',
    numero: db.endereco_numero || '',
    complemento: db.endereco_complemento || '',
    bairro: db.endereco_bairro || '',
    cidade: db.endereco_cidade || '',
    uf: db.endereco_uf || '',
    pais: 'Brasil',
  },
  contato: {
    nome: db.contato_nome || '',
    email: db.contato_email || '',
    telefoneFixo: db.contato_telefone || '',
    celularWhatsApp: db.contato_celular || '',
    site: '',
  },
  condicoesPagamento: {
    prazoMedioDias: db.prazo_medio_dias || 30,
    formaPagamento: (db.forma_pagamento_preferencial || 'boleto') as any,
    observacoes: '',
  },
  observacoes: db.observacoes || '',
  dataCadastro: db.created_at.split('T')[0],
  dataAtualizacao: db.updated_at.split('T')[0],
});

// Função para converter formato do modal para DB
const modalToDbFormat = (modal: Fornecedor): FornecedorInsert => ({
  razao_social: modal.razaoSocial,
  nome_fantasia: modal.nomeFantasia || null,
  cnpj: modal.cnpj || null,
  inscricao_estadual: modal.inscricaoEstadual || null,
  regime_tributario: modal.regimeTributario || null,
  tipo: modal.tipo,
  segmento: modal.segmento,
  origem: modal.origem || null,
  status: modal.status,
  endereco_cep: modal.endereco?.cep || null,
  endereco_logradouro: modal.endereco?.logradouro || null,
  endereco_numero: modal.endereco?.numero || null,
  endereco_complemento: modal.endereco?.complemento || null,
  endereco_bairro: modal.endereco?.bairro || null,
  endereco_cidade: modal.endereco?.cidade || null,
  endereco_uf: modal.endereco?.uf || null,
  contato_nome: modal.contato?.nome || null,
  contato_cargo: null,
  contato_email: modal.contato?.email || null,
  contato_telefone: modal.contato?.telefoneFixo || null,
  contato_celular: modal.contato?.celularWhatsApp || null,
  prazo_medio_dias: modal.condicoesPagamento?.prazoMedioDias || 30,
  forma_pagamento_preferencial: modal.condicoesPagamento?.formaPagamento || null,
  observacoes: modal.observacoes || null,
  empresa_id: null,
});

export default function Fornecedores() {
  const { fornecedores: fornecedoresDB, isLoading, createFornecedor, updateFornecedor } = useFornecedores();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [inactivateDialogOpen, setInactivateDialogOpen] = useState(false);
  const [fornecedorToInactivate, setFornecedorToInactivate] = useState<FornecedorDB | null>(null);

  // Converter fornecedores do DB para formato do modal
  const fornecedores = useMemo(() => 
    fornecedoresDB.map(dbToModalFormat), 
    [fornecedoresDB]
  );

  const filteredFornecedores = useMemo(() => {
    return fornecedores.filter((f) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !f.razaoSocial.toLowerCase().includes(search) &&
          !f.nomeFantasia?.toLowerCase().includes(search) &&
          !(f.cnpj || '').includes(search)
        ) {
          return false;
        }
      }
      if (tipoFilter !== 'todos' && f.tipo !== tipoFilter) return false;
      if (statusFilter !== 'todos' && f.status !== statusFilter) return false;
      return true;
    });
  }, [fornecedores, searchTerm, tipoFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: fornecedores.length,
    ativos: fornecedores.filter((f) => f.status === 'ativo').length,
    mercadoria: fornecedores.filter((f) => f.tipo === 'mercadoria').length,
    servico: fornecedores.filter((f) => f.tipo === 'servico').length,
  }), [fornecedores]);

  const handleSaveFornecedor = (fornecedor: Fornecedor) => {
    const dbData = modalToDbFormat(fornecedor);
    
    // Verificar se é edição (ID existe e não é gerado localmente)
    const existingFornecedor = fornecedoresDB.find(f => f.id === fornecedor.id);
    
    if (existingFornecedor) {
      updateFornecedor.mutate({ id: fornecedor.id, ...dbData });
    } else {
      createFornecedor.mutate(dbData);
    }
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormModalOpen(true);
  };

  const handleView = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    setDetailModalOpen(true);
  };

  const handleInactivateClick = (fornecedor: Fornecedor) => {
    const dbFornecedor = fornecedoresDB.find(f => f.id === fornecedor.id);
    if (dbFornecedor) {
      setFornecedorToInactivate(dbFornecedor);
      setInactivateDialogOpen(true);
    }
  };

  const handleConfirmInactivate = () => {
    if (fornecedorToInactivate) {
      const newStatus = fornecedorToInactivate.status === 'ativo' ? 'inativo' : 'ativo';
      updateFornecedor.mutate({ 
        id: fornecedorToInactivate.id, 
        status: newStatus 
      });
    }
    setInactivateDialogOpen(false);
    setFornecedorToInactivate(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando fornecedores...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cadastro de Fornecedores</h1>
              <p className="text-muted-foreground">Gerencie fornecedores de mercadorias, serviços e créditos</p>
            </div>
            <Button onClick={() => { setEditingFornecedor(null); setFormModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Building2 className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total de Fornecedores</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-success">{stats.ativos}</div>
                <div className="text-sm text-muted-foreground">Fornecedores Ativos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{stats.mercadoria}</div>
                <div className="text-sm text-muted-foreground">Fornec. de Mercadoria</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-purple-600">{stats.servico}</div>
                <div className="text-sm text-muted-foreground">Fornec. de Serviço</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, razão social ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Tipos</SelectItem>
                    {Object.entries(TIPO_FORNECEDOR_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFornecedores.map((fornecedor) => {
                    const tipoConfig = TIPO_FORNECEDOR_CONFIG[fornecedor.tipo];
                    const segmentoConfig = SEGMENTO_FORNECEDOR_CONFIG[fornecedor.segmento];
                    return (
                      <TableRow key={fornecedor.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{fornecedor.nomeFantasia || fornecedor.razaoSocial}</div>
                            {fornecedor.nomeFantasia && (
                              <div className="text-xs text-muted-foreground truncate max-w-48">
                                {fornecedor.razaoSocial}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{fornecedor.cnpj || '-'}</TableCell>
                        <TableCell>
                          {tipoConfig && (
                            <Badge className={`${tipoConfig.bgColor} ${tipoConfig.color} border-0`}>
                              {tipoConfig.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{segmentoConfig?.label || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {fornecedor.contato.email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-32">{fornecedor.contato.email}</span>
                              </div>
                            )}
                            {fornecedor.contato.celularWhatsApp && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{fornecedor.contato.celularWhatsApp}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={fornecedor.status === 'ativo' ? 'default' : 'secondary'}>
                            {fornecedor.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(fornecedor)}>
                                <Eye className="h-4 w-4 mr-2" />Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(fornecedor)}>
                                <Edit className="h-4 w-4 mr-2" />Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleInactivateClick(fornecedor)}>
                                {fornecedor.status === 'ativo' ? (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />Inativar
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4 mr-2" />Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {filteredFornecedores.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum fornecedor encontrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <FornecedorFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        fornecedor={editingFornecedor}
        onSave={handleSaveFornecedor}
      />

      <FornecedorDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        fornecedor={selectedFornecedor}
        compras={mockPurchases}
        contasPagar={mockContasPagar}
        onEdit={(f) => {
          setDetailModalOpen(false);
          handleEdit(f);
        }}
      />

      <AlertDialog open={inactivateDialogOpen} onOpenChange={setInactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {fornecedorToInactivate?.status === 'ativo' ? 'Inativar Fornecedor' : 'Ativar Fornecedor'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {fornecedorToInactivate?.status === 'ativo'
                ? `Deseja inativar o fornecedor "${fornecedorToInactivate?.razao_social}"? O fornecedor ficará indisponível para novas operações, mas o histórico será mantido.`
                : `Deseja ativar o fornecedor "${fornecedorToInactivate?.razao_social}"?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmInactivate}>
              {fornecedorToInactivate?.status === 'ativo' ? 'Inativar' : 'Ativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
