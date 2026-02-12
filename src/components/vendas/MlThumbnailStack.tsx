import { MlThumbnail } from "./MlThumbnail";

interface MlThumbnailStackProps {
  anuncioIds: (string | null)[];
  size?: number;
}

/**
 * Exibe 1 ou 2 thumbnails empilhadas (estilo Mercado Livre).
 * Quando há apenas 1 id, renderiza MlThumbnail simples.
 */
export function MlThumbnailStack({ anuncioIds, size = 32 }: MlThumbnailStackProps) {
  // Remover nulls e duplicados
  const uniqueIds = [...new Set(anuncioIds.filter(Boolean))] as string[];

  if (uniqueIds.length === 0) {
    return <MlThumbnail anuncioId={null} size={size} />;
  }

  if (uniqueIds.length === 1) {
    return <MlThumbnail anuncioId={uniqueIds[0]} size={size} />;
  }

  // Mostrar no máximo 2 thumbnails empilhadas
  const [id1, id2] = uniqueIds;
  const offset = Math.round(size * 0.35);

  return (
    <div
      className="relative"
      style={{ width: size + offset, height: size, minWidth: size + offset }}
    >
      {/* Thumbnail de trás (primeiro item) */}
      <div className="absolute left-0 top-0 z-0 rounded-md shadow-sm">
        <MlThumbnail anuncioId={id1} size={size} className="opacity-80" />
      </div>
      {/* Thumbnail da frente (segundo item) */}
      <div
        className="absolute top-0 z-10 rounded-md shadow-sm ring-1 ring-background"
        style={{ left: offset }}
      >
        <MlThumbnail anuncioId={id2} size={size} />
      </div>
    </div>
  );
}
