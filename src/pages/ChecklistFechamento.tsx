import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { ChecklistFilters } from "@/components/checklist/ChecklistFilters";
import { ChannelCard } from "@/components/checklist/ChannelCard";
import { ChecklistDetailReal } from "@/components/checklist/ChecklistDetailReal";
import { ConsolidatedView } from "@/components/checklist/ConsolidatedView";
import { CriarChecklistModal } from "@/components/checklist/CriarChecklistModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canaisMarketplace, getMesNome } from "@/lib/checklist-data";
import { useChecklistsCanal, ChecklistCanalComItens, calcularProgressoChecklist, determinarStatusChecklist } from "@/hooks/useChecklistsCanal";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { toast } from "@/hooks/use-toast";
import { ClipboardCheck, LayoutGrid, Building2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChecklistFechamento() {
  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { userEmpresas } = useUserEmpresas();
  
  // Estado inicial: primeira empresa do usuário
  const [empresaId, setEmpresaId] = useState<string>("");
  const [canalId, setCanalId] = useState<string>("todos");
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistCanalComItens | null>(null);
  const [activeTab, setActiveTab] = useState<string>("canais");
  const [showCriarModal, setShowCriarModal] = useState(false);
  const [canalParaCriar, setCanalParaCriar] = useState<string>("");

  // Definir empresa inicial quando carregar
  useEffect(() => {
    if (!empresaId && userEmpresas && userEmpresas.length > 0) {
      setEmpresaId(userEmpresas[0].empresa_id);
    } else if (!empresaId && empresas && empresas.length > 0) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresas, userEmpresas, empresaId]);

  // Hook de checklists
  const { 
    checklists, 
    isLoading, 
    refetch,
    buscarChecklistCompleto,
  } = useChecklistsCanal({ empresaId, mes, ano });

  // Empresa selecionada
  const empresaSelecionada = useMemo(
    () => empresas?.find((e) => e.id === empresaId),
    [empresas, empresaId]
  );

  // Canais disponíveis (todos os canais ativos)
  const canaisDisponiveis = useMemo(
    () => canaisMarketplace.filter((c) => c.ativo),
    []
  );

  // Carregar checklist completo quando selecionado
  useEffect(() => {
    const carregarChecklist = async () => {
      if (selectedChecklistId) {
        const checklistCompleto = await buscarChecklistCompleto(selectedChecklistId);
        setSelectedChecklist(checklistCompleto);
      } else {
        setSelectedChecklist(null);
      }
    };
    carregarChecklist();
  }, [selectedChecklistId, buscarChecklistCompleto]);

  // Abrir modal de criação para canal específico
  const handleCriarChecklist = (canalIdParam?: string) => {
    setCanalParaCriar(canalIdParam || "");
    setShowCriarModal(true);
  };

  // Callback após criar checklist
  const handleChecklistCriado = (novoChecklistId: string) => {
    setSelectedChecklistId(novoChecklistId);
    refetch();
  };

  // Voltar para lista
  const handleVoltar = () => {
    setSelectedChecklistId(null);
    setSelectedChecklist(null);
    refetch();
  };

  // Buscar checklist de um canal
  const getChecklistDoCanal = (cId: string) => {
    return checklists.find((c) => c.canal_id === cId);
  };

  // Se um checklist está selecionado, mostrar detalhes
  if (selectedChecklist) {
    return (
      <MainLayout
        title="Checklist de Fechamento"
        subtitle="Gerenciamento de etapas por canal"
      >
        <ChecklistDetailReal
          checklist={selectedChecklist}
          onBack={handleVoltar}
          onRefresh={() => {
            // Recarregar o checklist após alterações
            buscarChecklistCompleto(selectedChecklist.id).then(setSelectedChecklist);
          }}
        />
      </MainLayout>
    );
  }

  // Loading enquanto carrega checklist selecionado
  if (selectedChecklistId && !selectedChecklist) {
    return (
      <MainLayout
        title="Checklist de Fechamento"
        subtitle="Carregando..."
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Checklist de Fechamento por Canal"
      subtitle="Controle de etapas do fechamento mensal por marketplace"
    >
      {/* Filtros */}
      <ChecklistFilters
        empresaId={empresaId}
        canalId={canalId}
        mes={mes}
        ano={ano}
        onEmpresaChange={setEmpresaId}
        onCanalChange={setCanalId}
        onMesChange={setMes}
        onAnoChange={setAno}
        onCriarChecklist={() => handleCriarChecklist()}
        showCriarButton={true}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="canais" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Por Canal
          </TabsTrigger>
          <TabsTrigger value="consolidado" className="gap-2">
            <Building2 className="h-4 w-4" />
            Visão Consolidada
          </TabsTrigger>
        </TabsList>

        {/* Visão por Canal */}
        <TabsContent value="canais" className="mt-6">
          {isLoading || loadingEmpresas ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[200px] rounded-xl" />
              ))}
            </div>
          ) : canalId !== "todos" ? (
            // Canal específico selecionado
            (() => {
              const canal = canaisMarketplace.find((c) => c.id === canalId);
              const checklist = getChecklistDoCanal(canalId);

              if (!canal) return null;

              return (
                <div className="max-w-md">
                  <ChannelCard
                    canal={canal}
                    checklistReal={checklist}
                    onClick={() => checklist && setSelectedChecklistId(checklist.id)}
                    onCriar={() => handleCriarChecklist(canalId)}
                  />
                </div>
              );
            })()
          ) : (
            // Todos os canais
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {canaisDisponiveis.map((canal) => {
                const checklist = getChecklistDoCanal(canal.id);

                return (
                  <ChannelCard
                    key={canal.id}
                    canal={canal}
                    checklistReal={checklist}
                    onClick={() => checklist && setSelectedChecklistId(checklist.id)}
                    onCriar={() => handleCriarChecklist(canal.id)}
                  />
                );
              })}
            </div>
          )}

          {canaisDisponiveis.length === 0 && !isLoading && (
            <ModuleCard title="Nenhum canal disponível" icon={ClipboardCheck}>
              <p className="text-muted-foreground">
                Não há canais de marketplace configurados.
              </p>
            </ModuleCard>
          )}
        </TabsContent>

        {/* Visão Consolidada */}
        <TabsContent value="consolidado" className="mt-6">
          {empresaSelecionada && (
            <ConsolidatedView
              empresa={{
                id: empresaSelecionada.id,
                nome: empresaSelecionada.razao_social,
                canaisAtivos: canaisDisponiveis.map(c => c.id),
              }}
              mes={mes}
              ano={ano}
              checklists={checklists.map(c => ({
                ...c,
                itens: [],
              })) as ChecklistCanalComItens[]}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de criação */}
      <CriarChecklistModal
        open={showCriarModal}
        onOpenChange={setShowCriarModal}
        empresaId={empresaId}
        canalIdInicial={canalParaCriar}
        mesInicial={mes}
        anoInicial={ano}
        onSuccess={handleChecklistCriado}
      />
    </MainLayout>
  );
}
