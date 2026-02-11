import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface MlThumbnailProps {
  anuncioId: string | null;
  size?: number;
  className?: string;
}

/**
 * Exibe a thumbnail de um anúncio do Mercado Livre.
 * Usa a URL padrão do ML: http2.mlstatic.com/D_{MLB_ID}-I.jpg
 */
export function MlThumbnail({ anuncioId, size = 40, className }: MlThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  if (!anuncioId || hasError) {
    return (
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
  }

  const thumbnailUrl = `https://http2.mlstatic.com/D_${anuncioId}-I.jpg`;

  return (
    <img
      src={thumbnailUrl}
      alt="Anúncio"
      className={cn("rounded-md object-cover border border-border", className)}
      style={{ width: size, height: size, minWidth: size }}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
