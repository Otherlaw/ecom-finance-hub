import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canaisMarketplace, getMeses } from "@/lib/checklist-data";
import { useChecklistsCanal } from "@/hooks/useChecklistsCanal";
import { Loader2, ShoppingBag, Store, Shirt, Music } from "lucide-react";

interface CriarChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  canalIdInicial?: string;
  mesInicial?: number;
  anoInicial?: number;
  onSuccess?: (checklistId: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  ShoppingBag,
  Store,
  Shirt,
  Music,
};

export function CriarChecklistModal({
  open,
  onOpenChange,
  empresaId,
  canalIdInicial,
  mesInicial,
  anoInicial,
  onSuccess,
}: CriarChecklistModalProps) {
  const currentDate = new Date();
  const [canalId, setCanalId] = useState(canalIdInicial || "");
  const [mes, setMes] = useState(mesInicial || currentDate.getMonth() + 1);
  const [ano, setAno] = useState(anoInicial || currentDate.getFullYear());
  const [descricao, setDescricao] = useState("");

  const { criarChecklist } = useChecklistsCanal({ empresaId });

  // Gerar lista de anos (3 anos para trás + ano atual + 1 ano para frente)
  const anos = [];
  for (let i = currentDate.getFullYear() - 3; i <= currentDate.getFullYear() + 1; i++) {
    anos.push(i);
  }

  const handleSubmit = async () => {
    if (!canalId) return;

    try {
      const result = await criarChecklist.mutateAsync({
        empresaId,
        canalId,
        mes,
        ano,
        descricao: descricao.trim() || undefined,
      });

      onOpenChange(false);
      onSuccess?.(result.id);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const canalSelecionado = canaisMarketplace.find(c => c.id === canalId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Checklist de Fechamento</DialogTitle>
          <DialogDescription>
            Selecione o canal e período para criar um novo checklist de fechamento mensal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Canal */}
          <div className="space-y-2">
            <Label htmlFor="canal">Canal *</Label>
            <Select value={canalId} onValueChange={setCanalId}>
              <SelectTrigger id="canal">
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                {canaisMarketplace.map((canal) => {
                  const Icon = iconMap[canal.icone] || Store;
                  return (
                    <SelectItem key={canal.id} value={canal.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: canal.cor }}
                        />
                        <Icon className="h-4 w-4" />
                        {canal.nome}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mes">Mês *</Label>
              <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                <SelectTrigger id="mes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMeses().map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ano">Ano *</Label>
              <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                <SelectTrigger id="ano">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a.toString()}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição opcional */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Observações sobre este checklist..."
              rows={2}
            />
          </div>

          {/* Preview do canal selecionado */}
          {canalSelecionado && (
            <div
              className="p-3 rounded-lg border flex items-center gap-3"
              style={{ borderColor: canalSelecionado.cor, backgroundColor: `${canalSelecionado.cor}10` }}
            >
              {(() => {
                const Icon = iconMap[canalSelecionado.icone] || Store;
                return <Icon className="h-5 w-5" style={{ color: canalSelecionado.cor }} />;
              })()}
              <div>
                <p className="font-medium">{canalSelecionado.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {getMeses().find(m => m.value === mes)?.label} / {ano}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canalId || criarChecklist.isPending}
          >
            {criarChecklist.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
