import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  FileText,
  Wallet,
  ShoppingCart,
  LineChart,
  Calculator,
  Package,
  CreditCard,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    title: "Dashboard Inteligente",
    description: "Visualize KPIs em tempo real: faturamento, margem, ticket medio e muito mais.",
    icon: BarChart3,
    badge: "Popular",
  },
  {
    title: "Gestao de Vendas",
    description: "Acompanhe todos os pedidos por canal, com calculo automatico de comissoes e taxas.",
    icon: ShoppingCart,
    badge: null,
  },
  {
    title: "Fluxo de Caixa",
    description: "Controle entradas e saidas, importe extratos bancarios e categorize movimentacoes.",
    icon: Wallet,
    badge: null,
  },
  {
    title: "DRE Automatizado",
    description: "Demonstrativo de resultados gerado automaticamente a partir dos seus dados.",
    icon: FileText,
    badge: null,
  },
  {
    title: "Conciliacao Bancaria",
    description: "Concilie repasses de marketplaces com extratos bancarios de forma simples.",
    icon: LineChart,
    badge: "Novo",
  },
  {
    title: "Calculo de CMV",
    description: "Custo de mercadoria vendida por pedido, com margem de contribuicao detalhada.",
    icon: Calculator,
    badge: null,
  },
  {
    title: "Controle de Estoque",
    description: "Gerencie produtos, SKUs e movimentacoes de estoque por armazem.",
    icon: Package,
    badge: null,
  },
  {
    title: "Cartoes e Faturas",
    description: "Controle gastos com cartao de credito, importe faturas e categorize despesas.",
    icon: CreditCard,
    badge: null,
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Recursos que fazem a diferenca
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Tudo o que voce precisa para ter controle total das financas do seu e-commerce.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="relative group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  {feature.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {feature.badge}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-4">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/recursos">
              Ver todos os recursos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
