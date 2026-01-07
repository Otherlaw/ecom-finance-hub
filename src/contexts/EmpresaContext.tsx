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
  empresaAtiva: Empresa | null;
  setEmpresaAtiva: (empresa: Empresa | null) => void;
  empresasDisponiveis: Empresa[];
  isLoading: boolean;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const STORAGE_KEY = "ecom-finance-empresa-ativa";

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { empresas, isLoading: loadingEmpresas } = useEmpresas();
  const { userEmpresas, isLoading: loadingUserEmpresas } = useUserEmpresas();
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null);

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
    const savedEmpresa = savedId
      ? empresasDisponiveis.find((e) => e.id === savedId)
      : null;

    if (savedEmpresa) {
      setEmpresaAtivaState(savedEmpresa);
    } else if (!empresaAtiva) {
      setEmpresaAtivaState(empresasDisponiveis[0]);
    }
  }, [empresasDisponiveis]);

  const setEmpresaAtiva = (empresa: Empresa | null) => {
    setEmpresaAtivaState(empresa);
    if (empresa) {
      localStorage.setItem(STORAGE_KEY, empresa.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <EmpresaContext.Provider
      value={{
        empresaAtiva,
        setEmpresaAtiva,
        empresasDisponiveis,
        isLoading: loadingEmpresas || loadingUserEmpresas,
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
    };
  }
  return context;
}
