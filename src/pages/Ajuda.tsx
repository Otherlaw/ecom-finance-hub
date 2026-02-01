import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Mail, MessageCircle, BookOpen, ArrowRight } from "lucide-react";

const faqItems = [
  {
    question: "Como comeco a usar o ECOM Finance?",
    answer: "Basta criar uma conta gratuita, cadastrar sua empresa com CNPJ e regime tributario, e voce ja pode comecar a usar. O sistema oferece um assistente de onboarding para guiar seus primeiros passos.",
  },
  {
    question: "Posso testar antes de assinar?",
    answer: "Sim! Oferecemos 14 dias de teste gratuito com acesso a todos os recursos. Nao pedimos cartao de credito para iniciar o teste.",
  },
  {
    question: "Quais marketplaces sao suportados?",
    answer: "Atualmente temos integracao nativa com Mercado Livre. Para outros marketplaces, voce pode importar dados via arquivos CSV ou utilizar nossa API.",
  },
  {
    question: "Como funciona a conciliacao bancaria?",
    answer: "Voce pode importar extratos bancarios nos formatos OFX ou CSV. O sistema compara automaticamente os repasses dos marketplaces com as movimentacoes do extrato, identificando divergencias.",
  },
  {
    question: "Posso gerenciar mais de uma empresa?",
    answer: "Sim! Dependendo do seu plano, voce pode gerenciar multiplos CNPJs. O plano Scale oferece empresas ilimitadas.",
  },
  {
    question: "O sistema calcula impostos automaticamente?",
    answer: "Sim, o sistema calcula impostos sobre vendas baseado no regime tributario configurado (Simples Nacional, Lucro Presumido ou Lucro Real). Voce pode ajustar as aliquotas nas configuracoes fiscais.",
  },
  {
    question: "Como importo minhas notas fiscais de compra?",
    answer: "No modulo de Compras, voce pode importar arquivos XML de NFe diretamente. O sistema extrai automaticamente os dados dos produtos, quantidades e valores.",
  },
  {
    question: "Meus dados estao seguros?",
    answer: "Sim! Utilizamos criptografia em todas as comunicacoes e seus dados sao armazenados em servidores seguros com backup automatico. Seguimos as melhores praticas de seguranca.",
  },
  {
    question: "Posso cancelar minha assinatura a qualquer momento?",
    answer: "Sim, voce pode cancelar sua assinatura quando quiser. Nao cobramos multas ou taxas de cancelamento. Seu acesso permanece ativo ate o final do periodo pago.",
  },
  {
    question: "Como funciona o suporte?",
    answer: "Todos os planos incluem suporte por e-mail. Planos Pro e Scale contam com suporte prioritario. O plano Scale inclui um gerente de conta dedicado.",
  },
];

const supportOptions = [
  {
    title: "E-mail",
    description: "Envie sua duvida e responderemos em ate 24h",
    icon: Mail,
    action: "suporte@ecomfinance.com",
    href: "mailto:suporte@ecomfinance.com",
  },
  {
    title: "Chat",
    description: "Fale com nossa equipe em tempo real",
    icon: MessageCircle,
    action: "Iniciar chat",
    href: "#",
  },
  {
    title: "Documentacao",
    description: "Consulte guias e tutoriais detalhados",
    icon: BookOpen,
    action: "Acessar docs",
    href: "#",
  },
];

export default function Ajuda() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-background to-muted/30">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Central de Ajuda
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Encontre respostas para suas duvidas ou entre em contato com nossa equipe de suporte.
              </p>
            </div>
          </div>
        </section>

        {/* Support Options */}
        <section className="py-12 bg-background">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
              {supportOptions.map((option) => (
                <Card key={option.title} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <option.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{option.title}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="gap-2">
                      <a href={option.href}>
                        {option.action}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-bold text-center mb-8">
                Perguntas Frequentes
              </h2>
              <Accordion type="single" collapsible className="space-y-4">
                {faqItems.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="bg-background rounded-lg border px-6"
                  >
                    <AccordionTrigger className="text-left hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-background">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold">Ainda tem duvidas?</h2>
              <p className="mt-2 text-muted-foreground">
                Nossa equipe esta pronta para ajudar voce a comecar.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg">
                  <Link to="/auth">Criar conta gratis</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="mailto:suporte@ecomfinance.com">Falar com suporte</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
