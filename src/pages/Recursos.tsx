import { useState } from "react";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { CTASection } from "@/components/landing/CTASection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  FileText,
  Wallet,
  ShoppingCart,
  LineChart,
  Calculator,
  Package,
  CreditCard,
  Users,
  Settings,
  Receipt,
  TrendingUp,
  Building2,
  CircleDollarSign,
  ArrowRight,
} from "lucide-react";

const categories = [
  { id: "todos", label: "Todos" },
  { id: "vendas", label: "Vendas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "estoque", label: "Estoque" },
  { id: "relatorios", label: "Relatorios" },
];

const recursos = [
  {
    title: "Dashboard Inteligente",
    description: "Visualize todos os KPIs do seu negocio em tempo real. Faturamento, margem, ticket medio, comparativos e muito mais em um unico painel.",
    icon: BarChart3,
    category: "relatorios",
    badge: "Popular",
  },
  {
    title: "Gestao de Vendas",
    description: "Acompanhe todos os pedidos por canal de venda. Calculo automatico de comissoes, taxas, frete e impostos por pedido.",
    icon: ShoppingCart,
    category: "vendas",
    badge: null,
  },
  {
    title: "Fluxo de Caixa",
    description: "Controle completo de entradas e saidas. Importe extratos bancarios OFX/CSV e categorize movimentacoes automaticamente.",
    icon: Wallet,
    category: "financeiro",
    badge: null,
  },
  {
    title: "DRE Automatizado",
    description: "Demonstrativo de Resultados do Exercicio gerado automaticamente com base nos seus dados de vendas e despesas.",
    icon: FileText,
    category: "relatorios",
    badge: null,
  },
  {
    title: "Conciliacao Bancaria",
    description: "Concilie repasses de marketplaces com seus extratos bancarios. Identifique divergencias e mantenha tudo organizado.",
    icon: LineChart,
    category: "financeiro",
    badge: "Novo",
  },
  {
    title: "Calculo de CMV",
    description: "Custo de Mercadoria Vendida calculado por pedido. Margem de contribuicao detalhada para cada venda.",
    icon: Calculator,
    category: "vendas",
    badge: null,
  },
  {
    title: "Controle de Estoque",
    description: "Gerencie produtos, SKUs e movimentacoes de estoque. Suporte a multiplos armazens e lotes.",
    icon: Package,
    category: "estoque",
    badge: null,
  },
  {
    title: "Cartoes de Credito",
    description: "Controle gastos com cartoes de credito. Importe faturas OFX, categorize despesas e acompanhe vencimentos.",
    icon: CreditCard,
    category: "financeiro",
    badge: null,
  },
  {
    title: "Contas a Pagar",
    description: "Gerencie todas as obrigacoes da empresa. Controle vencimentos, fornecedores e status de pagamentos.",
    icon: Receipt,
    category: "financeiro",
    badge: null,
  },
  {
    title: "Contas a Receber",
    description: "Acompanhe todos os recebiveis. Controle clientes, vencimentos e status de recebimentos.",
    icon: CircleDollarSign,
    category: "financeiro",
    badge: null,
  },
  {
    title: "Gestao de Compras",
    description: "Registre e acompanhe compras de mercadorias. Importe NFes XML e atualize custos automaticamente.",
    icon: TrendingUp,
    category: "estoque",
    badge: null,
  },
  {
    title: "Multiplas Empresas",
    description: "Gerencie multiplos CNPJs em uma unica conta. Visao consolidada ou individual por empresa.",
    icon: Building2,
    category: "relatorios",
    badge: null,
  },
  {
    title: "Gestao de Usuarios",
    description: "Convide colaboradores e defina permissoes. Controle quem pode acessar cada area do sistema.",
    icon: Users,
    category: "relatorios",
    badge: null,
  },
  {
    title: "Configuracoes Fiscais",
    description: "Configure regimes tributarios, aliquotas e regras de calculo de impostos por empresa.",
    icon: Settings,
    category: "financeiro",
    badge: null,
  },
];

export default function Recursos() {
  const [selectedCategory, setSelectedCategory] = useState("todos");

  const filteredRecursos = selectedCategory === "todos"
    ? recursos
    : recursos.filter((r) => r.category === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-background to-muted/30">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Recursos completos para sua operacao
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Conhea todas as ferramentas disponiveis no ECOM Finance para controlar as financas do seu e-commerce.
              </p>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="py-8 border-b bg-background sticky top-16 z-40">
          <div className="container">
            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Grid de Recursos */}
        <section className="py-16 bg-background">
          <div className="container">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecursos.map((recurso) => (
                <Card key={recurso.title} className="group hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <recurso.icon className="h-6 w-6 text-primary" />
                      </div>
                      {recurso.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {recurso.badge}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg mt-4">{recurso.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {recurso.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredRecursos.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum recurso encontrado nesta categoria.</p>
              </div>
            )}
          </div>
        </section>

        <CTASection />
      </main>
      <PublicFooter />
    </div>
  );
}
