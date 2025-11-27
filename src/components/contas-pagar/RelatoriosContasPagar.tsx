import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  ContaPagar,
  mockCategorias,
  mockFornecedores,
  generateRelatorio,
  formatCurrency,
  formatDateBR,
  STATUS_CONTA_PAGAR,
} from '@/lib/contas-pagar-data';
import { mockEmpresas, REGIME_TRIBUTARIO_CONFIG } from '@/lib/empresas-data';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download,
  Building2,
  User,
  Calendar,
} from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RelatoriosContasPagarProps {
  contas: ContaPagar[];
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

export function RelatoriosContasPagar({ contas }: RelatoriosContasPagarProps) {
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('todas');
  const [tipoRelatorio, setTipoRelatorio] = useState<'categoria' | 'fornecedor' | 'status' | 'projecao'>('categoria');

  const contasFiltradas = empresaFiltro === 'todas' 
    ? contas 
    : contas.filter(c => c.empresaId === empresaFiltro);

  const relatorio = generateRelatorio(contasFiltradas, mockCategorias, mockFornecedores);

  const handleExport = () => {
    // Simular exportação
    let csvContent = '';
    
    if (tipoRelatorio === 'categoria') {
      csvContent = 'Categoria;Valor;Percentual\n';
      relatorio.porCategoria.forEach(item => {
        csvContent += `${item.categoria};${item.valor.toFixed(2)};${item.percentual.toFixed(2)}%\n`;
      });
    } else if (tipoRelatorio === 'fornecedor') {
      csvContent = 'Fornecedor;Valor;Quantidade\n';
      relatorio.porFornecedor.forEach(item => {
        csvContent += `${item.fornecedor};${item.valor.toFixed(2)};${item.quantidade}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_contas_pagar_${tipoRelatorio}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {mockEmpresas.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant={tipoRelatorio === 'categoria' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoRelatorio('categoria')}
            >
              <PieChart className="h-4 w-4 mr-1" />
              Por Categoria
            </Button>
            <Button
              variant={tipoRelatorio === 'fornecedor' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoRelatorio('fornecedor')}
            >
              <User className="h-4 w-4 mr-1" />
              Por Fornecedor
            </Button>
            <Button
              variant={tipoRelatorio === 'status' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoRelatorio('status')}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Por Status
            </Button>
            <Button
              variant={tipoRelatorio === 'projecao' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoRelatorio('projecao')}
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Projeção
            </Button>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Relatório por Categoria */}
      {tipoRelatorio === 'categoria' && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Distribuição por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={relatorio.porCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="valor"
                      nameKey="categoria"
                      label={({ categoria, percentual }) => 
                        percentual > 5 ? `${percentual.toFixed(0)}%` : ''
                      }
                    >
                      {relatorio.porCategoria.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {relatorio.porCategoria.map((item, index) => (
                  <div key={item.categoria} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{item.categoria}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.valor)}</p>
                      <p className="text-xs text-muted-foreground">{item.percentual.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Relatório por Fornecedor */}
      {tipoRelatorio === 'fornecedor' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Contas por Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={relatorio.porFornecedor.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis dataKey="fornecedor" type="category" width={90} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              {relatorio.porFornecedor.slice(0, 6).map((item, index) => (
                <div key={item.fornecedor} className="p-3 bg-muted/30 rounded-lg">
                  <p className="font-medium truncate" title={item.fornecedor}>{item.fornecedor}</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(item.valor)}</p>
                  <p className="text-xs text-muted-foreground">{item.quantidade} conta(s)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relatório por Status */}
      {tipoRelatorio === 'status' && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Distribuição por Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={relatorio.porStatus}>
                    <XAxis 
                      dataKey="status" 
                      tickFormatter={(value) => STATUS_CONTA_PAGAR[value as keyof typeof STATUS_CONTA_PAGAR]?.label || value}
                    />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(value) => STATUS_CONTA_PAGAR[value as keyof typeof STATUS_CONTA_PAGAR]?.label || value}
                    />
                    <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {relatorio.porStatus.map((item) => {
                  const statusConfig = STATUS_CONTA_PAGAR[item.status];
                  return (
                    <div key={item.status} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border`}>
                          {statusConfig.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{item.quantidade} conta(s)</span>
                      </div>
                      <span className="font-bold text-lg">{formatCurrency(item.valor)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Projeção de Saídas */}
      {tipoRelatorio === 'projecao' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Projeção de Saídas de Caixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {relatorio.projecaoSaidas.length > 0 ? (
              <>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={relatorio.projecaoSaidas}>
                      <XAxis 
                        dataKey="data" 
                        tickFormatter={(value) => formatDateBR(value)}
                      />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value: number, name) => [
                          formatCurrency(value), 
                          name === 'valor' ? 'No dia' : 'Acumulado'
                        ]}
                        labelFormatter={(value) => formatDateBR(value)}
                      />
                      <Legend />
                      <Bar dataKey="valor" name="No dia" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="acumulado" name="Acumulado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-4">
                  {relatorio.projecaoSaidas.slice(0, 4).map((item) => (
                    <div key={item.data} className="p-3 bg-muted/30 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateBR(item.data)}
                      </p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(item.valor)}</p>
                      <p className="text-xs text-muted-foreground">Acum: {formatCurrency(item.acumulado)}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conta em aberto para projeção.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumo por Empresa (se todas) */}
      {empresaFiltro === 'todas' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Resumo por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {mockEmpresas.map(empresa => {
                const contasEmpresa = contas.filter(c => c.empresaId === empresa.id);
                const totalEmAberto = contasEmpresa
                  .filter(c => c.status !== 'pago' && c.status !== 'cancelado')
                  .reduce((sum, c) => sum + c.valorEmAberto, 0);
                const totalVencido = contasEmpresa
                  .filter(c => c.status === 'vencido')
                  .reduce((sum, c) => sum + c.valorEmAberto, 0);
                
                return (
                  <div key={empresa.id} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold">{empresa.nome}</p>
                        <Badge variant="outline" className="text-xs">
                          {REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].label}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{contasEmpresa.length} contas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Em Aberto</p>
                        <p className="font-bold text-primary">{formatCurrency(totalEmAberto)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vencido</p>
                        <p className="font-bold text-red-600">{formatCurrency(totalVencido)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
