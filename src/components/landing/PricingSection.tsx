import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Start",
    description: "Para quem esta comecando no e-commerce",
    price: "97",
    featured: false,
    features: [
      "1 empresa",
      "1 canal de vendas",
      "Dashboard e DRE",
      "Fluxo de caixa basico",
      "Suporte por e-mail",
    ],
  },
  {
    name: "Pro",
    description: "Para operacoes em crescimento",
    price: "197",
    featured: true,
    features: [
      "3 empresas",
      "5 canais de vendas",
      "Integracao Mercado Livre",
      "Conciliacao bancaria",
      "CMV por pedido",
      "Gestao de estoque",
      "Suporte prioritario",
    ],
  },
  {
    name: "Scale",
    description: "Para grandes operacoes",
    price: "397",
    featured: false,
    features: [
      "Empresas ilimitadas",
      "Canais ilimitados",
      "Todas as integracoes",
      "API de acesso",
      "Relatorios personalizados",
      "Multiplos usuarios",
      "Gerente de conta dedicado",
    ],
  },
];

export function PricingSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Planos de contratacao
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Escolha o plano ideal para o tamanho da sua operacao.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "relative flex flex-col",
                plan.featured && "border-primary shadow-lg scale-105"
              )}
            >
              {plan.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Mais popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold">R${plan.price}</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  className="w-full"
                  variant={plan.featured ? "default" : "outline"}
                >
                  <Link to="/auth">Comecar agora</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild variant="link" className="gap-2">
            <Link to="/planos">
              Comparar todos os planos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
