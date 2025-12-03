import * as XLSX from 'xlsx';
import { ContaReceber } from '@/hooks/useContasReceber';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateBR = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const getDaysOverdue = (dataVencimento: string): number => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [year, month, day] = dataVencimento.split('-').map(Number);
  const vencimento = new Date(year, month - 1, day);
  const diffTime = hoje.getTime() - vencimento.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getAgingBucket = (dataVencimento: string, status: string): string => {
  if (status === 'recebido' || status === 'cancelado') return 'N/A';
  const days = getDaysOverdue(dataVencimento);
  if (days < 0) return 'A Vencer';
  if (days <= 30) return '1-30 dias';
  if (days <= 60) return '31-60 dias';
  if (days <= 90) return '61-90 dias';
  return '90+ dias';
};

const STATUS_LABELS: Record<string, string> = {
  em_aberto: 'Em Aberto',
  parcialmente_recebido: 'Parcial',
  recebido: 'Recebido',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

interface ExportOptions {
  includeAging?: boolean;
  includeClientes?: boolean;
  includePrevisao?: boolean;
}

export const exportContasReceberToExcel = (
  contas: ContaReceber[],
  options: ExportOptions = { includeAging: true, includeClientes: true, includePrevisao: true }
) => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Lista Completa
  const listaData = contas.map(conta => {
    const diasAtraso = getDaysOverdue(conta.data_vencimento);
    const isVencido = diasAtraso > 0 && conta.status !== 'recebido' && conta.status !== 'cancelado';
    
    return {
      'Cliente': conta.cliente_nome,
      'Descrição': conta.descricao,
      'Documento': conta.documento || '-',
      'Origem': conta.origem || '-',
      'Data Emissão': formatDateBR(conta.data_emissao),
      'Data Vencimento': formatDateBR(conta.data_vencimento),
      'Data Recebimento': formatDateBR(conta.data_recebimento),
      'Valor Total': conta.valor_total,
      'Valor Recebido': conta.valor_recebido,
      'Valor em Aberto': conta.valor_em_aberto,
      'Status': isVencido ? 'Vencido' : (STATUS_LABELS[conta.status] || conta.status),
      'Dias Atraso': isVencido ? diasAtraso : 0,
      'Faixa Aging': getAgingBucket(conta.data_vencimento, conta.status),
      'Categoria': conta.categoria?.nome || '-',
      'Centro de Custo': conta.centro_custo?.nome || '-',
      'Empresa': conta.empresa?.nome_fantasia || conta.empresa?.razao_social || '-',
    };
  });

  const wsLista = XLSX.utils.json_to_sheet(listaData);
  XLSX.utils.book_append_sheet(workbook, wsLista, 'Contas a Receber');

  // Sheet 2: Aging Report
  if (options.includeAging) {
    const agingData: Record<string, { count: number; valor: number }> = {
      'A Vencer': { count: 0, valor: 0 },
      '1-30 dias': { count: 0, valor: 0 },
      '31-60 dias': { count: 0, valor: 0 },
      '61-90 dias': { count: 0, valor: 0 },
      '90+ dias': { count: 0, valor: 0 },
    };

    contas
      .filter(c => c.status !== 'recebido' && c.status !== 'cancelado')
      .forEach(conta => {
        const bucket = getAgingBucket(conta.data_vencimento, conta.status);
        if (agingData[bucket]) {
          agingData[bucket].count++;
          agingData[bucket].valor += conta.valor_em_aberto;
        }
      });

    const totalEmAberto = Object.values(agingData).reduce((sum, d) => sum + d.valor, 0);

    const agingRows = Object.entries(agingData).map(([faixa, data]) => ({
      'Faixa de Vencimento': faixa,
      'Quantidade': data.count,
      'Valor': data.valor,
      '% do Total': totalEmAberto > 0 ? ((data.valor / totalEmAberto) * 100).toFixed(1) + '%' : '0%',
    }));

    // Add totals row
    agingRows.push({
      'Faixa de Vencimento': 'TOTAL',
      'Quantidade': Object.values(agingData).reduce((sum, d) => sum + d.count, 0),
      'Valor': totalEmAberto,
      '% do Total': '100%',
    });

    const wsAging = XLSX.utils.json_to_sheet(agingRows);
    XLSX.utils.book_append_sheet(workbook, wsAging, 'Aging Report');
  }

  // Sheet 3: Análise por Cliente
  if (options.includeClientes) {
    const clienteMap: Record<string, {
      nome: string;
      total: number;
      emAberto: number;
      recebido: number;
      count: number;
      vencido: number;
    }> = {};

    contas.forEach(conta => {
      const nome = conta.cliente_nome;
      if (!clienteMap[nome]) {
        clienteMap[nome] = { nome, total: 0, emAberto: 0, recebido: 0, count: 0, vencido: 0 };
      }
      clienteMap[nome].total += conta.valor_total;
      clienteMap[nome].count++;

      if (conta.status === 'recebido') {
        clienteMap[nome].recebido += conta.valor_total;
      } else if (conta.status !== 'cancelado') {
        clienteMap[nome].emAberto += conta.valor_em_aberto;
        if (getDaysOverdue(conta.data_vencimento) > 0) {
          clienteMap[nome].vencido += conta.valor_em_aberto;
        }
      }
    });

    const clientesRows = Object.values(clienteMap)
      .sort((a, b) => b.total - a.total)
      .map(cliente => ({
        'Cliente': cliente.nome,
        'Qtd Títulos': cliente.count,
        'Total': cliente.total,
        'Recebido': cliente.recebido,
        'Em Aberto': cliente.emAberto,
        'Vencido': cliente.vencido,
        '% Inadimplência': cliente.total > 0 
          ? ((cliente.vencido / cliente.total) * 100).toFixed(1) + '%' 
          : '0%',
      }));

    const wsClientes = XLSX.utils.json_to_sheet(clientesRows);
    XLSX.utils.book_append_sheet(workbook, wsClientes, 'Análise por Cliente');
  }

  // Sheet 4: Previsão de Recebimentos
  if (options.includePrevisao) {
    const hoje = new Date();
    const meses: Record<string, { mes: string; previsto: number; recebido: number }> = {};

    for (let i = 0; i < 6; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const mesNome = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      meses[key] = { mes: mesNome, previsto: 0, recebido: 0 };
    }

    contas.forEach(conta => {
      if (conta.status !== 'recebido' && conta.status !== 'cancelado') {
        const [year, month] = conta.data_vencimento.split('-');
        const key = `${year}-${month}`;
        if (meses[key]) {
          meses[key].previsto += conta.valor_em_aberto;
        }
      }

      if (conta.data_recebimento && (conta.status === 'recebido' || conta.status === 'parcialmente_recebido')) {
        const [year, month] = conta.data_recebimento.split('-');
        const key = `${year}-${month}`;
        if (meses[key]) {
          meses[key].recebido += conta.valor_recebido;
        }
      }
    });

    const previsaoRows = Object.values(meses).map(m => ({
      'Mês': m.mes,
      'Previsto': m.previsto,
      'Recebido': m.recebido,
      'Diferença': m.recebido - m.previsto,
    }));

    const wsPrevisao = XLSX.utils.json_to_sheet(previsaoRows);
    XLSX.utils.book_append_sheet(workbook, wsPrevisao, 'Previsão Recebimentos');
  }

  // Sheet 5: Resumo
  const contasEmAberto = contas.filter(c => c.status !== 'recebido' && c.status !== 'cancelado');
  const totalEmAberto = contasEmAberto.reduce((sum, c) => sum + c.valor_em_aberto, 0);
  const totalRecebido = contas.filter(c => c.status === 'recebido').reduce((sum, c) => sum + c.valor_total, 0);
  const totalVencido = contasEmAberto
    .filter(c => getDaysOverdue(c.data_vencimento) > 0)
    .reduce((sum, c) => sum + c.valor_em_aberto, 0);

  const resumoRows = [
    { 'Indicador': 'Total de Contas', 'Valor': contas.length },
    { 'Indicador': 'Total da Carteira', 'Valor': contas.reduce((sum, c) => sum + c.valor_total, 0) },
    { 'Indicador': 'Total em Aberto', 'Valor': totalEmAberto },
    { 'Indicador': 'Total Recebido', 'Valor': totalRecebido },
    { 'Indicador': 'Total Vencido', 'Valor': totalVencido },
    { 'Indicador': 'Taxa de Inadimplência', 'Valor': totalEmAberto > 0 
      ? ((totalVencido / totalEmAberto) * 100).toFixed(1) + '%' 
      : '0%' },
    { 'Indicador': 'Data do Relatório', 'Valor': new Date().toLocaleDateString('pt-BR') },
  ];

  const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
  XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');

  // Generate and download
  const fileName = `contas_receber_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportContasReceberToCSV = (contas: ContaReceber[]) => {
  const csvData = contas.map(conta => {
    const diasAtraso = getDaysOverdue(conta.data_vencimento);
    const isVencido = diasAtraso > 0 && conta.status !== 'recebido' && conta.status !== 'cancelado';
    
    return {
      'Cliente': conta.cliente_nome,
      'Descrição': conta.descricao,
      'Data Vencimento': formatDateBR(conta.data_vencimento),
      'Valor Total': conta.valor_total,
      'Valor em Aberto': conta.valor_em_aberto,
      'Status': isVencido ? 'Vencido' : (STATUS_LABELS[conta.status] || conta.status),
      'Dias Atraso': isVencido ? diasAtraso : 0,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(csvData);
  const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `contas_receber_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};
