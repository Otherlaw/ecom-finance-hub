import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const STATUS_LABELS: Record<string, string> = {
  em_aberto: 'Em Aberto',
  parcialmente_pago: 'Parcial',
  pago: 'Pago',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#6b7280'];

interface RelatoriosContasPagarProps {
  contas: any[];
}

export function RelatoriosContasPagar({ contas }: RelatoriosContasPagarProps) {
  const resumoPorStatus = useMemo(() => {
    const statusMap: Record<string, { count: number; valor: number }> = {};
    contas.forEach(conta => {
      if (!statusMap[conta.status]) statusMap[conta.status] = { count: 0, valor: 0 };
      statusMap[conta.status].count++;
      statusMap[conta.status].valor += conta.valor_em_aberto;
    });
    return Object.entries(statusMap).map(([status, data]) => ({
      name: STATUS_LABELS[status] || status,
      value: data.valor,
      count: data.count,
    }));
  }, [contas]);

  const resumoPorCategoria = useMemo(() => {
    const categoriaMap: Record<string, { nome: string; valor: number }> = {};
    contas.forEach(conta => {
      const nome = conta.categoria?.nome || 'Sem categoria';
      if (!categoriaMap[nome]) categoriaMap[nome] = { nome, valor: 0 };
      categoriaMap[nome].valor += conta.valor_total;
    });
    return Object.values(categoriaMap).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [contas]);

  const resumoPorFornecedor = useMemo(() => {
    const fornecedorMap: Record<string, { nome: string; valor: number; count: number }> = {};
    contas.forEach(conta => {
      const nome = conta.fornecedor_nome;
      if (!fornecedorMap[nome]) fornecedorMap[nome] = { nome, valor: 0, count: 0 };
      fornecedorMap[nome].valor += conta.valor_total;
      fornecedorMap[nome].count++;
    });
    return Object.values(fornecedorMap).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [contas]);

  const totalGeral = contas.reduce((sum, c) => sum + c.valor_total, 0);
  const totalEmAberto = contas.reduce((sum, c) => sum + c.valor_em_aberto, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total de Contas</p><p className="text-2xl font-bold">{contas.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Valor Total</p><p className="text-2xl font-bold">{formatCurrency(totalGeral)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total em Aberto</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalEmAberto)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Pago</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalGeral - totalEmAberto)}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={resumoPorStatus} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {resumoPorStatus.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 Categorias</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={resumoPorCategoria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Fornecedores</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {resumoPorFornecedor.map((forn, idx) => (
              <div key={forn.nome} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">{idx + 1}.</span>
                  <div><p className="font-medium">{forn.nome}</p><p className="text-xs text-muted-foreground">{forn.count} conta(s)</p></div>
                </div>
                <span className="font-semibold">{formatCurrency(forn.valor)}</span>
              </div>
            ))}
            {resumoPorFornecedor.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum dado disponível</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
