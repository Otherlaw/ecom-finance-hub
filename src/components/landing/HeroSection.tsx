import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 py-20 lg:py-32">
      <div className="container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm">
            <span className="text-primary">Novo</span>
            <span className="mx-2 text-muted-foreground">|</span>
            <span className="text-muted-foreground">Integracao com Mercado Livre</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Controle financeiro{" "}
            <span className="text-primary">completo</span> para seu e-commerce
          </h1>

          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Fechamento mensal automatizado, conciliacao de repasses, margem por pedido e muito mais. 
            Tudo em uma unica plataforma.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth">
                Comecar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link to="/recursos">
                <Play className="h-4 w-4" />
                Ver recursos
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Teste gratis por 14 dias. Sem cartao de credito.
          </p>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,hsl(var(--muted))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--muted))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
    </section>
  );
}
