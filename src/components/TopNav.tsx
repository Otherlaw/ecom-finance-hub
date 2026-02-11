import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarCheck, Wallet, CreditCard as CreditCardIcon,
  FileText, Scale, TrendingUp, LineChart, Receipt, RefreshCw, ClipboardCheck,
  Package, ShoppingCart, CreditCard, Truck, Calculator, Settings,
  Building2, Users, LogOut, Bot, FolderTree,
  List, Sparkles, PenLine, BarChart3, Store, Link2, Landmark, Menu, ChevronDown,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { EmpresaSelector } from "@/components/EmpresaSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Visão geral",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Vendas", href: "/vendas", icon: Store, badge: "NOVO" },
      { title: "Assis.Fin", href: "/assistant", icon: Bot, badge: "IA" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { title: "Fechamento Mensal", href: "/fechamento", icon: CalendarCheck },
      { title: "Checklist por Canal", href: "/checklist-fechamento", icon: ClipboardCheck },
      { title: "Fluxo de Caixa", href: "/fluxo-caixa", icon: Wallet },
      { title: "DRE", href: "/dre", icon: FileText },
      { title: "Balanço Patrimonial", href: "/balanco", icon: Scale },
      { title: "Patrimônio & Imobilizado", href: "/patrimonio", icon: Landmark },
      { title: "Crédito ICMS", href: "/icms", icon: Receipt, badge: "!" },
      { title: "Conciliações", href: "/conciliacao", icon: RefreshCw },
    ],
  },
  {
    title: "Indicadores",
    items: [
      { title: "KPIs", href: "/kpis", icon: TrendingUp },
      { title: "Projeções", href: "/projecoes", icon: LineChart },
    ],
  },
  {
    title: "Operação",
    items: [
      { title: "Produtos", href: "/produtos", icon: Package },
      { title: "Estoque SKU", href: "/estoque-sku", icon: Package, badge: "V1" },
      { title: "CMV & Margem", href: "/cmv", icon: BarChart3, badge: "V1" },
      { title: "Compras", href: "/compras", icon: ShoppingCart },
      { title: "Contas a Pagar", href: "/contas-pagar", icon: CreditCard },
      { title: "Contas a Receber", href: "/contas-receber", icon: TrendingUp },
      { title: "Cartões de Crédito", href: "/cartao-credito", icon: CreditCardIcon },
      { title: "Fornecedores", href: "/fornecedores", icon: Truck },
      { title: "Precificação", href: "/precificacao", icon: Calculator },
      { title: "Mov. Manuais", href: "/movimentacoes-manuais", icon: PenLine },
    ],
  },
  {
    title: "Configurações",
    items: [
      { title: "Integrações", href: "/integracoes", icon: Link2 },
      { title: "Empresas", href: "/empresas", icon: Building2 },
      { title: "Centros de Custo", href: "/centros-custo", icon: FolderTree },
      { title: "Plano de Contas", href: "/plano-contas", icon: List },
      { title: "Regras Categorização", href: "/regras-categorizacao", icon: Sparkles },
      { title: "Regras Marketplace", href: "/regras-marketplace", icon: Store },
      { title: "Mapeamentos MLB ↔ SKU", href: "/mapeamentos-marketplace", icon: Link2 },
      { title: "Usuários", href: "/usuarios", icon: Users },
      { title: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

// "Visão geral" items are rendered as direct links; the rest as dropdown sections
const directLinks = navSections[0]; // Visão geral
const dropdownSections = navSections.slice(1); // Financeiro, Indicadores, Operação, Configurações

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== "/" && location.pathname.startsWith(href + "/"));

  const isSectionActive = (section: NavSection) =>
    section.items.some((item) => isActive(item.href));

  const userInitials = profile?.nome
    ? profile.nome.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  const userName = profile?.nome || "Usuário";

  const renderBadge = (badge?: string) => {
    if (!badge) return null;
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary leading-none ml-1">
        {badge}
      </span>
    );
  };

  // ===================== DESKTOP =====================
  const renderDesktopNav = () => (
    <div className="hidden lg:flex items-center gap-1">
      {/* Direct links: Visão geral */}
      {directLinks.items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
          {renderBadge(item.badge)}
        </NavLink>
      ))}

      {/* Dropdown sections */}
      {dropdownSections.map((section) => (
        <DropdownMenu key={section.title}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1 text-sm font-medium",
                isSectionActive(section)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {section.title}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[240px] bg-popover border border-border shadow-lg z-50"
          >
            {section.items.map((item) => (
              <DropdownMenuItem
                key={item.href}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  isActive(item.href) && "bg-accent text-accent-foreground font-medium"
                )}
                onClick={() => navigate(item.href)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.title}</span>
                {renderBadge(item.badge)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );

  // ===================== MOBILE =====================
  const renderMobileNav = () => (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 bg-card">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            <img
              alt="Ecom Finance"
              className="w-8 h-8 object-cover"
              src="/lovable-uploads/0200f86d-1ded-4add-a32c-89e9239435d9.png"
            />
            <div className="flex flex-col">
              <span className="font-bold text-foreground text-sm">ECOM</span>
              <span className="text-primary text-xs font-semibold -mt-1">FINANCE</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="p-3 border-b border-border">
          <EmpresaSelector />
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-4" style={{ maxHeight: "calc(100vh - 180px)" }}>
          {navSections.map((section) => (
            <div key={section.title}>
              <span className="px-3 mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                {section.title}
              </span>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.title}</span>
                    {renderBadge(item.badge)}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User section */}
        <div className="p-3 border-t border-border mt-auto">
          <div className="flex items-center gap-3 p-2">
            <div
              onClick={() => { navigate("/perfil"); setMobileOpen(false); }}
              className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/30 transition-colors"
            >
              <span className="text-primary font-semibold text-sm">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { navigate("/perfil"); setMobileOpen(false); }}>
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <header className="sticky top-0 z-40 h-14 bg-card border-b border-border">
      <div className="h-full flex items-center px-4 gap-3">
        {/* Mobile hamburger */}
        {renderMobileNav()}

        {/* Logo */}
        <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0">
          <img
            alt="Ecom Finance"
            className="w-8 h-8 object-cover"
            src="/lovable-uploads/0200f86d-1ded-4add-a32c-89e9239435d9.png"
          />
          <div className="hidden sm:flex flex-col">
            <span className="font-bold text-foreground text-sm leading-tight">ECOM</span>
            <span className="text-primary text-xs font-semibold -mt-1">FINANCE</span>
          </div>
        </NavLink>

        <Separator orientation="vertical" className="h-6 hidden lg:block" />

        {/* Desktop nav */}
        {renderDesktopNav()}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side: empresa selector + notifications + user */}
        <div className="hidden md:flex items-center">
          <EmpresaSelector />
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/assistant")}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Central de Alertas</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* User avatar - desktop */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden md:flex w-8 h-8 rounded-full bg-primary/20 items-center justify-center shrink-0 cursor-pointer hover:bg-primary/30 transition-colors">
              <span className="text-primary font-semibold text-xs">{userInitials}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px] bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/perfil")} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
