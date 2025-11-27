import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type PeriodOption = "today" | "7days" | "15days" | "30days" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface PeriodFilterProps {
  selectedPeriod: PeriodOption;
  onPeriodChange: (period: PeriodOption, dateRange: DateRange) => void;
  isLoading?: boolean;
  className?: string;
}

const periodOptions: { value: PeriodOption; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Últimos 7 dias" },
  { value: "15days", label: "Últimos 15 dias" },
  { value: "30days", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" },
];

export function getDateRangeForPeriod(period: PeriodOption, customRange?: DateRange): DateRange {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  switch (period) {
    case "today":
      return { from: todayStart, to: todayEnd };
    case "7days":
      return { from: startOfDay(subDays(today, 6)), to: todayEnd };
    case "15days":
      return { from: startOfDay(subDays(today, 14)), to: todayEnd };
    case "30days":
      return { from: startOfDay(subDays(today, 29)), to: todayEnd };
    case "custom":
      return customRange || { from: todayStart, to: todayEnd };
    default:
      return { from: startOfDay(subDays(today, 29)), to: todayEnd };
  }
}

export function PeriodFilter({
  selectedPeriod,
  onPeriodChange,
  isLoading = false,
  className,
}: PeriodFilterProps) {
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handlePeriodClick = (period: PeriodOption) => {
    if (period === "custom") {
      setCustomPopoverOpen(true);
      return;
    }
    
    const dateRange = getDateRangeForPeriod(period);
    onPeriodChange(period, dateRange);
  };

  const handleApplyCustomPeriod = () => {
    if (!customDateFrom || !customDateTo) {
      setValidationError("Selecione ambas as datas.");
      return;
    }

    if (customDateTo < customDateFrom) {
      setValidationError("Período inválido. A data final deve ser maior ou igual à data inicial.");
      return;
    }

    setValidationError(null);
    setCustomPopoverOpen(false);
    
    const dateRange: DateRange = {
      from: startOfDay(customDateFrom),
      to: endOfDay(customDateTo),
    };
    
    onPeriodChange("custom", dateRange);
  };

  const formatPeriodLabel = () => {
    if (selectedPeriod === "custom" && customDateFrom && customDateTo) {
      return `${format(customDateFrom, "dd/MM/yy", { locale: ptBR })} - ${format(customDateTo, "dd/MM/yy", { locale: ptBR })}`;
    }
    return periodOptions.find(p => p.value === selectedPeriod)?.label || "Últimos 30 dias";
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Period indicator */}
      <div className="flex items-center gap-2 mr-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Período:</span>
        <Badge variant="outline" className="font-medium">
          {formatPeriodLabel()}
        </Badge>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>

      {/* Period buttons */}
      <div className="flex flex-wrap gap-1.5">
        {periodOptions.map((option) => (
          option.value !== "custom" ? (
            <Button
              key={option.value}
              variant={selectedPeriod === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => handlePeriodClick(option.value)}
              disabled={isLoading}
              className={cn(
                "text-xs h-8",
                selectedPeriod === option.value && "shadow-primary"
              )}
            >
              {option.label}
            </Button>
          ) : (
            <Popover 
              key={option.value} 
              open={customPopoverOpen} 
              onOpenChange={setCustomPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={selectedPeriod === "custom" ? "default" : "outline"}
                  size="sm"
                  disabled={isLoading}
                  className={cn(
                    "text-xs h-8 gap-1.5",
                    selectedPeriod === "custom" && "shadow-primary"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {option.label}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Período personalizado</p>
                    <p className="text-xs text-muted-foreground">
                      Selecione o intervalo de datas
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Data Inicial */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Data inicial
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !customDateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateFrom ? (
                              format(customDateFrom, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecionar</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDateFrom}
                            onSelect={setCustomDateFrom}
                            initialFocus
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Data Final */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Data final
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !customDateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateTo ? (
                              format(customDateTo, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecionar</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDateTo}
                            onSelect={setCustomDateTo}
                            initialFocus
                            locale={ptBR}
                            disabled={(date) => customDateFrom ? date < customDateFrom : false}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {validationError && (
                    <p className="text-xs text-destructive">{validationError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCustomPopoverOpen(false);
                        setValidationError(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleApplyCustomPeriod}>
                      Aplicar Filtro
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )
        ))}
      </div>
    </div>
  );
}
