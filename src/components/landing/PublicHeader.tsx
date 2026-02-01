import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Recursos", href: "/recursos" },
  { label: "Planos", href: "/planos" },
  { label: "Ajuda", href: "/ajuda" },
];

export function PublicHeader() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
            <img
              src="/lovable-uploads/logo-ecom-finance-icon.png"
              alt="Ecom Finance"
              className="w-10 h-10 object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground text-sm leading-tight">ECOM</span>
            <span className="text-primary text-xs font-medium leading-tight">FINANCE</span>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                location.pathname === item.href
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link to="/auth?tab=cadastro">Cadastrar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
