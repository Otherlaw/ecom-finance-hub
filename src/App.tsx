import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AssistantChatProvider } from "./contexts/AssistantChatContext";
import { lazy, Suspense } from "react";

// Eagerly loaded (public/critical)
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Fechamento = lazy(() => import("./pages/Fechamento"));
const FluxoCaixa = lazy(() => import("./pages/FluxoCaixa"));
const DRE = lazy(() => import("./pages/DRE"));
const Balanco = lazy(() => import("./pages/Balanco"));
const KPIs = lazy(() => import("./pages/KPIs"));
const Projecoes = lazy(() => import("./pages/Projecoes"));
const ICMS = lazy(() => import("./pages/ICMS"));
const Conciliacao = lazy(() => import("./pages/Conciliacao"));
const ChecklistFechamento = lazy(() => import("./pages/ChecklistFechamento"));
const Produtos = lazy(() => import("./pages/Produtos"));
const ProdutosImportExport = lazy(() => import("./pages/ProdutosImportExport"));
const EstoqueSKU = lazy(() => import("./pages/EstoqueSKU"));
const Compras = lazy(() => import("./pages/Compras"));
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const ContasReceber = lazy(() => import("./pages/ContasReceber"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const Precificacao = lazy(() => import("./pages/Precificacao"));
const CartaoCredito = lazy(() => import("./pages/CartaoCredito"));
const CentrosCusto = lazy(() => import("./pages/CentrosCusto"));
const PlanoContas = lazy(() => import("./pages/PlanoContas"));
const RegrasCategorizacao = lazy(() => import("./pages/RegrasCategorizacao"));
const RegrasMarketplace = lazy(() => import("./pages/RegrasMarketplace"));
const MapeamentosMarketplace = lazy(() => import("./pages/MapeamentosMarketplace"));
const Empresas = lazy(() => import("./pages/Empresas"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const AssistantCenter = lazy(() => import("./pages/AssistantCenter"));
const MovimentosManuais = lazy(() => import("./pages/MovimentosManuais"));
const CMVRelatorio = lazy(() => import("./pages/CMVRelatorio"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Planos = lazy(() => import("./pages/Planos"));
const Integracoes = lazy(() => import("./pages/Integracoes"));
const PatrimonioImobilizado = lazy(() => import("./pages/PatrimonioImobilizado"));
const Vendas = lazy(() => import("./pages/Vendas"));
const Recursos = lazy(() => import("./pages/Recursos"));
const Ajuda = lazy(() => import("./pages/Ajuda"));

// Lazy loaded widget
const AssistantWidget = lazy(() => import("./components/assistant/AssistantWidget").then(m => ({ default: m.AssistantWidget })));

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
                <Route path="/vendas" element={<ProtectedRoute><Vendas /></ProtectedRoute>} />
                <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
                <Route path="/fechamento" element={<ProtectedRoute><Fechamento /></ProtectedRoute>} />
                <Route path="/fluxo-caixa" element={<ProtectedRoute><FluxoCaixa /></ProtectedRoute>} />
                <Route path="/dre" element={<ProtectedRoute><DRE /></ProtectedRoute>} />
                <Route path="/balanco" element={<ProtectedRoute><Balanco /></ProtectedRoute>} />
                <Route path="/patrimonio" element={<ProtectedRoute><PatrimonioImobilizado /></ProtectedRoute>} />
                <Route path="/kpis" element={<ProtectedRoute><KPIs /></ProtectedRoute>} />
                <Route path="/projecoes" element={<ProtectedRoute><Projecoes /></ProtectedRoute>} />
                <Route path="/icms" element={<ProtectedRoute><ICMS /></ProtectedRoute>} />
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
