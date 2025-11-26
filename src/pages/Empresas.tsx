import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Settings,
  Users,
  Store,
  MoreVertical,
  Check,
  ExternalLink,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const empresas = [
  {
    id: 1,
    nome: "Exchange Comercial",
    cnpj: "12.345.678/0001-90",
    marketplaces: ["Mercado Livre", "Shopee", "Shein"],
    usuarios: 3,
    status: "ativo",
  },
  {
    id: 2,
    nome: "Inpari Distribuição",
    cnpj: "98.765.432/0001-10",
    marketplaces: ["Mercado Livre"],
    usuarios: 2,
    status: "ativo",
  },
];

export default function Empresas() {
  return (
    <MainLayout
      title="Empresas"
      subtitle="Gerenciamento de empresas e operações"
      actions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      }
    >
      <ModuleCard
        title="Empresas Cadastradas"
        description="Gerencie suas operações"
        icon={Building2}
        noPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Marketplaces</TableHead>
              <TableHead className="text-center">Usuários</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((empresa) => (
              <TableRow key={empresa.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-medium">{empresa.nome}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{empresa.cnpj}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {empresa.marketplaces.map((mp) => (
                      <Badge key={mp} variant="outline" className="text-xs">
                        {mp}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {empresa.usuarios}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className="bg-success/10 text-success border-success/20">
                    <Check className="h-3 w-3 mr-1" />
                    Ativo
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" />
                        Configurações
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Store className="h-4 w-4 mr-2" />
                        Marketplaces
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Users className="h-4 w-4 mr-2" />
                        Usuários
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Acessar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleCard>

      {/* Marketplaces Conectados */}
      <div className="mt-6">
        <ModuleCard title="Marketplaces Conectados" description="Integrações ativas" icon={Store}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { name: "Mercado Livre", color: "hsl(48, 96%, 53%)", connected: true },
              { name: "Shopee", color: "hsl(16, 100%, 50%)", connected: true },
              { name: "Shein", color: "hsl(0, 0%, 15%)", connected: true },
              { name: "TikTok Shop", color: "hsl(0, 0%, 0%)", connected: false },
            ].map((mp) => (
              <div
                key={mp.name}
                className={`p-4 rounded-xl border ${
                  mp.connected ? "bg-card border-border" : "bg-secondary/30 border-dashed"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: mp.color + "20" }}>
                    <Store className="h-5 w-5" style={{ color: mp.color }} />
                  </div>
                  {mp.connected ? (
                    <Badge className="bg-success/10 text-success border-success/20">Conectado</Badge>
                  ) : (
                    <Badge variant="outline">Não conectado</Badge>
                  )}
                </div>
                <h4 className="font-medium">{mp.name}</h4>
                {mp.connected ? (
                  <p className="text-sm text-muted-foreground mt-1">Sincronizado</p>
                ) : (
                  <Button variant="link" className="p-0 h-auto text-sm text-primary">
                    Conectar agora
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
