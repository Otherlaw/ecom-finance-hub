import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart 
} from 'recharts';
import { ContaReceber } from '@/hooks/useContasReceber';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Users, Calendar } from 'lucide-react';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280', '#8b5cf6'];
const AGING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#991b1b'];

interface RelatoriosContasReceberProps {
  contas: ContaReceber[];
}

export function RelatoriosContasReceber({ contas }: RelatoriosContasReceberProps) {
  // Aging Report - categoriza por faixas de vencimento
  const agingReport = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const faixas = {
      'A Vencer': { count: 0, valor: 0 },
      '1-30 dias': { count: 0, valor: 0 },
      '31-60 dias': { count: 0, valor: 0 },
      '61-90 dias': { count: 0, valor: 0 },
      '90+ dias': { count: 0, valor: 0 },
    };

    contas
      .filter(c => c.status !== 'recebido' && c.status !== 'cancelado')
      .forEach(conta => {
        const [year, month, day] = conta.data_vencimento.split('-').map(Number);
        const vencimento = new Date(year, month - 1, day);
        const diffDays = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          faixas['A Vencer'].count++;
          faixas['A Vencer'].valor += conta.valor_em_aberto;
        } else if (diffDays <= 30) {
          faixas['1-30 dias'].count++;
          faixas['1-30 dias'].valor += conta.valor_em_aberto;
        } else if (diffDays <= 60) {
          faixas['31-60 dias'].count++;
          faixas['31-60 dias'].valor += conta.valor_em_aberto;
        } else if (diffDays <= 90) {
          faixas['61-90 dias'].count++;
          faixas['61-90 dias'].valor += conta.valor_em_aberto;
        } else {
          faixas['90+ dias'].count++;
          faixas['90+ dias'].valor += conta.valor_em_aberto;
        }
      });

    return Object.entries(faixas).map(([faixa, data]) => ({
      faixa,
      ...data,
    }));
  }, [contas]);

  // Previsão de Recebimentos - próximos 4 meses
  const previsaoRecebimentos = useMemo(() => {
    const hoje = new Date();
    const meses: Record<string, { mes: string; previsto: number; recebido: number }> = {};

    // Inicializa os próximos 4 meses
    for (let i = 0; i < 4; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const mesNome = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      meses[key] = { mes: mesNome, previsto: 0, recebido: 0 };
    }

    contas.forEach(conta => {
      // Para contas em aberto, usar data de vencimento
      if (conta.status !== 'recebido' && conta.status !== 'cancelado') {
        const [year, month] = conta.data_vencimento.split('-');
        const key = `${year}-${month}`;
        if (meses[key]) {
          meses[key].previsto += conta.valor_em_aberto;
        }
      }
      
      // Para contas recebidas, usar data de recebimento
      if (conta.data_recebimento && (conta.status === 'recebido' || conta.status === 'parcialmente_recebido')) {
        const [year, month] = conta.data_recebimento.split('-');
        const key = `${year}-${month}`;
        if (meses[key]) {
          meses[key].recebido += conta.valor_recebido;
        }
      }
    });

    return Object.values(meses);
  }, [contas]);

  // Análise por Cliente
  const analiseClientes = useMemo(() => {
    const clienteMap: Record<string, { 
      nome: string; 
      total: number; 
      emAberto: number; 
      recebido: number;
      count: number;
      vencido: number;
    }> = {};

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

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
        
        const [year, month, day] = conta.data_vencimento.split('-').map(Number);
        const vencimento = new Date(year, month - 1, day);
        if (vencimento < hoje) {
          clienteMap[nome].vencido += conta.valor_em_aberto;
        }
      }
    });

    return Object.values(clienteMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [contas]);

  // Distribuição por Status
  const distribuicaoStatus = useMemo(() => {
    const statusLabels: Record<string, string> = {
      em_aberto: 'Em Aberto',
      parcialmente_recebido: 'Parcial',
      recebido: 'Recebido',
      vencido: 'Vencido',
      cancelado: 'Cancelado',
    };

    const statusMap: Record<string, { count: number; valor: number }> = {};
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    contas.forEach(conta => {
      let status = conta.status;
      
      // Marca como vencido se em aberto e passou da data
      if (status === 'em_aberto' || status === 'parcialmente_recebido') {
        const [year, month, day] = conta.data_vencimento.split('-').map(Number);
        const vencimento = new Date(year, month - 1, day);
        if (vencimento < hoje) {
          status = 'vencido';
        }
      }

      if (!statusMap[status]) statusMap[status] = { count: 0, valor: 0 };
      statusMap[status].count++;
      statusMap[status].valor += conta.status === 'recebido' ? conta.valor_total : conta.valor_em_aberto;
    });

    return Object.entries(statusMap).map(([status, data]) => ({
      name: statusLabels[status] || status,
      value: data.valor,
      count: data.count,
    }));
  }, [contas]);

  // Totais
  const totais = useMemo(() => {
    const emAberto = contas.filter(c => c.status !== 'recebido' && c.status !== 'cancelado');
    return {
      total: contas.reduce((sum, c) => sum + c.valor_total, 0),
      emAberto: emAberto.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      recebido: contas.filter(c => c.status === 'recebido').reduce((sum, c) => sum + c.valor_total, 0),
      quantidade: contas.length,
    };
  }, [contas]);

  const totalVencido = agingReport
    .filter(a => a.faixa !== 'A Vencer')
    .reduce((sum, a) => sum + a.valor, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total de Contas</p>
            <p className="text-2xl font-bold">{totais.quantidade}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totais.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Em Aberto</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totais.emAberto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Recebido</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totais.recebido)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Aging Report - Análise por Vencimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={agingReport}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" fill="#3b82f6">
                    {agingReport.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={AGING_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingReport.map((faixa, idx) => (
                    <TableRow key={faixa.faixa}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: AGING_COLORS[idx] }} 
                          />
                          {faixa.faixa}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{faixa.count}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(faixa.valor)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {totais.emAberto > 0 
                          ? ((faixa.valor / totais.emAberto) * 100).toFixed(1) 
                          : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total Vencido</TableCell>
                    <TableCell className="text-right">
                      {agingReport.filter(a => a.faixa !== 'A Vencer').reduce((s, a) => s + a.count, 0)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(totalVencido)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {totais.emAberto > 0 
                        ? ((totalVencido / totais.emAberto) * 100).toFixed(1) 
                        : 0}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previsão de Recebimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Previsão de Recebimentos - Próximos 4 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={previsaoRecebimentos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="previsto" 
                name="Previsto" 
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.3}
              />
              <Area 
                type="monotone" 
                dataKey="recebido" 
                name="Recebido" 
                stroke="#10b981" 
                fill="#10b981" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Distribuição por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie 
                  data={distribuicaoStatus} 
                  cx="50%" 
                  cy="50%" 
                  labelLine={false} 
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80} 
                  fill="#8884d8" 
                  dataKey="value"
                >
                  {distribuicaoStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Clientes por Valor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              Top 10 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analiseClientes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="total" name="Total" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Análise Detalhada por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Em Aberto</TableHead>
                <TableHead className="text-right">Vencido</TableHead>
                <TableHead className="text-right">% Inadimplência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analiseClientes.map((cliente) => {
                const inadimplencia = cliente.total > 0 
                  ? (cliente.vencido / cliente.total) * 100 
                  : 0;
                return (
                  <TableRow key={cliente.nome}>
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell className="text-right">{cliente.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cliente.total)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatCurrency(cliente.recebido)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatCurrency(cliente.emAberto)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(cliente.vencido)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={inadimplencia > 30 ? "destructive" : inadimplencia > 10 ? "secondary" : "outline"}>
                        {inadimplencia.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {analiseClientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum dado disponível
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
