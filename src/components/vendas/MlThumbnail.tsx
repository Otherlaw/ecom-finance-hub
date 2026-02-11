import { Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface MlThumbnailProps {
  anuncioId: string | null;
  size?: number;
  className?: string;
}

async function fetchMlThumbnailUrl(anuncioId: string): Promise<string | null> {
  const res = await fetch(`https://api.mercadolibre.com/items/${anuncioId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (
    data?.secure_thumbnail ||
    data?.thumbnail ||
    data?.pictures?.[0]?.secure_url ||
    data?.pictures?.[0]?.url ||
    null
  );
}

export function MlThumbnail({ anuncioId, size = 40, className }: MlThumbnailProps) {
  const { data: imageUrl, isLoading, isError } = useQuery({
    queryKey: ["ml-item-thumb", anuncioId],
    queryFn: () => fetchMlThumbnailUrl(anuncioId!),
    enabled: !!anuncioId,
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

  if (!anuncioId || isError || (!isLoading && !imageUrl)) {
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
