import { Card, CardContent } from "@/components/ui/card";
import { ResumoVendas } from "@/hooks/useVendas";
import {
  DollarSign,
  TrendingUp,
  Package,
  Receipt,
  Percent,
  ShoppingCart,
  Truck,
  BadgeDollarSign,
  Megaphone,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VendasCardsProps {
  resumo: ResumoVendas;
  aliquotaImposto: number;
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

export function VendasCards({ resumo, aliquotaImposto }: VendasCardsProps) {
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
      negative: true,
    },
    {
      title: "Tarifas & Taxas",
      value: formatCurrency(resumo.totalTarifas + resumo.totalTaxas),
      subtitle: `${((((resumo.totalTarifas + resumo.totalTaxas) / resumo.totalFaturamentoBruto) * 100) || 0).toFixed(1)}% do faturamento`,
      icon: Receipt,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      negative: true,
    },
    {
      title: "Imposto",
      value: formatCurrency(resumo.totalImpostoVenda),
      subtitle: `Alíquota ${aliquotaImposto}%`,
      icon: Calculator,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      negative: true,
    },
    {
      title: "Frete Comprador",
      value: formatCurrency(resumo.totalFreteComprador),
      subtitle: "Pago pelo cliente",
      icon: Truck,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Frete Vendedor",
      value: formatCurrency(resumo.totalFreteVendedor),
      subtitle: "Custo logístico",
      icon: Truck,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      negative: true,
    },
    {
      title: "Gasto ADS",
      value: formatCurrency(resumo.totalCustoAds),
      subtitle: "Anúncios pagos",
      icon: Megaphone,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      negative: true,
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
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            "transition-all hover:shadow-md",
            card.highlight && "ring-1 ring-primary/20"
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground truncate">
                  {card.title}
                </p>
                <p className={cn("text-sm font-bold", card.negative ? "text-red-500" : card.color)}>
                  {card.negative && resumo.totalFaturamentoBruto > 0 ? "- " : ""}
                  {card.value}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{card.subtitle}</p>
              </div>
              <div className={cn("p-1.5 rounded-lg shrink-0", card.bgColor)}>
                <card.icon className={cn("h-3.5 w-3.5", card.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
