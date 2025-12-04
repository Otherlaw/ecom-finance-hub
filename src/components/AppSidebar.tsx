import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarCheck,
  Wallet,
  CreditCard as CreditCardIcon,
  FileText,
  Scale,
  TrendingUp,
  LineChart,
  Receipt,
  RefreshCw,
  ClipboardCheck,
  Package,
  ShoppingCart,
  CreditCard,
  Truck,
  Calculator,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  LogOut,
  Bot,
  FolderTree,
  List,
  Sparkles,
  PenLine,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import logo from "@/assets/logo-ecom-finance.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Fechamento Mensal", href: "/fechamento", icon: CalendarCheck },
  { title: "Checklist por Canal", href: "/checklist-fechamento", icon: ClipboardCheck },
  { title: "Fluxo de Caixa", href: "/fluxo-caixa", icon: Wallet },
  { title: "DRE", href: "/dre", icon: FileText },
  { title: "Balanço Patrimonial", href: "/balanco", icon: Scale },
  { title: "KPIs", href: "/kpis", icon: TrendingUp },
  { title: "Projeções", href: "/projecoes", icon: LineChart },
  { title: "Crédito ICMS", href: "/icms", icon: Receipt, badge: "!" },
  { title: "Conciliações", href: "/conciliacao", icon: RefreshCw },
  { title: "Produtos", href: "/produtos", icon: Package },
  { title: "CMV & Margem", href: "/cmv", icon: BarChart3, badge: "V1" },
  { title: "Compras", href: "/compras", icon: ShoppingCart },
  { title: "Contas a Pagar", href: "/contas-pagar", icon: CreditCard },
  { title: "Contas a Receber", href: "/contas-receber", icon: TrendingUp },
  { title: "Cartões de Crédito", href: "/cartao-credito", icon: CreditCardIcon },
  { title: "Fornecedores", href: "/fornecedores", icon: Truck },
  { title: "Precificação", href: "/precificacao", icon: Calculator },
  { title: "Movimentações Manuais", href: "/movimentacoes-manuais", icon: PenLine },
  { title: "Assis.Fin", href: "/assistant", icon: Bot, badge: "IA" },
];

const settingsNavItems: NavItem[] = [
  { title: "Empresas", href: "/empresas", icon: Building2 },
  { title: "Centros de Custo", href: "/centros-custo", icon: FolderTree },
  { title: "Plano de Contas", href: "/plano-contas", icon: List },
  { title: "Regras Categorização", href: "/regras-categorizacao", icon: Sparkles },
  { title: "Usuários", href: "/usuarios", icon: Users },
  { title: "Configurações", href: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 h-16">
        <div className={cn("flex items-center gap-3 overflow-hidden", collapsed && "justify-center")}>
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <img src={logo} alt="Ecom Finance" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sidebar-accent-foreground text-sm">ECOM</span>
              <span className="text-primary text-xs font-semibold -mt-1">FINANCE</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "h-8 w-8 text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
            collapsed && "absolute right-2"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-primary"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary-foreground")} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="bg-warning text-warning-foreground text-xs font-bold px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <Separator className="bg-sidebar-border my-4" />

        <nav className="space-y-1">
          {settingsNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border">
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer",
            collapsed && "justify-center"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-semibold text-sm">AD</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">Admin</p>
              <p className="text-xs text-sidebar-foreground truncate">admin@ecomfinance.com</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
