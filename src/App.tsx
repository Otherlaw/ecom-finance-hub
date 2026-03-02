import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AssistantChatProvider } from "./contexts/AssistantChatContext";
import { lazy, Suspense, type ComponentType } from "react";
import { OnboardingBlocker } from "./components/onboarding/OnboardingBlocker";

// Eagerly loaded (public/critical)
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

type LazyModule = { default: ComponentType<object> };

const lazyWithRetry = (importer: () => Promise<LazyModule>, key: string) =>
  lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(`lazy-retry:${key}`);
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const storageKey = `lazy-retry:${key}`;
      const hasRetried = sessionStorage.getItem(storageKey) === "1";

      if (!hasRetried && message.includes("Failed to fetch dynamically imported module")) {
        sessionStorage.setItem(storageKey, "1");
        window.location.reload();
      }

      throw error;
    }
  });

// Lazy loaded pages
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard") as Promise<LazyModule>, "Dashboard");
const Fechamento = lazyWithRetry(() => import("./pages/Fechamento") as Promise<LazyModule>, "Fechamento");
const FluxoCaixa = lazyWithRetry(() => import("./pages/FluxoCaixa") as Promise<LazyModule>, "FluxoCaixa");
const DRE = lazyWithRetry(() => import("./pages/DRE") as Promise<LazyModule>, "DRE");
const Balanco = lazyWithRetry(() => import("./pages/Balanco") as Promise<LazyModule>, "Balanco");
const KPIs = lazyWithRetry(() => import("./pages/KPIs") as Promise<LazyModule>, "KPIs");
const Projecoes = lazyWithRetry(() => import("./pages/Projecoes") as Promise<LazyModule>, "Projecoes");
const ICMS = lazyWithRetry(() => import("./pages/ICMS") as Promise<LazyModule>, "ICMS");
const Conciliacao = lazyWithRetry(() => import("./pages/Conciliacao") as Promise<LazyModule>, "Conciliacao");
const ChecklistFechamento = lazyWithRetry(() => import("./pages/ChecklistFechamento") as Promise<LazyModule>, "ChecklistFechamento");
const Produtos = lazyWithRetry(() => import("./pages/Produtos") as Promise<LazyModule>, "Produtos");
const ProdutosImportExport = lazyWithRetry(() => import("./pages/ProdutosImportExport") as Promise<LazyModule>, "ProdutosImportExport");
const EstoqueSKU = lazyWithRetry(() => import("./pages/EstoqueSKU") as Promise<LazyModule>, "EstoqueSKU");
const Compras = lazyWithRetry(() => import("./pages/Compras") as Promise<LazyModule>, "Compras");
const ContasPagar = lazyWithRetry(() => import("./pages/ContasPagar") as Promise<LazyModule>, "ContasPagar");
const ContasReceber = lazyWithRetry(() => import("./pages/ContasReceber") as Promise<LazyModule>, "ContasReceber");
const Fornecedores = lazyWithRetry(() => import("./pages/Fornecedores") as Promise<LazyModule>, "Fornecedores");
const Precificacao = lazyWithRetry(() => import("./pages/Precificacao") as Promise<LazyModule>, "Precificacao");
const CartaoCredito = lazyWithRetry(() => import("./pages/CartaoCredito") as Promise<LazyModule>, "CartaoCredito");
const CentrosCusto = lazyWithRetry(() => import("./pages/CentrosCusto") as Promise<LazyModule>, "CentrosCusto");
const PlanoContas = lazyWithRetry(() => import("./pages/PlanoContas") as Promise<LazyModule>, "PlanoContas");
const RegrasCategorizacao = lazyWithRetry(() => import("./pages/RegrasCategorizacao") as Promise<LazyModule>, "RegrasCategorizacao");
const RegrasMarketplace = lazyWithRetry(() => import("./pages/RegrasMarketplace") as Promise<LazyModule>, "RegrasMarketplace");
const MapeamentosMarketplace = lazyWithRetry(() => import("./pages/MapeamentosMarketplace") as Promise<LazyModule>, "MapeamentosMarketplace");
const Empresas = lazyWithRetry(() => import("./pages/Empresas") as Promise<LazyModule>, "Empresas");
const Usuarios = lazyWithRetry(() => import("./pages/Usuarios") as Promise<LazyModule>, "Usuarios");
const Configuracoes = lazyWithRetry(() => import("./pages/Configuracoes") as Promise<LazyModule>, "Configuracoes");
const AssistantCenter = lazyWithRetry(() => import("./pages/AssistantCenter") as Promise<LazyModule>, "AssistantCenter");
const MovimentosManuais = lazyWithRetry(() => import("./pages/MovimentosManuais") as Promise<LazyModule>, "MovimentosManuais");
const CMVRelatorio = lazyWithRetry(() => import("./pages/CMVRelatorio") as Promise<LazyModule>, "CMVRelatorio");
const Perfil = lazyWithRetry(() => import("./pages/Perfil") as Promise<LazyModule>, "Perfil");
const Planos = lazyWithRetry(() => import("./pages/Planos") as Promise<LazyModule>, "Planos");
const Integracoes = lazyWithRetry(() => import("./pages/Integracoes") as Promise<LazyModule>, "Integracoes");
const PatrimonioImobilizado = lazyWithRetry(() => import("./pages/PatrimonioImobilizado") as Promise<LazyModule>, "PatrimonioImobilizado");
const Vendas = lazyWithRetry(() => import("./pages/Vendas") as Promise<LazyModule>, "Vendas");
const Recursos = lazyWithRetry(() => import("./pages/Recursos") as Promise<LazyModule>, "Recursos");
const Ajuda = lazyWithRetry(() => import("./pages/Ajuda") as Promise<LazyModule>, "Ajuda");

