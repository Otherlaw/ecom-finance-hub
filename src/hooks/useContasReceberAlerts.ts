import { useMemo } from 'react';
import { useContasReceber, ContaReceber } from './useContasReceber';
import { AssistantAlert, AlertSeverity } from '@/lib/assistant-data';

interface InadimplenciaAlert extends AssistantAlert {
  contasAfetadas: ContaReceber[];
}

const getDaysOverdue = (dataVencimento: string): number => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [year, month, day] = dataVencimento.split('-').map(Number);
  const vencimento = new Date(year, month - 1, day);
  const diffTime = hoje.getTime() - vencimento.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const useContasReceberAlerts = () => {
  const { contas } = useContasReceber({});

  const alerts = useMemo(() => {
    if (!contas || contas.length === 0) return [];

    const alertsList: InadimplenciaAlert[] = [];
    const hoje = new Date();

    // Filtrar contas em aberto vencidas
    const contasVencidas = contas.filter(c => {
      if (c.status === 'recebido' || c.status === 'cancelado') return false;
      return getDaysOverdue(c.data_vencimento) > 0;
    });

    // Agrupar por faixas de atraso
    const vencidas30Mais = contasVencidas.filter(c => getDaysOverdue(c.data_vencimento) > 30);
    const vencidas60Mais = contasVencidas.filter(c => getDaysOverdue(c.data_vencimento) > 60);
    const vencidas90Mais = contasVencidas.filter(c => getDaysOverdue(c.data_vencimento) > 90);

    // Alerta crítico: contas vencidas há mais de 90 dias
    if (vencidas90Mais.length > 0) {
      const valorTotal = vencidas90Mais.reduce((sum, c) => sum + c.valor_em_aberto, 0);
      const clientes = [...new Set(vencidas90Mais.map(c => c.cliente_nome))];
      
      alertsList.push({
        id: `alert-cr-90plus-${Date.now()}`,
        titulo: 'Inadimplência Crítica (+90 dias)',
        descricao: `${vencidas90Mais.length} conta(s) vencida(s) há mais de 90 dias totalizando ${formatCurrency(valorTotal)}.`,
        descricaoCompleta: `Detectei ${vencidas90Mais.length} conta(s) a receber com atraso superior a 90 dias.\n\nValor total em aberto: ${formatCurrency(valorTotal)}\n\nClientes afetados:\n${clientes.map(c => `• ${c}`).join('\n')}\n\nEsta situação requer ação imediata:\n- Considere protestos ou negativação\n- Avalie provisão para devedores duvidosos\n- Revise política de crédito para estes clientes`,
        categoria: 'financeiro',
        severidade: 'critico',
        status: 'novo',
        dataDeteccao: hoje,
        impactoEstimado: formatCurrency(valorTotal),
        acaoRecomendada: 'Acesse Contas a Receber e tome ações de cobrança ou considere provisionar estes valores.',
        linkDestino: '/contas-receber',
        dadosContexto: {
          quantidade: vencidas90Mais.length,
          valorTotal,
          clientes,
          diasAtraso: '90+',
        },
        contasAfetadas: vencidas90Mais,
      });
    }

    // Alerta alto: contas vencidas há mais de 60 dias (excluindo as de 90+)
    const vencidas60a90 = vencidas60Mais.filter(c => getDaysOverdue(c.data_vencimento) <= 90);
    if (vencidas60a90.length > 0) {
      const valorTotal = vencidas60a90.reduce((sum, c) => sum + c.valor_em_aberto, 0);
      const clientes = [...new Set(vencidas60a90.map(c => c.cliente_nome))];
      
      alertsList.push({
        id: `alert-cr-60-90-${Date.now()}`,
        titulo: 'Inadimplência Alta (60-90 dias)',
        descricao: `${vencidas60a90.length} conta(s) vencida(s) entre 60 e 90 dias totalizando ${formatCurrency(valorTotal)}.`,
        descricaoCompleta: `Detectei ${vencidas60a90.length} conta(s) a receber com atraso entre 60 e 90 dias.\n\nValor total em aberto: ${formatCurrency(valorTotal)}\n\nClientes afetados:\n${clientes.map(c => `• ${c}`).join('\n')}\n\nRecomendações:\n- Intensifique a cobrança\n- Considere negociação de parcelamento\n- Avalie suspensão de novos pedidos`,
        categoria: 'financeiro',
        severidade: 'alto',
        status: 'novo',
        dataDeteccao: hoje,
        impactoEstimado: formatCurrency(valorTotal),
        acaoRecomendada: 'Intensifique a cobrança e considere negociação direta com os clientes.',
        linkDestino: '/contas-receber',
        dadosContexto: {
          quantidade: vencidas60a90.length,
          valorTotal,
          clientes,
          diasAtraso: '60-90',
        },
        contasAfetadas: vencidas60a90,
      });
    }

    // Alerta médio: contas vencidas há mais de 30 dias (excluindo as de 60+)
    const vencidas30a60 = vencidas30Mais.filter(c => getDaysOverdue(c.data_vencimento) <= 60);
    if (vencidas30a60.length > 0) {
      const valorTotal = vencidas30a60.reduce((sum, c) => sum + c.valor_em_aberto, 0);
      const clientes = [...new Set(vencidas30a60.map(c => c.cliente_nome))];
      
      alertsList.push({
        id: `alert-cr-30-60-${Date.now()}`,
        titulo: 'Atenção: Inadimplência (30-60 dias)',
        descricao: `${vencidas30a60.length} conta(s) vencida(s) entre 30 e 60 dias totalizando ${formatCurrency(valorTotal)}.`,
        descricaoCompleta: `Detectei ${vencidas30a60.length} conta(s) a receber com atraso entre 30 e 60 dias.\n\nValor total em aberto: ${formatCurrency(valorTotal)}\n\nClientes afetados:\n${clientes.map(c => `• ${c}`).join('\n')}\n\nRecomendações:\n- Entre em contato para lembrete de pagamento\n- Verifique se há contestações\n- Considere aplicar juros/multa conforme contrato`,
        categoria: 'financeiro',
        severidade: 'medio',
        status: 'novo',
        dataDeteccao: hoje,
        impactoEstimado: formatCurrency(valorTotal),
        acaoRecomendada: 'Envie lembretes de cobrança e verifique se há pendências com os clientes.',
        linkDestino: '/contas-receber',
        dadosContexto: {
          quantidade: vencidas30a60.length,
          valorTotal,
          clientes,
          diasAtraso: '30-60',
        },
        contasAfetadas: vencidas30a60,
      });
    }

    // Resumo geral de inadimplência
    if (contasVencidas.length > 0) {
      const valorTotalVencido = contasVencidas.reduce((sum, c) => sum + c.valor_em_aberto, 0);
      const valorTotalCarteira = contas
        .filter(c => c.status !== 'cancelado')
        .reduce((sum, c) => sum + c.valor_total, 0);
      const percentualInadimplencia = valorTotalCarteira > 0 
        ? (valorTotalVencido / valorTotalCarteira) * 100 
        : 0;

      if (percentualInadimplencia > 20) {
        alertsList.push({
          id: `alert-cr-inadimplencia-geral-${Date.now()}`,
          titulo: 'Taxa de Inadimplência Elevada',
          descricao: `${percentualInadimplencia.toFixed(1)}% da carteira está em atraso.`,
          descricaoCompleta: `A taxa de inadimplência da carteira de recebíveis está elevada:\n\n• Valor total da carteira: ${formatCurrency(valorTotalCarteira)}\n• Valor vencido: ${formatCurrency(valorTotalVencido)}\n• Taxa de inadimplência: ${percentualInadimplencia.toFixed(1)}%\n\nUma taxa acima de 20% indica problemas na gestão de crédito e cobrança. Considere:\n- Revisar política de concessão de crédito\n- Implementar análise de crédito mais rigorosa\n- Criar régua de cobrança automatizada`,
          categoria: 'financeiro',
          severidade: percentualInadimplencia > 30 ? 'critico' : 'alto',
          status: 'novo',
          dataDeteccao: hoje,
          impactoEstimado: `${percentualInadimplencia.toFixed(1)}% da carteira`,
          acaoRecomendada: 'Revise sua política de crédito e implemente ações de cobrança mais efetivas.',
          linkDestino: '/contas-receber',
          dadosContexto: {
            valorCarteira: valorTotalCarteira,
            valorVencido: valorTotalVencido,
            percentualInadimplencia,
          },
          contasAfetadas: contasVencidas,
        });
      }
    }

    return alertsList;
  }, [contas]);

  return {
    alerts,
    hasAlerts: alerts.length > 0,
    alertsCriticos: alerts.filter(a => a.severidade === 'critico'),
    alertsAltos: alerts.filter(a => a.severidade === 'alto'),
    alertsMedios: alerts.filter(a => a.severidade === 'medio'),
  };
};
