import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface VendasPaginationProps {
  currentPage: number;
  totalPaginas: number;
  totalRegistros: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function VendasPagination({
  currentPage,
  totalPaginas,
  totalRegistros,
  pageSize,
  onPageChange,
  isLoading,
}: VendasPaginationProps) {
  const inicio = currentPage * pageSize + 1;
  const fim = Math.min((currentPage + 1) * pageSize, totalRegistros);

  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPaginas - 1;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
      <div className="text-sm text-muted-foreground">
        Exibindo <span className="font-medium">{inicio}</span> a{" "}
        <span className="font-medium">{fim}</span> de{" "}
        <span className="font-medium">{totalRegistros}</span> registros
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(0)}
          disabled={!canGoPrev || isLoading}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm px-2">
          Página <span className="font-medium">{currentPage + 1}</span> de{" "}
          <span className="font-medium">{totalPaginas || 1}</span>
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext || isLoading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPaginas - 1)}
          disabled={!canGoNext || isLoading}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
