import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
}

interface EmpresaContextType {
  /** Empresa ativa ou null quando "Consolidado (todas)" */
  empresaAtiva: Empresa | null;
  setEmpresaAtiva: (empresa: Empresa | null) => void;
  empresasDisponiveis: Empresa[];
  isLoading: boolean;
  /** true quando o usuário selecionou "Consolidado" explicitamente */
  isConsolidado: boolean;
  /** ID da empresa para filtros de query: string quando empresa específica, undefined quando consolidado */
  empresaIdParaFiltro: string | undefined;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const STORAGE_KEY = "ecom-finance-empresa-ativa";
const CONSOLIDADO_VALUE = "__CONSOLIDADO__";

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { userEmpresas, isLoading: loadingUserEmpresas } = useUserEmpresas();
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null);
  const [isConsolidado, setIsConsolidado] = useState(false);

  // Filtra empresas que o usuário tem acesso
  const empresasDisponiveis = React.useMemo(() => {
    if (!empresas || !userEmpresas) return [];
    const empresaIds = new Set(userEmpresas.map((ue) => ue.empresa_id));
    return empresas.filter((e) => empresaIds.has(e.id));
  }, [empresas, userEmpresas]);

  // Carrega empresa salva do localStorage ou usa a primeira disponível
  useEffect(() => {
    if (empresasDisponiveis.length === 0) return;

    const savedId = localStorage.getItem(STORAGE_KEY);
    
    if (savedId === CONSOLIDADO_VALUE) {
      setEmpresaAtivaState(null);
      setIsConsolidado(true);
      return;
    }

    const savedEmpresa = savedId
      ? empresasDisponiveis.find((e) => e.id === savedId)
      : null;

    if (savedEmpresa) {
      setEmpresaAtivaState(savedEmpresa);
      setIsConsolidado(false);
    } else if (!empresaAtiva && !isConsolidado) {
      setEmpresaAtivaState(empresasDisponiveis[0]);
      setIsConsolidado(false);
    }
  }, [empresasDisponiveis]);

  const setEmpresaAtiva = (empresa: Empresa | null) => {
    setEmpresaAtivaState(empresa);
    if (empresa) {
      setIsConsolidado(false);
      localStorage.setItem(STORAGE_KEY, empresa.id);
    } else {
      // null = consolidado
      setIsConsolidado(true);
      localStorage.setItem(STORAGE_KEY, CONSOLIDADO_VALUE);
    }
  };

  const empresaIdParaFiltro = isConsolidado ? undefined : empresaAtiva?.id;

  return (
    <EmpresaContext.Provider
      value={{
        empresaAtiva,
        setEmpresaAtiva,
        empresasDisponiveis,
        isLoading: loadingEmpresas || loadingUserEmpresas,
        isConsolidado,
        empresaIdParaFiltro,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresaAtiva() {
  const context = useContext(EmpresaContext);
  // Return safe defaults if context is not available (during initialization)
  if (context === undefined) {
    return {
      empresaAtiva: null,
      setEmpresaAtiva: () => {},
      empresasDisponiveis: [],
      isLoading: true,
      isConsolidado: false,
      empresaIdParaFiltro: undefined,
    };
  }
  return context;
}
