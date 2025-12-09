import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import OAuthCallback from "./pages/OAuthCallback";
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
        <AssistantChatProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/fechamento" element={<Fechamento />} />
            <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
            <Route path="/dre" element={<DRE />} />
            <Route path="/balanco" element={<Balanco />} />
            <Route path="/kpis" element={<KPIs />} />
            <Route path="/projecoes" element={<Projecoes />} />
            <Route path="/icms" element={<ICMS />} />
            <Route path="/conciliacao" element={<Conciliacao />} />
            <Route path="/checklist-fechamento" element={<ChecklistFechamento />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/produtos/import-export" element={<ProdutosImportExport />} />
            <Route path="/estoque-sku" element={<EstoqueSKU />} />
            <Route path="/cmv" element={<CMVRelatorio />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/contas-pagar" element={<ContasPagar />} />
            <Route path="/contas-receber" element={<ContasReceber />} />
            <Route path="/fornecedores" element={<Fornecedores />} />
            <Route path="/precificacao" element={<Precificacao />} />
            <Route path="/cartao-credito" element={<CartaoCredito />} />
            <Route path="/centros-custo" element={<CentrosCusto />} />
            <Route path="/plano-contas" element={<PlanoContas />} />
            <Route path="/regras-categorizacao" element={<RegrasCategorizacao />} />
            <Route path="/regras-marketplace" element={<RegrasMarketplace />} />
            <Route path="/mapeamentos-marketplace" element={<MapeamentosMarketplace />} />
            <Route path="/assistant" element={<AssistantCenter />} />
            <Route path="/movimentos-manuais" element={<MovimentosManuais />} />
            <Route path="/movimentacoes-manuais" element={<MovimentosManuais />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/integracoes" element={<Integracoes />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AssistantWidget />
        </AssistantChatProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
