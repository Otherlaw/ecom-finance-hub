import { Card, CardContent } from "@/components/ui/card";
import { ResumoVendas } from "@/hooks/useVendas";
import { DollarSign, TrendingUp, Package, Receipt, Percent, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface VendasCardsProps {
  resumo: ResumoVendas;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function VendasCards({ resumo }: VendasCardsProps) {
  const cards = [
    {
      title: "Faturamento Bruto",
      value: formatCurrency(resumo.totalFaturamentoBruto),
      subtitle: `${resumo.qtdTransacoes} transações`,
      icon: DollarSign,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Faturamento Líquido",
      value: formatCurrency(resumo.totalFaturamentoLiquido),
      subtitle: `${resumo.qtdItens} itens vendidos`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "CMV (Custo)",
      value: formatCurrency(resumo.totalCMV),
      subtitle: `${((resumo.totalCMV / resumo.totalFaturamentoBruto) * 100 || 0).toFixed(1)}% do faturamento`,
      icon: Package,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Tarifas & Taxas",
      value: formatCurrency(resumo.totalTarifas + resumo.totalTaxas),
      subtitle: `${((((resumo.totalTarifas + resumo.totalTaxas) / resumo.totalFaturamentoBruto) * 100) || 0).toFixed(1)}% do faturamento`,
      icon: Receipt,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Margem de Contribuição",
      value: formatCurrency(resumo.margemContribuicao),
      subtitle: formatPercent(resumo.margemContribuicaoPercent),
      icon: Percent,
      color: resumo.margemContribuicao >= 0 ? "text-emerald-500" : "text-red-500",
      bgColor: resumo.margemContribuicao >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
      highlight: true,
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(resumo.ticketMedio),
      subtitle: "por transação",
      icon: ShoppingCart,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            "transition-all hover:shadow-md",
            card.highlight && "ring-1 ring-primary/20"
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className={cn("text-lg font-bold", card.color)}>
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              </div>
              <div className={cn("p-2 rounded-lg", card.bgColor)}>
                <card.icon className={cn("h-4 w-4", card.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
