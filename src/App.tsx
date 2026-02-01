import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Fechamento from "./pages/Fechamento";
import FluxoCaixa from "./pages/FluxoCaixa";
import DRE from "./pages/DRE";
import Balanco from "./pages/Balanco";
import KPIs from "./pages/KPIs";
import Projecoes from "./pages/Projecoes";
import ICMS from "./pages/ICMS";
import Conciliacao from "./pages/Conciliacao";
import ChecklistFechamento from "./pages/ChecklistFechamento";
import Produtos from "./pages/Produtos";
import ProdutosImportExport from "./pages/ProdutosImportExport";
import EstoqueSKU from "./pages/EstoqueSKU";
import Compras from "./pages/Compras";
import ContasPagar from "./pages/ContasPagar";
import ContasReceber from "./pages/ContasReceber";
import Fornecedores from "./pages/Fornecedores";
import Precificacao from "./pages/Precificacao";
import CartaoCredito from "./pages/CartaoCredito";
import CentrosCusto from "./pages/CentrosCusto";
import PlanoContas from "./pages/PlanoContas";
import RegrasCategorizacao from "./pages/RegrasCategorizacao";
import RegrasMarketplace from "./pages/RegrasMarketplace";
import MapeamentosMarketplace from "./pages/MapeamentosMarketplace";
import Empresas from "./pages/Empresas";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import AssistantCenter from "./pages/AssistantCenter";
import MovimentosManuais from "./pages/MovimentosManuais";
import CMVRelatorio from "./pages/CMVRelatorio";
import Auth from "./pages/Auth";
import Perfil from "./pages/Perfil";
import Planos from "./pages/Planos";
import Integracoes from "./pages/Integracoes";
import PatrimonioImobilizado from "./pages/PatrimonioImobilizado";
import Vendas from "./pages/Vendas";
import Recursos from "./pages/Recursos";
import Ajuda from "./pages/Ajuda";
import NotFound from "./pages/NotFound";
import { AssistantWidget } from "./components/assistant/AssistantWidget";
import { AssistantChatProvider } from "./contexts/AssistantChatContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <EmpresaProvider>
          <AssistantChatProvider>
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
          </AssistantChatProvider>
        </EmpresaProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
