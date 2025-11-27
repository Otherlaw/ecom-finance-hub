import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { operationData, channelData, dreData, formatCurrency } from "@/lib/mock-data";
import { AskAssistantButton } from "@/components/assistant/AskAssistantButton";
import { useAssistantChatContext } from "@/contexts/AssistantChatContext";
import {
  CalendarCheck,
  Download,
  Upload,
  Check,
  Clock,
  AlertTriangle,
  ChevronRight,
  Store,
  Building2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Fechamento() {
  const { openChat } = useAssistantChatContext();

  const handleAskAssistant = () => {
    openChat('Explique os números deste fechamento mensal', {
      telaAtual: 'Fechamento Mensal',
      dadosAdicionais: {
        receitaBruta: dreData.receitaBruta,
        receitaLiquida: dreData.receitaLiquida,
        lucroBruto: dreData.lucroBruto,
        lucroLiquido: dreData.lucroLiquido,
      },
    });
  };

  return (
    <MainLayout
      title="Fechamento Mensal"
      subtitle="Consolidação dos resultados por operação"
      actions={
        <div className="flex items-center gap-2">
          <AskAssistantButton onClick={handleAskAssistant} label="Perguntar" />
          <Select defaultValue="outubro">
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outubro">Outubro 2024</SelectItem>
              <SelectItem value="setembro">Setembro 2024</SelectItem>
              <SelectItem value="agosto">Agosto 2024</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Dados
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* Status do Fechamento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Receita Bruta Total"
          value={formatCurrency(dreData.receitaBruta)}
          change={-8.5}
          icon={TrendingUp}
          trend="down"
        />
        <KPICard
          title="Receita Líquida"
          value={formatCurrency(dreData.receitaLiquida)}
          change={-10.2}
          icon={TrendingDown}
          trend="down"
        />
        <KPICard
          title="Lucro Bruto"
          value={formatCurrency(dreData.lucroBruto)}
          change={-15.8}
          icon={TrendingUp}
          trend="down"
        />
        <KPICard
          title="Resultado Final"
          value={formatCurrency(dreData.lucroLiquido)}
          change={-165.2}
          icon={dreData.lucroLiquido >= 0 ? TrendingUp : TrendingDown}
          trend="down"
        />
      </div>

      {/* Tabs por Operação */}
      <Tabs defaultValue="consolidado" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          <TabsTrigger value="exchange">Exchange</TabsTrigger>
          <TabsTrigger value="inpari">Inpari</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidado" className="space-y-6">
          {/* Resumo por Operação */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {operationData.map((op) => (
              <ModuleCard
                key={op.operation}
                title={op.operation}
                description="Resumo da operação"
                icon={Building2}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Receita Bruta</p>
                      <p className="text-xl font-bold">{formatCurrency(op.receitaBruta)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deduções</p>
                      <p className="text-xl font-bold text-destructive">-{formatCurrency(op.deducoes)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Receita Líquida</p>
                      <p className="text-xl font-bold text-success">{formatCurrency(op.receitaLiquida)}</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">% do Total</span>
                      <span className="font-medium">
                        {((op.receitaBruta / (operationData[0].receitaBruta + operationData[1].receitaBruta)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={(op.receitaBruta / (operationData[0].receitaBruta + operationData[1].receitaBruta)) * 100} 
                      className="h-2" 
                    />
                  </div>
                </div>
              </ModuleCard>
            ))}
          </div>

          {/* Receita por Canal */}
          <ModuleCard
            title="Receita por Canal"
            description="Detalhamento por marketplace"
            icon={Store}
            noPadding
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30">
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Receita Bruta</TableHead>
                  <TableHead className="text-right">% Total</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelData.map((channel) => (
                  <TableRow key={channel.channel}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: channel.color }}
                        />
                        <span className="font-medium">{channel.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(channel.receitaBruta)}
                    </TableCell>
                    <TableCell className="text-right">
                      {channel.percentual}%
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-success">+{(Math.random() * 20).toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-success/10 text-success border-success/20">
                        <Check className="h-3 w-3 mr-1" />
                        Fechado
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ModuleCard>
        </TabsContent>

        <TabsContent value="exchange" className="space-y-6">
          <ModuleCard
            title="Exchange - Detalhamento"
            description="Outubro 2024"
            icon={Building2}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receitas */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Receita Bruta de Vendas</h4>
                <div className="space-y-3 pl-4 border-l-2 border-success/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mercado Livre</span>
                    <span className="font-medium">{formatCurrency(540354.27)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Caixa Tiny</span>
                    <span className="font-medium">{formatCurrency(369054.89)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Shopee</span>
                    <span className="font-medium">{formatCurrency(99131.12)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Shein</span>
                    <span className="font-medium">{formatCurrency(3097.43)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(1011637.71)}</span>
                  </div>
                </div>
              </div>

              {/* Deduções */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Deduções</h4>
                <div className="space-y-3 pl-4 border-l-2 border-destructive/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Devoluções</span>
                    <span className="font-medium text-destructive">-{formatCurrency(5200)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Descontos Comerciais</span>
                    <span className="font-medium text-destructive">-{formatCurrency(227601.30)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Taxas Marketplace</span>
                    <span className="font-medium text-destructive">-{formatCurrency(180000)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Impostos</span>
                    <span className="font-medium text-destructive">-{formatCurrency(278756.56)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold pt-2 border-t">
                    <span>Total Deduções</span>
                    <span className="text-destructive">-{formatCurrency(691557.86)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-info/5 border border-info/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Receita Líquida Exchange</p>
                  <p className="text-2xl font-bold text-info">{formatCurrency(320079.85)}</p>
                </div>
                <Badge className="bg-info/10 text-info border-info/20">
                  31.6% de margem
                </Badge>
              </div>
            </div>
          </ModuleCard>
        </TabsContent>

        <TabsContent value="inpari" className="space-y-6">
          <ModuleCard
            title="Inpari - Detalhamento"
            description="Outubro 2024"
            icon={Building2}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receitas */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Receita Bruta de Vendas</h4>
                <div className="space-y-3 pl-4 border-l-2 border-success/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mercado Livre</span>
                    <span className="font-medium">{formatCurrency(327142.00)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Caixa Tiny</span>
                    <span className="font-medium">{formatCurrency(420448.59)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(747590.59)}</span>
                  </div>
                </div>
              </div>

              {/* Deduções */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Deduções</h4>
                <div className="space-y-3 pl-4 border-l-2 border-destructive/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Devoluções</span>
                    <span className="font-medium text-destructive">-{formatCurrency(3500)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Deduções Consolidadas</span>
                    <span className="font-medium text-destructive">-{formatCurrency(138122.11)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Taxas e Impostos</span>
                    <span className="font-medium text-destructive">-{formatCurrency(413046.91)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold pt-2 border-t">
                    <span>Total Deduções</span>
                    <span className="text-destructive">-{formatCurrency(554669.02)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-info/5 border border-info/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Receita Líquida Inpari</p>
                  <p className="text-2xl font-bold text-info">{formatCurrency(192921.57)}</p>
                </div>
                <Badge className="bg-info/10 text-info border-info/20">
                  25.8% de margem
                </Badge>
              </div>
            </div>
          </ModuleCard>
        </TabsContent>
      </Tabs>

      {/* Status do Fechamento */}
      <div className="mt-6">
        <ModuleCard title="Status do Fechamento" description="Etapas concluídas" icon={CalendarCheck}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: "Importação de dados", status: "done" },
              { step: "Conciliação bancária", status: "done" },
              { step: "Validação de notas", status: "done" },
              { step: "Cálculo de impostos", status: "pending" },
              { step: "Aprovação final", status: "pending" },
            ].map((item, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border text-center ${
                  item.status === "done"
                    ? "bg-success/5 border-success/20"
                    : "bg-warning/5 border-warning/20"
                }`}
              >
                {item.status === "done" ? (
                  <Check className="h-6 w-6 mx-auto mb-2 text-success" />
                ) : (
                  <Clock className="h-6 w-6 mx-auto mb-2 text-warning" />
                )}
                <p className="text-sm font-medium">{item.step}</p>
                <Badge
                  className={`mt-2 ${
                    item.status === "done"
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {item.status === "done" ? "Concluído" : "Pendente"}
                </Badge>
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
