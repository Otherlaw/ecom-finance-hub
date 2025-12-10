import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PLMovimento, PLMovimentoInsert, TIPO_MOVIMENTO_LABELS, GRUPO_PL_LABELS } from "@/hooks/usePatrimonio";
import { format } from "date-fns";

interface PLMovimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  movimento?: PLMovimento | null;
  tipoPreDefinido?: PLMovimento["tipo"];
  grupoPLPreDefinido?: PLMovimento["grupo_pl"];
  onSubmit: (data: PLMovimentoInsert | (Partial<PLMovimento> & { id: string })) => void;
  isLoading?: boolean;
}

// Mapeamento de tipo → grupo padrão
const TIPO_GRUPO_MAP: Record<PLMovimento["tipo"], PLMovimento["grupo_pl"]> = {
  saldo_inicial: "capital_social", // pode ser qualquer um
  aporte_socio: "capital_social",
  retirada_socio: "capital_social",
  ajuste_pl: "capital_social",
  reserva_lucros: "reservas",
  distribuicao_lucros: "lucros_acumulados",
  lucro_prejuizo_periodo: "lucros_acumulados",
};

// Tipos que permitem escolher o grupo
const TIPOS_COM_GRUPO_EDITAVEL: PLMovimento["tipo"][] = ["saldo_inicial"];

export function PLMovimentoModal({
  open,
  onOpenChange,
  empresaId,
  movimento,
  tipoPreDefinido,
  grupoPLPreDefinido,
  onSubmit,
  isLoading,
}: PLMovimentoModalProps) {
  const [tipo, setTipo] = useState<PLMovimento["tipo"]>("aporte_socio");
  const [grupoPL, setGrupoPL] = useState<PLMovimento["grupo_pl"]>("capital_social");
  const [dataReferencia, setDataReferencia] = useState(format(new Date(), "yyyy-MM-dd"));
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (movimento) {
      setTipo(movimento.tipo);
      setGrupoPL(movimento.grupo_pl);
      setDataReferencia(movimento.data_referencia);
      setValor(Math.abs(movimento.valor).toString());
      setDescricao(movimento.descricao || "");
    } else {
      const novoTipo = tipoPreDefinido || "aporte_socio";
      setTipo(novoTipo);
      setGrupoPL(grupoPLPreDefinido || TIPO_GRUPO_MAP[novoTipo]);
      setDataReferencia(format(new Date(), "yyyy-MM-dd"));
      setValor("");
      setDescricao("");
    }
  }, [movimento, tipoPreDefinido, grupoPLPreDefinido, open]);

  // Atualiza grupo quando tipo muda (se não for editável)
  useEffect(() => {
    if (!movimento && !TIPOS_COM_GRUPO_EDITAVEL.includes(tipo)) {
      setGrupoPL(TIPO_GRUPO_MAP[tipo]);
    }
  }, [tipo, movimento]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let valorFinal = parseFloat(valor) || 0;

    // Retiradas e distribuições são negativas
    if (tipo === "retirada_socio" || tipo === "distribuicao_lucros") {
      valorFinal = -Math.abs(valorFinal);
    }

    const data: PLMovimentoInsert = {
      empresa_id: empresaId,
      data_referencia: dataReferencia,
      tipo,
      grupo_pl: grupoPL,
      valor: valorFinal,
      descricao: descricao || undefined,
    };

    if (movimento) {
      onSubmit({ id: movimento.id, ...data });
    } else {
      onSubmit(data);
    }
  };

  const getTitulo = () => {
    if (movimento) return "Editar Movimento";
    if (tipoPreDefinido) return TIPO_MOVIMENTO_LABELS[tipoPreDefinido];
    return "Novo Movimento de Patrimônio";
  };

  const getDescricaoTipo = () => {
    switch (tipo) {
      case "saldo_inicial":
        return "Informe o saldo existente no início do uso do sistema.";
      case "aporte_socio":
        return "Valor investido pelos sócios na empresa.";
      case "retirada_socio":
        return "Valor retirado pelos sócios da empresa.";
      case "reserva_lucros":
        return "Parte do lucro destinada a reservas.";
      case "distribuicao_lucros":
        return "Lucros distribuídos aos sócios.";
      case "lucro_prejuizo_periodo":
        return "Resultado do período (gerado automaticamente no fechamento).";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitulo()}</DialogTitle>
          {getDescricaoTipo() && (
            <DialogDescription>{getDescricaoTipo()}</DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!tipoPreDefinido && (
            <div className="space-y-2">
              <Label>Tipo de Movimento *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as PLMovimento["tipo"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_MOVIMENTO_LABELS)
                    .filter(([key]) => key !== "lucro_prejuizo_periodo") // Este é automático
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(TIPOS_COM_GRUPO_EDITAVEL.includes(tipo) || tipo === "saldo_inicial") && (
            <div className="space-y-2">
              <Label>Grupo do Patrimônio Líquido *</Label>
              <Select value={grupoPL} onValueChange={(v) => setGrupoPL(v as PLMovimento["grupo_pl"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GRUPO_PL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Data de Referência *</Label>
            <Input
              type="date"
              value={dataReferencia}
              onChange={(e) => setDataReferencia(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>
              Valor (R$) *
              {(tipo === "retirada_socio" || tipo === "distribuicao_lucros") && (
                <span className="text-muted-foreground text-xs ml-2">
                  (será registrado como valor negativo)
                </span>
              )}
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes do movimento..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : movimento ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
