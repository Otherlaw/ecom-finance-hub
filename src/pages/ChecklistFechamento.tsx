import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { ChecklistFilters } from "@/components/checklist/ChecklistFilters";
import { ChannelCard } from "@/components/checklist/ChannelCard";
import { ChecklistDetail } from "@/components/checklist/ChecklistDetail";
import { ConsolidatedView } from "@/components/checklist/ConsolidatedView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChecklistMensal,
  ChecklistItem,
  canaisMarketplace,
  empresasMock,
  templatesChecklist,
  checklistsMock,
  getMesNome,
} from "@/lib/checklist-data";
import { toast } from "@/hooks/use-toast";
import { ClipboardCheck, LayoutGrid, Building2 } from "lucide-react";

export default function ChecklistFechamento() {
  const [empresaId, setEmpresaId] = useState<string>(empresasMock[0].id);
  const [canalId, setCanalId] = useState<string>("todos");
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [checklists, setChecklists] = useState<ChecklistMensal[]>(checklistsMock);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistMensal | null>(null);
  const [activeTab, setActiveTab] = useState<string>("canais");

  // Empresa selecionada
  const empresaSelecionada = useMemo(
    () => empresasMock.find((e) => e.id === empresaId),
    [empresaId]
  );

  // Canais disponíveis para a empresa
  const canaisDisponiveis = useMemo(
    () => canaisMarketplace.filter((c) => empresaSelecionada?.canaisAtivos.includes(c.id)),
    [empresaSelecionada]
  );

  // Checklists filtrados
  const checklistsFiltrados = useMemo(
    () =>
      checklists.filter(
        (c) => c.empresaId === empresaId && c.mes === mes && c.ano === ano
      ),
    [checklists, empresaId, mes, ano]
  );

  // Criar novo checklist
  const criarChecklist = (canalIdParam: string) => {
    const template = templatesChecklist.find((t) => t.canalId === canalIdParam);
    const canal = canaisMarketplace.find((c) => c.id === canalIdParam);

    if (!template || !canal || !empresaSelecionada) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o checklist. Template não encontrado.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se já existe
    const existe = checklists.find(
      (c) =>
        c.empresaId === empresaId &&
        c.canalId === canalIdParam &&
        c.mes === mes &&
        c.ano === ano
    );

    if (existe) {
      setSelectedChecklist(existe);
      toast({
        title: "Checklist existente",
        description: "Um checklist para este canal e período já existe.",
      });
      return;
    }

    // Criar itens a partir do template
    const novosItens: ChecklistItem[] = template.itens.map((item, index) => ({
      id: `cli_${Date.now()}_${index}`,
      checklistMensalId: "",
      nome: item.nome,
      descricao: item.descricao,
      tipoEtapa: item.tipoEtapa,
      ordem: item.ordem,
      status: "pendente",
      obrigatorio: item.obrigatorio,
      exigeUpload: item.exigeUpload,
      arquivos: [],
    }));

    const novoChecklist: ChecklistMensal = {
      id: `cl_${empresaId}_${canalIdParam}_${mes}${ano}`,
      empresaId,
      empresaNome: empresaSelecionada.nome,
      canalId: canalIdParam,
      canalNome: canal.nome,
      mes,
      ano,
      status: "pendente",
      itens: novosItens,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };

    // Atualizar IDs dos itens
    novoChecklist.itens = novoChecklist.itens.map((item) => ({
      ...item,
      checklistMensalId: novoChecklist.id,
    }));

    setChecklists((prev) => [...prev, novoChecklist]);
    setSelectedChecklist(novoChecklist);

    toast({
      title: "Checklist criado",
      description: `Checklist de ${canal.nome} para ${getMesNome(mes)}/${ano} foi criado com sucesso.`,
    });
  };

  // Atualizar checklist
  const handleUpdateChecklist = (updatedChecklist: ChecklistMensal) => {
    setChecklists((prev) =>
      prev.map((c) => (c.id === updatedChecklist.id ? updatedChecklist : c))
    );
    setSelectedChecklist(updatedChecklist);
  };

  // Criar checklist geral (todos os canais)
  const handleCriarChecklistGeral = () => {
    if (!empresaSelecionada) return;

    // Criar checklists para todos os canais que ainda não têm
    empresaSelecionada.canaisAtivos.forEach((cId) => {
      const existe = checklists.find(
        (c) =>
          c.empresaId === empresaId &&
          c.canalId === cId &&
          c.mes === mes &&
          c.ano === ano
      );

      if (!existe) {
        criarChecklist(cId);
      }
    });

    toast({
      title: "Checklists criados",
      description: `Checklists para todos os canais de ${getMesNome(mes)}/${ano} foram criados.`,
    });
  };

  // Se um checklist está selecionado, mostrar detalhes
  if (selectedChecklist) {
    return (
      <MainLayout
        title="Checklist de Fechamento"
        subtitle="Gerenciamento de etapas por canal"
      >
        <ChecklistDetail
          checklist={selectedChecklist}
          onBack={() => setSelectedChecklist(null)}
          onUpdate={handleUpdateChecklist}
        />
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
        onCriarChecklist={handleCriarChecklistGeral}
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
          {canalId !== "todos" ? (
            // Canal específico selecionado
            (() => {
              const canal = canaisMarketplace.find((c) => c.id === canalId);
              const checklist = checklistsFiltrados.find((c) => c.canalId === canalId);

              if (!canal) return null;

              return (
                <div className="max-w-md">
                  <ChannelCard
                    canal={canal}
                    checklist={checklist}
                    onClick={() => checklist && setSelectedChecklist(checklist)}
                    onCriar={() => criarChecklist(canalId)}
                  />
                </div>
              );
            })()
          ) : (
            // Todos os canais
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {canaisDisponiveis.map((canal) => {
                const checklist = checklistsFiltrados.find((c) => c.canalId === canal.id);

                return (
                  <ChannelCard
                    key={canal.id}
                    canal={canal}
                    checklist={checklist}
                    onClick={() => checklist && setSelectedChecklist(checklist)}
                    onCriar={() => criarChecklist(canal.id)}
                  />
                );
              })}
            </div>
          )}

          {canaisDisponiveis.length === 0 && (
            <ModuleCard title="Nenhum canal disponível" icon={ClipboardCheck}>
              <p className="text-muted-foreground">
                A empresa selecionada não possui canais de marketplace configurados.
              </p>
            </ModuleCard>
          )}
        </TabsContent>

        {/* Visão Consolidada */}
        <TabsContent value="consolidado" className="mt-6">
          {empresaSelecionada && (
            <ConsolidatedView
              empresa={empresaSelecionada}
              mes={mes}
              ano={ano}
              checklists={checklistsFiltrados}
            />
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
