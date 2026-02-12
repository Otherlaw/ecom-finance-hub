import { Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";

interface MlThumbnailProps {
  anuncioId: string | null;
  size?: number;
  className?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function fetchMlThumbnailUrl(anuncioId: string, empresaId?: string): Promise<string | null> {
  const params = new URLSearchParams({ item_id: anuncioId });
  if (empresaId) params.set("empresa_id", empresaId);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ml-item-thumb?${params}`);
  if (!res.ok) {
    if (import.meta.env.DEV) console.warn(`[MlThumbnail] Falha ${res.status} para ${anuncioId}`);
    return null;
  }
  const data = await res.json();
  return data?.imageUrl ?? null;
}

export function MlThumbnail({ anuncioId, size = 40, className }: MlThumbnailProps) {
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id;
  const isValidId = !!anuncioId && anuncioId.startsWith("MLB");

  const { data: imageUrl, isLoading, isError } = useQuery({
    queryKey: ["ml-item-thumb", anuncioId, empresaId],
    queryFn: () => fetchMlThumbnailUrl(anuncioId!, empresaId ?? undefined),
    enabled: isValidId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const placeholder = (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-muted/50 border border-border",
        className
      )}
      style={{ width: size, height: size, minWidth: size }}
    >
      <Package className="h-4 w-4 text-muted-foreground/50" />
    </div>
  );

  if (!isValidId || isError || (!isLoading && !imageUrl)) {
    return placeholder;
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-md bg-muted/50 border border-border",
          className
        )}
        style={{ width: size, height: size, minWidth: size }}
      />
    );
  }

  return (
    <img
      src={imageUrl!}
      alt="Anúncio"
      className={cn("rounded-md object-cover border border-border", className)}
      style={{ width: size, height: size, minWidth: size }}
      loading="lazy"
    />
  );
}
