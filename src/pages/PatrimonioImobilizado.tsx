import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building2, 
  Landmark, 
  TrendingUp, 
  CircleDollarSign,
  Wallet,
  PiggyBank,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { usePatrimonio, TIPO_BEM_LABELS, TIPO_MOVIMENTO_LABELS, GRUPO_PL_LABELS, PatrimonioBem, PLMovimento } from "@/hooks/usePatrimonio";
import { BemFormModal } from "@/components/patrimonio/BemFormModal";
import { PLMovimentoModal } from "@/components/patrimonio/PLMovimentoModal";
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

export default function PatrimonioImobilizado() {
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id;

  const {
    bens,
    bensLoading,
    createBem,
    updateBem,
    deleteBem,
    isCreatingBem,
    isUpdatingBem,
    movimentosPL,
    movimentosPLLoading,
    createMovimentoPL,
    updateMovimentoPL,
    deleteMovimentoPL,
    isCreatingMovimentoPL,
    isUpdatingMovimentoPL,
    calcularTotaisBens,
    calcularSaldosPL,
    calcularValorContabil,
  } = usePatrimonio(empresaId);

  // Estados dos modais
  const [bemModalOpen, setBemModalOpen] = useState(false);
  const [bemEdit, setBemEdit] = useState<PatrimonioBem | null>(null);
  const [bemToDelete, setBemToDelete] = useState<PatrimonioBem | null>(null);

  const [plModalOpen, setPLModalOpen] = useState(false);
  const [plEdit, setPLEdit] = useState<PLMovimento | null>(null);
  const [plToDelete, setPLToDelete] = useState<PLMovimento | null>(null);
  const [plTipoPreDefinido, setPLTipoPreDefinido] = useState<PLMovimento["tipo"] | undefined>();
  const [plGrupoPreDefinido, setPLGrupoPreDefinido] = useState<PLMovimento["grupo_pl"] | undefined>();

  const totaisBens = calcularTotaisBens();
  const saldosPL = calcularSaldosPL();

  const formatCurrency = (value: number) => 
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (date: string) => 
    format(new Date(date), "dd/MM/yyyy", { locale: ptBR });

  // Handlers de Bens
  const handleNewBem = () => {
    setBemEdit(null);
    setBemModalOpen(true);
  };

  const handleEditBem = (bem: PatrimonioBem) => {
    setBemEdit(bem);
    setBemModalOpen(true);
  };

  const handleSubmitBem = (data: any) => {
    if (bemEdit) {
      updateBem(data, { onSuccess: () => setBemModalOpen(false) });
    } else {
      createBem(data, { onSuccess: () => setBemModalOpen(false) });
    }
  };

  const handleConfirmDeleteBem = () => {
    if (bemToDelete) {
      deleteBem(bemToDelete.id);
      setBemToDelete(null);
    }
  };

  // Handlers de PL
  const handleNewPLMovimento = (tipo?: PLMovimento["tipo"], grupo?: PLMovimento["grupo_pl"]) => {
    setPLEdit(null);
    setPLTipoPreDefinido(tipo);
    setPLGrupoPreDefinido(grupo);
    setPLModalOpen(true);
  };

  const handleEditPLMovimento = (mov: PLMovimento) => {
    setPLEdit(mov);
    setPLTipoPreDefinido(undefined);
    setPLGrupoPreDefinido(undefined);
    setPLModalOpen(true);
  };

  const handleSubmitPLMovimento = (data: any) => {
    if (plEdit) {
      updateMovimentoPL(data, { onSuccess: () => setPLModalOpen(false) });
    } else {
      createMovimentoPL(data, { onSuccess: () => setPLModalOpen(false) });
    }
  };

  const handleConfirmDeletePLMovimento = () => {
    if (plToDelete) {
      deleteMovimentoPL(plToDelete.id);
      setPLToDelete(null);
    }
  };

  if (!empresaId) {
    return (
      <MainLayout title="Patrimônio & Imobilizado">
        <Alert>
          <AlertDescription>
            Nenhuma empresa encontrada. Cadastre uma empresa primeiro.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Patrimônio & Imobilizado"
      subtitle="Gerencie bens patrimoniais e movimentos de Patrimônio Líquido"
    >
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          As informações cadastradas aqui alimentam automaticamente o <strong>Balanço Patrimonial</strong>.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="bens" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bens" className="gap-2">
            <Building2 className="h-4 w-4" />
            Bens Patrimoniais
          </TabsTrigger>
          <TabsTrigger value="pl" className="gap-2">
            <Landmark className="h-4 w-4" />
            Patrimônio Líquido
          </TabsTrigger>
        </TabsList>

        {/* ========== ABA BENS ========== */}
        <TabsContent value="bens" className="space-y-6">
          {/* Cards de Totais */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Investimentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totaisBens.totalInvestimentos)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Imobilizado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totaisBens.totalImobilizado)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Intangível
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totaisBens.totalIntangivel)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Bens */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bens Cadastrados</CardTitle>
                <CardDescription>Investimentos, imobilizado e intangível</CardDescription>
              </div>
              <Button onClick={handleNewBem} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Bem
              </Button>
            </CardHeader>
            <CardContent>
              {bensLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : bens.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum bem cadastrado ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Data Aquisição</TableHead>
                      <TableHead className="text-right">Valor Aquisição</TableHead>
                      <TableHead className="text-right">Depreciação</TableHead>
                      <TableHead className="text-right">Valor Contábil</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bens.map((bem) => (
                      <TableRow key={bem.id} className={!bem.ativo ? "opacity-50" : ""}>
                        <TableCell className="font-medium">
                          {bem.descricao}
                          {!bem.ativo && (
                            <Badge variant="secondary" className="ml-2">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{TIPO_BEM_LABELS[bem.tipo]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{bem.grupo_balanco}</TableCell>
                        <TableCell>{formatDate(bem.data_aquisicao)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(bem.valor_aquisicao)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(bem.depreciacao_acumulada || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(calcularValorContabil(bem))}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditBem(bem)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setBemToDelete(bem)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ABA PATRIMÔNIO LÍQUIDO ========== */}
        <TabsContent value="pl" className="space-y-6">
          {/* Cards de Saldos */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4" />
                    Capital Social
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(saldosPL.capitalSocial)}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNewPLMovimento("saldo_inicial", "capital_social")}
                  >
                    Saldo Inicial
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNewPLMovimento("aporte_socio")}
                  >
                    Aporte
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNewPLMovimento("retirada_socio")}
                  >
                    Retirada
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" />
                  Reservas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(saldosPL.reservas)}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNewPLMovimento("saldo_inicial", "reservas")}
                  >
                    Saldo Inicial
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNewPLMovimento("reserva_lucros")}
                  >
                    Destinar Reserva
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Lucros Acumulados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(saldosPL.lucrosAcumulados)}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNewPLMovimento("saldo_inicial", "lucros_acumulados")}
                  >
                    Saldo Inicial
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNewPLMovimento("distribuicao_lucros")}
                  >
                    Distribuir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <strong>Lucros do período</strong> são registrados automaticamente ao encerrar o mês no Fechamento Mensal.
              </p>
            </CardContent>
          </Card>

          {/* Tabela de Movimentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Movimentos de Patrimônio Líquido</CardTitle>
                <CardDescription>Histórico de aportes, retiradas, reservas e lucros</CardDescription>
              </div>
              <Button onClick={() => handleNewPLMovimento()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Movimento
              </Button>
            </CardHeader>
            <CardContent>
              {movimentosPLLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : movimentosPL.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum movimento registrado ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentosPL.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>{formatDate(mov.data_referencia)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{TIPO_MOVIMENTO_LABELS[mov.tipo]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {GRUPO_PL_LABELS[mov.grupo_pl]}
                        </TableCell>
                        <TableCell>{mov.descricao || "-"}</TableCell>
                        <TableCell className={`text-right font-medium ${mov.valor < 0 ? "text-destructive" : "text-green-600"}`}>
                          {formatCurrency(mov.valor)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPLMovimento(mov)}
                              disabled={mov.tipo === "lucro_prejuizo_periodo"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPLToDelete(mov)}
                              disabled={mov.tipo === "lucro_prejuizo_periodo"}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <BemFormModal
        open={bemModalOpen}
        onOpenChange={setBemModalOpen}
        empresaId={empresaId}
        bem={bemEdit}
        onSubmit={handleSubmitBem}
        isLoading={isCreatingBem || isUpdatingBem}
      />

      <PLMovimentoModal
        open={plModalOpen}
        onOpenChange={setPLModalOpen}
        empresaId={empresaId}
        movimento={plEdit}
        tipoPreDefinido={plTipoPreDefinido}
        grupoPLPreDefinido={plGrupoPreDefinido}
        onSubmit={handleSubmitPLMovimento}
        isLoading={isCreatingMovimentoPL || isUpdatingMovimentoPL}
      />

      {/* Confirmações de exclusão */}
      <AlertDialog open={!!bemToDelete} onOpenChange={() => setBemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bem?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{bemToDelete?.descricao}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteBem}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!plToDelete} onOpenChange={() => setPLToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este movimento de {formatCurrency(plToDelete?.valor || 0)}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeletePLMovimento}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
