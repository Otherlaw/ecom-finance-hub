import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, FileSpreadsheet, ArrowLeft, Package, Layers, Box } from "lucide-react";
import { Link } from "react-router-dom";
import { ImportarProdutosV2 } from "@/components/products/ImportarProdutosV2";
import { ExportarProdutosV2 } from "@/components/products/ExportarProdutosV2";
import { ProdutoImportJobsPanel } from "@/components/products/ProdutoImportJobsPanel";

export default function ProdutosImportExport() {
  const [activeTab, setActiveTab] = useState("importar");

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/produtos">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Importar & Exportar Produtos</h1>
              <p className="text-muted-foreground">
                Gerencie produtos em massa com suporte a tipos, variações e kits
              </p>
            </div>
          </div>
        </div>

        {/* Cards informativos sobre tipos de produto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produto Único
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                SKU individual sem variações. Estoque próprio por armazém.
              </p>
              <code className="text-xs bg-muted px-1 rounded mt-1 block">type = "single"</code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Variações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                SKU pai (agrupador) + SKUs filhos (cor, tamanho). Estoque nos filhos.
              </p>
              <code className="text-xs bg-muted px-1 rounded mt-1 block">type = "variation_parent" / "variation_child"</code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Box className="h-4 w-4" />
                Kit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                SKU kit composto por outros SKUs. Estoque calculado automaticamente.
              </p>
              <code className="text-xs bg-muted px-1 rounded mt-1 block">type = "kit" + kit_components</code>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="importar" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar
            </TabsTrigger>
            <TabsTrigger value="exportar" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Importações em Andamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="importar">
            <ImportarProdutosV2 />
          </TabsContent>

          <TabsContent value="exportar">
            <ExportarProdutosV2 />
          </TabsContent>

          <TabsContent value="jobs">
            <ProdutoImportJobsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
