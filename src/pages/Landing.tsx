import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import logoEcomFinance from "@/assets/logo-ecom-finance-new.png";
import { 
  CalendarCheck, 
  RefreshCw, 
  Receipt, 
  BarChart3, 
  Building2, 
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
  BookOpen,
  Video,
  FileText,
  Download,
  HelpCircle,
  ChevronRight,
  Sparkles,
  GraduationCap
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: CalendarCheck,
      title: "Fechamento Mensal",
      description: "Automatize seu fechamento financeiro com precisão e rastreabilidade completa."
    },
    {
      icon: RefreshCw,
      title: "Conciliação Marketplace",
      description: "Concilie repasses, taxas e comissões de todos os marketplaces em um só lugar."
    },
    {
      icon: Receipt,
      title: "Ads, Taxas e Tarifas",
      description: "Controle total sobre custos de anúncios, tarifas fixas e comissões por pedido."
    },
    {
      icon: BarChart3,
      title: "CMV & Margem Real",
      description: "Calcule o custo de mercadoria vendida e margem de contribuição por pedido."
    },
    {
      icon: Building2,
      title: "Multi-contas & Multi-CNPJ",
      description: "Gerencie múltiplas contas de marketplace e empresas em um único painel."
    },
    {
      icon: TrendingUp,
      title: "Dashboards Inteligentes",
      description: "Visualize seu lucro real com dashboards dinâmicos e relatórios detalhados."
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Conecte seus canais",
      description: "Integre suas contas do Mercado Livre, Shopee, Amazon e outros marketplaces."
    },
    {
      number: "02",
      title: "Importe seus dados",
      description: "Importe extratos, relatórios e deixe o sistema organizar automaticamente."
    },
    {
      number: "03",
      title: "Veja seu lucro real",
      description: "Acesse dashboards com margem de contribuição, CMV e resultado por canal."
    }
  ];

  const marketplaces = [
    "Mercado Livre",
    "Shopee",
    "Amazon",
    "Magalu",
    "Americanas",
    "TikTok Shop"
  ];

  const resources = [
    {
      icon: BookOpen,
      title: "Blog & Artigos",
      description: "Conteúdo educativo sobre gestão financeira de e-commerce, tendências e melhores práticas.",
      badge: "Novo",
      link: "#"
    },
    {
      icon: GraduationCap,
      title: "Tutoriais & Guias",
      description: "Passo a passo completo de como usar cada funcionalidade do sistema.",
      badge: "Popular",
      link: "#"
    },
    {
      icon: Video,
      title: "Webinars & Vídeos",
      description: "Aulas ao vivo e gravadas sobre fechamento financeiro e gestão de marketplace.",
      badge: "",
      link: "#"
    },
    {
      icon: Download,
      title: "Templates & Downloads",
      description: "Planilhas, checklists e materiais gratuitos para organizar suas finanças.",
      badge: "Grátis",
      link: "#"
    }
  ];

  const faqs = [
    {
      question: "Como funciona o período de teste gratuito?",
      answer: "Você pode usar o ECOM Finance gratuitamente com até 100 transações por mês. Para operações maiores, oferecemos 14 dias de teste grátis em qualquer plano pago."
    },
    {
      question: "Quais marketplaces são compatíveis?",
      answer: "Atualmente suportamos Mercado Livre, Shopee, Amazon, Magalu, Americanas e TikTok Shop. Estamos constantemente adicionando novos canais."
    },
    {
      question: "Meus dados estão seguros?",
      answer: "Sim! Utilizamos criptografia de ponta a ponta, infraestrutura em nuvem segura e seguimos as melhores práticas de segurança do mercado."
    },
    {
      question: "Posso gerenciar múltiplas empresas?",
      answer: "Sim! Dependendo do seu plano, você pode gerenciar de 1 até empresas ilimitadas, cada uma com seus próprios CNPJs e contas de marketplace."
    },
    {
      question: "Como funciona a conciliação de repasses?",
      answer: "O sistema importa seus dados de vendas e repasses, identificando automaticamente divergências entre o que foi vendido e o que foi recebido."
    },
    {
      question: "Preciso de conhecimento contábil?",
      answer: "Não! O ECOM Finance foi desenvolvido para sellers, não contadores. Interface intuitiva com termos simples e relatórios visuais."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoEcomFinance} alt="ECOM Finance" className="h-10" />
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#recursos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#como-funciona" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Como funciona
            </a>
            <a href="#materiais" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Materiais
            </a>
            <button 
              onClick={() => navigate("/planos")} 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Planos
            </button>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Ajuda
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/planos")}>
              Ver Planos
            </Button>
            <Button onClick={() => navigate("/auth")} className="gap-2">
              Entrar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            Fechamento financeiro simplificado
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
            Descubra seu{" "}
            <span className="text-primary">lucro real</span>{" "}
            em marketplaces
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Sistema completo de fechamento financeiro para e-commerce. 
            Conciliação, CMV, margem de contribuição e dashboards — tudo em um só lugar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 h-12 px-8 text-base">
              Começar gratuitamente
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 h-12 px-8 text-base" asChild>
              <a href="#como-funciona">
                Ver demonstração
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Social Proof - Marketplaces */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Compatível com os principais marketplaces do Brasil
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            {marketplaces.map((marketplace) => (
              <div
                key={marketplace}
                className="px-4 py-2 rounded-lg bg-background border text-sm font-medium text-muted-foreground"
              >
                {marketplace}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa para o fechamento
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas poderosas para controlar cada centavo do seu e-commerce
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="como-funciona" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Como funciona
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Em 3 passos simples você terá controle total do seu financeiro
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-px bg-border" />
                )}
                <div className="relative bg-background rounded-xl p-6 border text-center">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="seguranca" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-sm font-medium mb-4">
                  <Shield className="h-4 w-4" />
                  Segurança garantida
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Seus dados protegidos
                </h2>
                <p className="text-muted-foreground mb-6">
                  Utilizamos criptografia de ponta e infraestrutura segura para garantir 
                  que seus dados financeiros estejam sempre protegidos.
                </p>
                <ul className="space-y-3">
                  {[
                    "Criptografia SSL/TLS em todas as conexões",
                    "Dados armazenados com segurança em nuvem",
                    "Acesso controlado por autenticação segura",
                    "Backups automáticos diários"
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                <div className="w-64 h-64 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Shield className="h-24 w-24 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section id="materiais" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              Recursos Exclusivos
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Aprenda e evolua seu negócio
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Conteúdos gratuitos para você dominar a gestão financeira do seu e-commerce
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {resources.map((resource) => (
              <Card key={resource.title} className="group hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <resource.icon className="h-6 w-6 text-primary" />
                    </div>
                    {resource.badge && (
                      <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        {resource.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{resource.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{resource.description}</p>
                  <div className="flex items-center text-primary text-sm font-medium group-hover:gap-2 transition-all">
                    Acessar <ChevronRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-sm font-medium mb-4">
              <HelpCircle className="h-4 w-4" />
              Central de Ajuda
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tire suas dúvidas sobre o ECOM Finance
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border rounded-lg px-6 bg-card"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <span className="font-medium">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-8 text-center">
              <p className="text-muted-foreground mb-4">Ainda tem dúvidas?</p>
              <Button variant="outline" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Falar com Suporte
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-primary/5 via-background to-purple-500/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o plano ideal para seu negócio
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Comece gratuitamente e escale conforme sua operação cresce. 
              Cancele a qualquer momento.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/planos")} className="gap-2 h-12 px-8 text-base">
                Ver todos os planos
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="h-12 px-8 text-base">
                Começar grátis
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para descobrir seu lucro real?
          </h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
            Junte-se a centenas de vendedores que já usam o ECOM Finance 
            para ter controle total do seu e-commerce.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate("/auth")} 
            className="gap-2 h-12 px-8 text-base"
          >
            Acessar agora
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a></li>
                <li><button onClick={() => navigate("/planos")} className="hover:text-foreground transition-colors">Planos</button></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrações</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Atualizações</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Tutoriais</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Webinars</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Templates</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Cookies</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">LGPD</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoEcomFinance} alt="ECOM Finance" className="h-8" />
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ECOM Finance. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
