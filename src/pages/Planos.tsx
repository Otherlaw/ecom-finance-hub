import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, ArrowLeft, CreditCard, Zap, Building2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import logoEcomFinance from '@/assets/logo-ecom-finance-new.png';

interface PricingFeature {
  text: string;
  hasInfo?: boolean;
}

interface PricingTier {
  name: string;
  description: string;
  price?: number;
  priceLabel?: string;
  billingPeriod?: string;
  buttonText: string;
  buttonVariant?: 'default' | 'secondary' | 'outline';
  isPrimary?: boolean;
  features: PricingFeature[];
  hasAnnualToggle?: boolean;
  creditOptions?: string[];
  defaultCredits?: string;
  featuresTitle?: string;
  icon: React.ReactNode;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    description: 'Para quem está começando no e-commerce e quer organizar as finanças',
    price: 0,
    billingPeriod: 'por mês',
    buttonText: 'Começar Grátis',
    icon: <Zap className="w-6 h-6 text-emerald-500" />,
    features: [
      { text: '1 empresa cadastrada' },
      { text: 'Até 100 transações/mês' },
      { text: 'DRE básico' },
      { text: 'Fluxo de caixa simples' },
      { text: 'Suporte por e-mail' },
    ],
    featuresTitle: 'Inclui:',
  },
  {
    name: 'Pro',
    description: 'Para sellers que precisam de controle financeiro completo',
    price: 97,
    billingPeriod: 'por mês',
    buttonText: 'Assinar Pro',
    isPrimary: true,
    hasAnnualToggle: true,
    icon: <CreditCard className="w-6 h-6 text-purple-500" />,
    creditOptions: ['1.000 transações/mês', '5.000 transações/mês', '10.000 transações/mês'],
    defaultCredits: '1.000 transações/mês',
    featuresTitle: 'Tudo do Starter, mais:',
    features: [
      { text: 'Até 3 empresas', hasInfo: true },
      { text: 'Transações ilimitadas' },
      { text: 'DRE completo com comparativos' },
      { text: 'Balanço patrimonial' },
      { text: 'Controle de ICMS' },
      { text: 'Importação de NF-e XML' },
      { text: 'Conciliação de marketplaces' },
      { text: 'Suporte prioritário' },
    ],
  },
  {
    name: 'Business',
    description: 'Para operações com múltiplas lojas e equipes financeiras',
    price: 247,
    billingPeriod: 'por mês',
    buttonText: 'Assinar Business',
    hasAnnualToggle: true,
    icon: <Building2 className="w-6 h-6 text-blue-500" />,
    creditOptions: ['10.000 transações/mês', '50.000 transações/mês', 'Ilimitado'],
    defaultCredits: '10.000 transações/mês',
    featuresTitle: 'Tudo do Pro, mais:',
    features: [
      { text: 'Empresas ilimitadas', hasInfo: true },
      { text: 'Múltiplos usuários' },
      { text: 'Projeções financeiras avançadas' },
      { text: 'KPIs personalizados' },
      { text: 'Regras de categorização automáticas' },
      { text: 'Relatórios personalizados' },
      { text: 'API de integração' },
    ],
  },
  {
    name: 'Enterprise',
    description: 'Soluções customizadas para grandes operações de e-commerce',
    priceLabel: 'Sob consulta',
    buttonText: 'Falar com Vendas',
    icon: <Crown className="w-6 h-6 text-amber-500" />,
    featuresTitle: 'Tudo do Business, mais:',
    features: [
      { text: 'Suporte dedicado 24/7' },
      { text: 'Onboarding personalizado' },
      { text: 'Integrações customizadas' },
      { text: 'SLA garantido' },
      { text: 'Treinamento para equipe' },
      { text: 'Consultoria financeira' },
    ],
  },
];

