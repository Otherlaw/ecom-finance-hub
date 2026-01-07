/**
 * Modal para criar/editar Movimentação Manual
 * 
 * Modal auto-contido que gerencia criação/edição de movimentos manuais.
 * Integra com manual_transactions + sync automático ao FLOW HUB via useManualTransactions.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { useMovimentacoesManuais } from "@/hooks/useManualTransactions";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

import { ManualTransaction } from "@/hooks/useManualTransactions";

const formSchema = z.object({
  data: z.string().min(1, "Data é obrigatória"),
  tipo: z.enum(["entrada", "saida"], { required_error: "Tipo é obrigatório" }),
  valor: z.number().positive("Valor deve ser maior que zero"),
  descricao: z.string().min(1, "Descrição é obrigatória").max(200, "Máximo 200 caracteres"),
  empresaId: z.string().min(1, "Empresa é obrigatória"),
  categoriaId: z.string().min(1, "Categoria é obrigatória"),
  centroCustoId: z.string().optional(),
  responsavelId: z.string().optional(),
  formaPagamento: z.string().optional(),
  observacoes: z.string().max(500, "Máximo 500 caracteres").optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MovimentacaoManualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentacao?: ManualTransaction | null;
  onSuccess?: () => void;
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência Bancária" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "cheque", label: "Cheque" },
  { value: "outro", label: "Outro" },
];

export function MovimentoManualFormModal({
  open,
  onOpenChange,
  movimentacao,
  onSuccess,
}: MovimentacaoManualModalProps) {
  const { empresas } = useEmpresas();
  const { empresaAtiva } = useEmpresaAtiva();
  const { categorias } = useCategoriasFinanceiras();
  const { centrosFlat } = useCentrosCusto();
  const { responsaveis } = useResponsaveis();
  const { createMovimentacao, updateMovimentacao } = useMovimentacoesManuais({});
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!movimentacao;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data: format(new Date(), "yyyy-MM-dd"),
      tipo: "saida",
      valor: 0,
      descricao: "",
      empresaId: "",
      categoriaId: "",
      centroCustoId: "",
      responsavelId: "",
      formaPagamento: "",
      observacoes: "",
    },
  });

  const tipoSelecionado = watch("tipo");
  const categoriaSelecionada = watch("categoriaId");

  // Preencher form ao abrir
  useEffect(() => {
    if (movimentacao && open) {
      reset({
        data: movimentacao.data,
        tipo: movimentacao.tipo as "entrada" | "saida",
        valor: movimentacao.valor,
        descricao: movimentacao.descricao,
        empresaId: movimentacao.empresa_id,
        categoriaId: movimentacao.categoria_id || "",
        centroCustoId: movimentacao.centro_custo_id || "",
        responsavelId: movimentacao.responsavel_id || "",
        formaPagamento: "",
        observacoes: movimentacao.observacoes || "",
      });
    } else if (!movimentacao && open) {
      reset({
        data: format(new Date(), "yyyy-MM-dd"),
        tipo: "saida",
        valor: 0,
        descricao: "",
        empresaId: empresaAtiva?.id || "",
        categoriaId: "",
        centroCustoId: "",
        responsavelId: "",
        formaPagamento: "",
        observacoes: "",
      });
    }
  }, [movimentacao, open, reset, empresaAtiva]);

  // Filtrar categorias por tipo (receitas para entrada, despesas para saída)
  const categoriasDisponiveis = categorias?.filter((cat) => {
    if (tipoSelecionado === "entrada") {
      return cat.tipo.toLowerCase().includes("receita");
    }
    return !cat.tipo.toLowerCase().includes("receita");
  }) || [];

  const handleFormSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload = {
        empresa_id: data.empresaId,
        data: data.data,
        tipo: data.tipo as "entrada" | "saida",
        valor: data.valor,
        descricao: data.descricao,
        categoria_id: data.categoriaId || null,
        centro_custo_id: data.centroCustoId || null,
        responsavel_id: data.responsavelId || null,
        observacoes: data.observacoes || null,
      };

      if (isEditing && movimentacao?.id) {
        await updateMovimentacao.mutateAsync({ id: movimentacao.id, ...payload });
      } else {
        await createMovimentacao.mutateAsync(payload);
      }

      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || createMovimentacao.isPending || updateMovimentacao.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Movimentação Manual" : "Nova Movimentação Manual"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de Movimentação *</Label>
            <RadioGroup
              value={tipoSelecionado}
              onValueChange={(value) => setValue("tipo", value as "entrada" | "saida")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="entrada" id="entrada" />
                <Label htmlFor="entrada" className="text-emerald-600 font-medium cursor-pointer">
                  Entrada
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="saida" id="saida" />
                <Label htmlFor="saida" className="text-red-600 font-medium cursor-pointer">
                  Saída
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Data e Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                {...register("data")}
                className={errors.data ? "border-destructive" : ""}
              />
              {errors.data && (
                <p className="text-xs text-destructive">{errors.data.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                {...register("valor", { valueAsNumber: true })}
                className={errors.valor ? "border-destructive" : ""}
              />
              {errors.valor && (
                <p className="text-xs text-destructive">{errors.valor.message}</p>
              )}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              placeholder="Ex: Pagamento de aluguel"
              {...register("descricao")}
              className={errors.descricao ? "border-destructive" : ""}
            />
            {errors.descricao && (
              <p className="text-xs text-destructive">{errors.descricao.message}</p>
            )}
          </div>

          {/* Empresa */}
          <div className="space-y-2">
            <Label>Empresa *</Label>
            <Select
              value={watch("empresaId")}
              onValueChange={(value) => setValue("empresaId", value)}
            >
              <SelectTrigger className={errors.empresaId ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas?.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome_fantasia || empresa.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.empresaId && (
              <p className="text-xs text-destructive">{errors.empresaId.message}</p>
            )}
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria Financeira *</Label>
            <Select
              value={categoriaSelecionada}
              onValueChange={(value) => setValue("categoriaId", value)}
            >
              <SelectTrigger className={errors.categoriaId ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDisponiveis.map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoriaId && (
              <p className="text-xs text-destructive">{errors.categoriaId.message}</p>
            )}
          </div>

          {/* Centro de Custo */}
          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select
              value={watch("centroCustoId") || ""}
              onValueChange={(value) => setValue("centroCustoId", value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {centrosFlat?.map((centro) => (
                  <SelectItem key={centro.id} value={centro.id}>
                    {centro.fullPath || centro.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={watch("responsavelId") || ""}
              onValueChange={(value) => setValue("responsavelId", value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {responsaveis?.map((resp) => (
                  <SelectItem key={resp.id} value={resp.id}>
                    {resp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select
              value={watch("formaPagamento") || ""}
              onValueChange={(value) => setValue("formaPagamento", value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                {FORMAS_PAGAMENTO.map((forma) => (
                  <SelectItem key={forma.value} value={forma.value}>
                    {forma.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais (opcional)"
              rows={3}
              {...register("observacoes")}
              className={errors.observacoes ? "border-destructive" : ""}
            />
            {errors.observacoes && (
              <p className="text-xs text-destructive">{errors.observacoes.message}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Movimentação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
