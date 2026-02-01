import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 bg-primary text-primary-foreground">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para organizar suas financas?
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Comece agora mesmo e tenha controle total do seu e-commerce. 
            Teste gratis por 14 dias, sem compromisso.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link to="/auth">
                Criar conta gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/ajuda">
                Falar com suporte
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
