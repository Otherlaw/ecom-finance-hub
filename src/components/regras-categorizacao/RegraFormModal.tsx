import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const formSchema = z.object({
  estabelecimento_pattern: z.string().min(1, "Padrão é obrigatório"),
  categoria_id: z.string().optional(),
  centro_custo_id: z.string().optional(),
  responsavel_id: z.string().optional(),
  ativo: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface RegraFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regra?: {
    id: string;
    estabelecimento_pattern: string;
    categoria_id: string | null;
    centro_custo_id: string | null;
    responsavel_id: string | null;
    ativo: boolean;
  } | null;
}

export function RegraFormModal({ open, onOpenChange, regra }: RegraFormModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      estabelecimento_pattern: "",
      categoria_id: "",
      centro_custo_id: "",
      responsavel_id: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (regra) {
      form.reset({
        estabelecimento_pattern: regra.estabelecimento_pattern,
        categoria_id: regra.categoria_id || "",
        centro_custo_id: regra.centro_custo_id || "",
        responsavel_id: regra.responsavel_id || "",
        ativo: regra.ativo,
      });
    } else {
      form.reset({
        estabelecimento_pattern: "",
        categoria_id: "",
        centro_custo_id: "",
        responsavel_id: "",
        ativo: true,
      });
    }
  }, [regra, form]);

  const { data: categorias } = useQuery({
    queryKey: ["categorias_financeiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("ativo", true)
        .order("tipo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: centrosCusto } = useQuery({
    queryKey: ["centros_de_custo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_de_custo")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: responsaveis } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const DEFAULT_EMPRESA_ID = "d0b0c897-d560-4dc5-aa07-df99d3019bf5";

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        estabelecimento_pattern: data.estabelecimento_pattern.toLowerCase().trim(),
        categoria_id: data.categoria_id || null,
        centro_custo_id: data.centro_custo_id || null,
        responsavel_id: data.responsavel_id || null,
        ativo: data.ativo,
        empresa_id: DEFAULT_EMPRESA_ID,
      };

      if (regra) {
        const { error } = await supabase
          .from("regras_categorizacao")
          .update(payload)
          .eq("id", regra.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("regras_categorizacao")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao-full"] });
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao"] });
      toast.success(regra ? "Regra atualizada" : "Regra criada");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erro: " + error.message);
    },
  });

  const handleSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  // Agrupa categorias por tipo
  const categoriasPorTipo = categorias?.reduce((acc, cat) => {
    if (!acc[cat.tipo]) acc[cat.tipo] = [];
    acc[cat.tipo].push(cat);
    return acc;
  }, {} as Record<string, typeof categorias>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{regra ? "Editar Regra" : "Nova Regra"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="estabelecimento_pattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Padrão do Estabelecimento</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: uber, ifood, amazon"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    O sistema irá buscar transações que contenham este texto no nome do estabelecimento
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoria_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria Financeira</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {categoriasPorTipo &&
                        Object.entries(categoriasPorTipo).map(([tipo, cats]) => (
                          <div key={tipo}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                              {tipo}
                            </div>
                            {cats?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.nome}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="centro_custo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Centro de Custo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {centrosCusto?.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="responsavel_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {responsaveis?.map((resp) => (
                        <SelectItem key={resp.id} value={resp.id}>
                          {resp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Regra Ativa</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Regras inativas não serão usadas nas sugestões
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : regra ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
