import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, CreditCard as CreditCardIcon, FileText, TrendingUp, AlertTriangle, Upload, Tags } from "lucide-react";
import { CartaoFormModal } from "@/components/cartao-credito/CartaoFormModal";
import { FaturaFormModal } from "@/components/cartao-credito/FaturaFormModal";
import { ImportarFaturaOFXModal } from "@/components/cartao-credito/ImportarFaturaOFXModal";
import { CategorizarTransacoesModal } from "@/components/cartao-credito/CategorizarTransacoesModal";
import { CartoesTable } from "@/components/cartao-credito/CartoesTable";
import { FaturasTable } from "@/components/cartao-credito/FaturasTable";
import { TransacoesTable } from "@/components/cartao-credito/TransacoesTable";
import { DashboardGastos } from "@/components/cartao-credito/DashboardGastos";
import { useFaturas } from "@/hooks/useCartoes";

export default function CartaoCredito() {
  const [cartaoModalOpen, setCartaoModalOpen] = useState(false);
  const [faturaModalOpen, setFaturaModalOpen] = useState(false);
  const [importarModalOpen, setImportarModalOpen] = useState(false);
  const [categorizarModalOpen, setCategorizarModalOpen] = useState(false);
  const [selectedCartao, setSelectedCartao] = useState<string | null>(null);
  const [selectedFatura, setSelectedFatura] = useState<string | null>(null);
  const { faturas } = useFaturas();

  return (
    <MainLayout
      title="Cartões de Crédito"
      subtitle="Controle completo de faturas e transações dos cartões corporativos"
      actions={
        <div className="flex gap-2">
          <Button onClick={() => setCartaoModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cartão
          </Button>
          <Button onClick={() => setImportarModalOpen(true)} variant="secondary">
            <Upload className="h-4 w-4 mr-2" />
            Importar Faturas
          </Button>
          <Button onClick={() => setFaturaModalOpen(true)} variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Nova Fatura Manual
          </Button>
        </div>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Faturas Abertas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">0 faturas pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo em 7 dias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">0 faturas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Limite Disponível</CardTitle>
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">de R$ 0,00 total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Mês Atual</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-success">0 transações</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cartoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
          <TabsTrigger value="faturas">Faturas</TabsTrigger>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="cartoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cartões Cadastrados</CardTitle>
              <CardDescription>Gerencie os cartões corporativos e pessoais da empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <CartoesTable onEdit={(id) => console.log('Edit', id)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faturas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Faturas dos Cartões</CardTitle>
              <CardDescription>Acompanhe as faturas mensais e seus status de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <FaturasTable
                onViewTransactions={(id) => {
                  setSelectedFatura(id);
                  setCategorizarModalOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transacoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transações Detalhadas</CardTitle>
              <CardDescription>Visualize e categorize todas as transações dos cartões</CardDescription>
            </CardHeader>
            <CardContent>
              <TransacoesTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardGastos />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CartaoFormModal open={cartaoModalOpen} onOpenChange={setCartaoModalOpen} />
      <FaturaFormModal open={faturaModalOpen} onOpenChange={setFaturaModalOpen} />
      <ImportarFaturaModal open={importarModalOpen} onOpenChange={setImportarModalOpen} />
      {selectedFatura && (
        <CategorizarTransacoesModal
          open={categorizarModalOpen}
          onOpenChange={setCategorizarModalOpen}
          faturaId={selectedFatura}
        />
      )}
    </MainLayout>
  );
}
