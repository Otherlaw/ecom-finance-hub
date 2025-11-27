import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  ContaPagar,
  Pagamento,
  FormaPagamento,
  FORMA_PAGAMENTO,
  mockContasBancarias,
  formatCurrency,
  formatDate,
} from "@/lib/contas-pagar-data";
import { DollarSign, Calendar, CreditCard, Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  onSubmit: (contaId: string, pagamento: Omit<Pagamento, "id" | "contaPagarId" | "dataCadastro">) => void;
}

export function PagamentoModal({ open, onOpenChange, conta, onSubmit }: PagamentoModalProps) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split("T")[0]);
  const [valorPago, setValorPago] = useState(conta?.valorEmAberto || 0);
  const [juros, setJuros] = useState(0);
  const [multa, setMulta] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Reset form when conta changes
  useState(() => {
    if (conta) {
      setValorPago(conta.valorEmAberto);
      setJuros(0);
      setMulta(0);
      setDesconto(0);
    }
  });

  if (!conta) return null;

  const contasBancarias = mockContasBancarias.filter(cb => cb.empresaId === conta.empresaId && cb.status === 'ativo');
  const valorTotal = valorPago + juros + multa - desconto;
  const isParcial = valorPago < conta.valorEmAberto;
  const saldoRestante = conta.valorEmAberto - valorPago;

  const handleSubmit = () => {
    if (valorPago <= 0) {
      toast({
        title: "Erro",
        description: "O valor pago deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (valorPago > conta.valorEmAberto) {
      toast({
        title: "Erro",
        description: "O valor pago não pode ser maior que o saldo em aberto",
        variant: "destructive",
      });
      return;
    }

    if (!dataPagamento) {
      toast({
        title: "Erro",
        description: "Informe a data do pagamento",
        variant: "destructive",
      });
      return;
    }

    onSubmit(conta.id, {
      dataPagamento,
      valorPago,
      juros,
      multa,
      desconto,
      valorTotal,
      formaPagamento,
      contaBancariaId: contaBancariaId || undefined,
      observacoes: observacoes || undefined,
    });

    onOpenChange(false);
    toast({
      title: "Pagamento registrado",
      description: isParcial 
        ? `Pagamento parcial de ${formatCurrency(valorTotal)} registrado. Saldo restante: ${formatCurrency(saldoRestante)}`
        : `Pagamento de ${formatCurrency(valorTotal)} registrado com sucesso`,
    });

    // Reset form
    setValorPago(0);
    setJuros(0);
    setMulta(0);
    setDesconto(0);
    setObservacoes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-success" />
            Registrar Pagamento
          </DialogTitle>
        </DialogHeader>

        {/* Resumo da Conta */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Conta:</span>
            <span className="font-medium">{conta.descricao}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Fornecedor:</span>
            <span>{conta.fornecedorNome}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vencimento:</span>
            <span>{formatDate(conta.dataVencimento)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor Original:</span>
            <span>{formatCurrency(conta.valorOriginal)}</span>
          </div>
          {conta.valorPago > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Já Pago:</span>
              <span className="text-success">{formatCurrency(conta.valorPago)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2 mt-2">
            <span className="text-sm font-medium">Saldo em Aberto:</span>
            <span className="font-bold text-lg text-destructive">{formatCurrency(conta.valorEmAberto)}</span>
          </div>
        </div>

        <div className="grid gap-4 py-2">
          {/* Data e Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataPagamento" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data do Pagamento *
              </Label>
              <Input
                id="dataPagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorPago" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Valor Pago *
              </Label>
              <Input
                id="valorPago"
                type="number"
                step="0.01"
                min="0"
                max={conta.valorEmAberto}
                value={valorPago}
                onChange={(e) => setValorPago(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Juros, Multa e Desconto */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="juros">Juros</Label>
              <Input
                id="juros"
                type="number"
                step="0.01"
                min="0"
                value={juros}
                onChange={(e) => setJuros(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="multa">Multa</Label>
              <Input
                id="multa"
                type="number"
                step="0.01"
                min="0"
                value={multa}
                onChange={(e) => setMulta(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desconto">Desconto</Label>
              <Input
                id="desconto"
                type="number"
                step="0.01"
                min="0"
                value={desconto}
                onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Forma de Pagamento e Conta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Forma de Pagamento
              </Label>
              <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMA_PAGAMENTO).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span>{icon} {label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select value={contaBancariaId || "none"} onValueChange={(v) => setContaBancariaId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informar</SelectItem>
                  {contasBancarias.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id}>
                      {cb.nome} - {formatCurrency(cb.saldoAtual)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre o pagamento..."
              rows={2}
            />
          </div>

          {/* Resumo do Pagamento */}
          <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4" />
              <span className="font-medium">Resumo do Pagamento</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Valor Principal:</span>
              <span className="text-right">{formatCurrency(valorPago)}</span>
              
              {juros > 0 && (
                <>
                  <span className="text-muted-foreground">+ Juros:</span>
                  <span className="text-right text-destructive">+{formatCurrency(juros)}</span>
                </>
              )}
              
              {multa > 0 && (
                <>
                  <span className="text-muted-foreground">+ Multa:</span>
                  <span className="text-right text-destructive">+{formatCurrency(multa)}</span>
                </>
              )}
              
              {desconto > 0 && (
                <>
                  <span className="text-muted-foreground">- Desconto:</span>
                  <span className="text-right text-success">-{formatCurrency(desconto)}</span>
                </>
              )}
            </div>
            <div className="flex items-center justify-between border-t pt-2 mt-2">
              <span className="font-medium">Total a Pagar:</span>
              <span className="font-bold text-lg">{formatCurrency(valorTotal)}</span>
            </div>

            {isParcial && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-amber-100 text-amber-800 rounded">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Pagamento parcial. Saldo restante: {formatCurrency(saldoRestante)}</span>
              </div>
            )}

            {!isParcial && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-emerald-100 text-emerald-800 rounded">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Pagamento integral. A conta será marcada como paga.</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-success hover:bg-success/90">
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
