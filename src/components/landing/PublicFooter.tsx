import { Link } from "react-router-dom";

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <img
                  src="/lovable-uploads/8b500e39-461b-4657-8aad-acb0ee7422e1.png"
                  alt="Ecom Finance"
                  className="w-5 h-5 object-contain"
                />
              </div>
              <span className="font-bold text-sm">ECOM FINANCE</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A plataforma completa para gestao financeira do seu e-commerce.
            </p>
          </div>

          {/* Links - Produto */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Produto</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/recursos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Recursos
              </Link>
              <Link to="/planos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Planos
              </Link>
            </nav>
          </div>

          {/* Links - Suporte */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Suporte</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/ajuda" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Central de Ajuda
              </Link>
              <a href="mailto:suporte@ecomfinance.com" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Contato
              </a>
            </nav>
          </div>

          {/* Links - Legal */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Legal</h4>
            <nav className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">
                Termos de Uso
              </span>
              <span className="text-sm text-muted-foreground">
                Politica de Privacidade
              </span>
            </nav>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {new Date().getFullYear()} ECOM Finance. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
