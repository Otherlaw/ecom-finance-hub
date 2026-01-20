/**
 * Card que mostra a completude do mês para um canal.
 * Indica quantos pedidos têm dados completos do relatório vs apenas API.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, FileSpreadsheet, Database } from "lucide-react";
import { buscarCompletudeMes } from "@/lib/checklist-importacao";

interface CompletudeMesCardProps {
  empresaId: string;
  canal: string;
  mes: number;
  ano: number;
}

export function CompletudeMesCard({ empresaId, canal, mes, ano }: CompletudeMesCardProps) {
  const [loading, setLoading] = useState(true);
  const [completude, setCompletude] = useState<{
    totalPedidos: number;
    pedidosComEventosReport: number;
    pedidosApenasApi: number;
    percentualCompleto: number;
    tiposEventosFaltando: string[];
  } | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const dados = await buscarCompletudeMes(empresaId, canal, mes, ano);
        setCompletude(dados);
      } catch (err) {
        console.error("Erro ao buscar completude:", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (empresaId && canal) {
      carregar();
    }
  }, [empresaId, canal, mes, ano]);

  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-border space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    );
  }

  if (!completude || completude.totalPedidos === 0) {
    return (
      <div className="p-4 rounded-lg border border-border bg-secondary/20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-4 w-4" />
          <span className="text-sm">Nenhum pedido encontrado para este período</span>
        </div>
      </div>
    );
  }

  const { totalPedidos, pedidosComEventosReport, pedidosApenasApi, percentualCompleto, tiposEventosFaltando } = completude;
  
  const isCompleto = percentualCompleto >= 90;
  const isParcial = percentualCompleto >= 50 && percentualCompleto < 90;

  return (
    <div className="p-4 rounded-lg border border-border space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          Completude do Mês
        </h4>
        {isCompleto ? (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completo
          </Badge>
        ) : isParcial ? (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Parcial
          </Badge>
        ) : (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Falta relatório
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{pedidosComEventosReport} de {totalPedidos} pedidos com dados do relatório</span>
          <span>{percentualCompleto}%</span>
        </div>
        <Progress value={percentualCompleto} className="h-2" />
      </div>

      <div className="flex gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span>Relatório: {pedidosComEventosReport}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span>Apenas API: {pedidosApenasApi}</span>
        </div>
      </div>

      {tiposEventosFaltando.length > 0 && !isCompleto && (
        <Alert className="py-2">
          <AlertDescription className="text-xs">
            Faltam dados de: {tiposEventosFaltando.map(t => t.replace('_', ' ')).join(', ')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