export default function Planos() {
  const navigate = useNavigate();
  const [annualBilling, setAnnualBilling] = useState<Record<string, boolean>>({});
  const [selectedCredits, setSelectedCredits] = useState<Record<string, string>>({});

  const handleSelectPlan = (tierName: string) => {
    // Aqui seria integrado com Stripe ou sistema de pagamento
    console.log('Plano selecionado:', tierName);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src={logoEcomFinance} alt="ECOM Finance" className="h-8" />
          </div>
          <Button variant="outline" onClick={() => navigate('/auth')}>
            Entrar
          </Button>
        </div>
      </header>

      <div className="w-full py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 relative">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <defs>
                    <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#dc2626" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                    fill="url(#heartGradient)"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">
              Escolha o plano ideal para seu e-commerce
            </h1>
            <p className="text-muted-foreground text-lg text-balance max-w-2xl mx-auto">
              Comece gratuitamente e escale conforme sua operação cresce. Todos os planos incluem atualizações e novas funcionalidades.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {tiers.map((tier, index) => (
              <Card
                key={index}
                className={cn(
                  'bg-card border-border p-6 flex flex-col transition-all hover:shadow-lg',
                  tier.isPrimary && 'ring-2 ring-purple-500 shadow-purple-500/20 shadow-lg'
                )}
              >
                {/* Tier Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {tier.icon}
                    </div>
                    {tier.isPrimary && (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-full">
                        Mais Popular
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{tier.name}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">{tier.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {tier.price !== undefined ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <span className="text-5xl font-bold">
                        {annualBilling[tier.name] ? Math.round(tier.price * 0.8) : tier.price}
                      </span>
                      <span className="text-muted-foreground">{tier.billingPeriod}</span>
                    </div>
                  ) : (
                    <div className="text-xl font-semibold">{tier.priceLabel}</div>
                  )}
                  {tier.hasAnnualToggle && annualBilling[tier.name] && (
                    <p className="text-sm text-green-500 mt-1">Economize 20% no plano anual</p>
                  )}
                </div>

                {/* Annual Toggle */}
                {tier.hasAnnualToggle && (
                  <div className="mb-6 flex items-center gap-3">
                    <button
                      onClick={() =>
                        setAnnualBilling((prev) => ({
                          ...prev,
                          [tier.name]: !prev[tier.name],
                        }))
                      }
                      className={cn(
                        'w-11 h-6 rounded-full relative transition-colors',
                        annualBilling[tier.name] ? 'bg-purple-500' : 'bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm',
                          annualBilling[tier.name] && 'translate-x-5'
                        )}
                      />
                    </button>
                    <span className="text-sm text-foreground">Anual</span>
                  </div>
                )}

                {/* CTA Button */}
                <Button
                  className={cn(
                    'w-full mb-6',
                    tier.isPrimary
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border'
                  )}
                  variant={tier.buttonVariant || 'default'}
                  onClick={() => handleSelectPlan(tier.name)}
                >
                  {tier.buttonText}
                </Button>

                {/* Credit Options */}
                {tier.creditOptions && tier.creditOptions.length > 0 && (
                  <div className="mb-6">
                    <Select
                      value={selectedCredits[tier.name] || tier.defaultCredits || tier.creditOptions[0]}
                      onValueChange={(value) =>
                        setSelectedCredits((prev) => ({
                          ...prev,
                          [tier.name]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full bg-secondary border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        {tier.creditOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className="focus:bg-accent focus:text-accent-foreground"
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Features Title */}
                {tier.featuresTitle && (
                  <div className="mb-4 text-sm font-medium text-foreground">{tier.featuresTitle}</div>
                )}

                {/* Features List */}
                <div className="space-y-3 flex-1">
                  {tier.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground leading-relaxed flex-1">{feature.text}</span>
                      {feature.hasInfo && <Info className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Footer Banner */}
          <Card className="bg-card border-border p-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold mb-2">🎓 Desconto para Estudantes e MEIs</h3>
              <p className="text-muted-foreground text-sm">
                Comprove seu status e ganhe até 50% de desconto no plano Pro.
              </p>
            </div>
            <Button
              variant="outline"
              className="bg-transparent border-border text-foreground hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
            >
              Saiba mais
            </Button>
          </Card>

          {/* FAQ Section */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Perguntas Frequentes</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Posso trocar de plano depois?</h3>
                <p className="text-sm text-muted-foreground">
                  Sim! Você pode fazer upgrade ou downgrade a qualquer momento. O valor será calculado proporcionalmente.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Como funciona o período de teste?</h3>
                <p className="text-sm text-muted-foreground">
                  Todos os planos pagos incluem 14 dias de teste grátis. Cancele a qualquer momento sem compromisso.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Quais formas de pagamento aceitam?</h3>
                <p className="text-sm text-muted-foreground">
                  Aceitamos cartão de crédito, PIX e boleto bancário. Planos anuais podem ser parcelados em até 12x.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Meus dados estão seguros?</h3>
                <p className="text-sm text-muted-foreground">
                  Sim! Utilizamos criptografia de ponta a ponta e seguimos as melhores práticas de segurança do mercado.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