// Lazy loaded widget
const AssistantWidget = lazyWithRetry(
  () => import("./components/assistant/AssistantWidget").then((m) => ({ default: m.AssistantWidget })) as Promise<LazyModule>,
  "AssistantWidget"
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <EmpresaProvider>
          <AssistantChatProvider>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
              <Routes>
                {/* Rotas públicas */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/planos" element={<Planos />} />
                <Route path="/recursos" element={<Recursos />} />
                <Route path="/ajuda" element={<Ajuda />} />
                
                {/* Rotas protegidas */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/vendas" element={<ProtectedRoute><OnboardingBlocker><Vendas /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
                <Route path="/fechamento" element={<ProtectedRoute><OnboardingBlocker><Fechamento /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/fluxo-caixa" element={<ProtectedRoute><OnboardingBlocker><FluxoCaixa /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/dre" element={<ProtectedRoute><OnboardingBlocker><DRE /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/balanco" element={<ProtectedRoute><OnboardingBlocker><Balanco /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/patrimonio" element={<ProtectedRoute><OnboardingBlocker><PatrimonioImobilizado /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/kpis" element={<ProtectedRoute><OnboardingBlocker><KPIs /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/projecoes" element={<ProtectedRoute><OnboardingBlocker><Projecoes /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/icms" element={<ProtectedRoute><OnboardingBlocker><ICMS /></OnboardingBlocker></ProtectedRoute>} />
                <Route path="/conciliacao" element={<ProtectedRoute><Conciliacao /></ProtectedRoute>} />
                <Route path="/checklist-fechamento" element={<ProtectedRoute><ChecklistFechamento /></ProtectedRoute>} />
                <Route path="/produtos" element={<ProtectedRoute><Produtos /></ProtectedRoute>} />
                <Route path="/produtos/import-export" element={<ProtectedRoute><ProdutosImportExport /></ProtectedRoute>} />
                <Route path="/estoque-sku" element={<ProtectedRoute><EstoqueSKU /></ProtectedRoute>} />
                <Route path="/cmv" element={<ProtectedRoute><CMVRelatorio /></ProtectedRoute>} />
                <Route path="/compras" element={<ProtectedRoute><Compras /></ProtectedRoute>} />
                <Route path="/contas-pagar" element={<ProtectedRoute><ContasPagar /></ProtectedRoute>} />
                <Route path="/contas-receber" element={<ProtectedRoute><ContasReceber /></ProtectedRoute>} />
                <Route path="/fornecedores" element={<ProtectedRoute><Fornecedores /></ProtectedRoute>} />
                <Route path="/precificacao" element={<ProtectedRoute><Precificacao /></ProtectedRoute>} />
                <Route path="/cartao-credito" element={<ProtectedRoute><CartaoCredito /></ProtectedRoute>} />
                <Route path="/centros-custo" element={<ProtectedRoute><CentrosCusto /></ProtectedRoute>} />
                <Route path="/plano-contas" element={<ProtectedRoute><PlanoContas /></ProtectedRoute>} />
                <Route path="/regras-categorizacao" element={<ProtectedRoute><RegrasCategorizacao /></ProtectedRoute>} />
                <Route path="/regras-marketplace" element={<ProtectedRoute><RegrasMarketplace /></ProtectedRoute>} />
                <Route path="/mapeamentos-marketplace" element={<ProtectedRoute><MapeamentosMarketplace /></ProtectedRoute>} />
                <Route path="/assistant" element={<ProtectedRoute><AssistantCenter /></ProtectedRoute>} />
                <Route path="/movimentos-manuais" element={<ProtectedRoute><MovimentosManuais /></ProtectedRoute>} />
                <Route path="/movimentacoes-manuais" element={<ProtectedRoute><MovimentosManuais /></ProtectedRoute>} />
                <Route path="/empresas" element={<ProtectedRoute><Empresas /></ProtectedRoute>} />
                <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
                <Route path="/integracoes" element={<ProtectedRoute><Integracoes /></ProtectedRoute>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              <AssistantWidget />
            </Suspense>
          </AssistantChatProvider>
        </EmpresaProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
