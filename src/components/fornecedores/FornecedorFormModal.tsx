import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Fornecedor,
  validateFornecedor,
  createEmptyFornecedor,
  TIPO_FORNECEDOR_CONFIG,
  REGIME_TRIBUTARIO_FORNECEDOR_CONFIG,
  ORIGEM_FORNECEDOR_CONFIG,
  SEGMENTO_FORNECEDOR_CONFIG,
  FORMA_PAGAMENTO_PADRAO_CONFIG,
  UFS_BRASIL,
  formatCNPJ,
  formatCEP,
  formatPhone,
  TipoFornecedor,
  RegimeTributarioFornecedor,
  OrigemFornecedor,
  SegmentoFornecedor,
  FormaPagamentoPadrao,
} from '@/lib/fornecedores-data';
import { Building2, MapPin, User, CreditCard, FileText } from 'lucide-react';

interface FornecedorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedor: Fornecedor | null;
  onSave: (fornecedor: Fornecedor) => void;
}

export function FornecedorFormModal({ open, onOpenChange, fornecedor, onSave }: FornecedorFormModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Fornecedor>>(createEmptyFornecedor());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (fornecedor) {
        setFormData(fornecedor);
      } else {
        setFormData(createEmptyFornecedor());
      }
      setErrors({});
    }
  }, [open, fornecedor]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleEnderecoChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      endereco: { ...prev.endereco!, [field]: value },
    }));
  };

  const handleContatoChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      contato: { ...prev.contato!, [field]: value },
    }));
  };

  const handleCondicoesPagamentoChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      condicoesPagamento: { ...prev.condicoesPagamento!, [field]: value },
    }));
  };

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    handleChange('cnpj', formatted);
  };

  const handleCEPChange = (value: string) => {
    const formatted = formatCEP(value);
    handleEnderecoChange('cep', formatted);
  };

  const handlePhoneChange = (field: string, value: string) => {
    const formatted = formatPhone(value);
    handleContatoChange(field, formatted);
  };

  const handleSave = () => {
    const validation = validateFornecedor(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast({
        title: 'Erro de validação',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const savedFornecedor: Fornecedor = {
      ...formData as Fornecedor,
      id: fornecedor?.id || `forn-${Date.now()}`,
      dataCadastro: fornecedor?.dataCadastro || now,
      dataAtualizacao: now,
    };

    onSave(savedFornecedor);
    toast({
      title: fornecedor ? 'Fornecedor atualizado' : 'Fornecedor cadastrado',
      description: `${savedFornecedor.razaoSocial} foi ${fornecedor ? 'atualizado' : 'cadastrado'} com sucesso.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="identificacao" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />Identificação
              </TabsTrigger>
              <TabsTrigger value="endereco" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />Endereço
              </TabsTrigger>
              <TabsTrigger value="contato" className="text-xs">
                <User className="h-3 w-3 mr-1" />Contato
              </TabsTrigger>
              <TabsTrigger value="comercial" className="text-xs">
                <CreditCard className="h-3 w-3 mr-1" />Comercial
              </TabsTrigger>
              <TabsTrigger value="observacoes" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />Obs.
              </TabsTrigger>
            </TabsList>

            {/* Identificação */}
            <TabsContent value="identificacao" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Razão Social *</Label>
                  <Input
                    value={formData.razaoSocial || ''}
                    onChange={(e) => handleChange('razaoSocial', e.target.value)}
                    className={errors.razaoSocial ? 'border-destructive' : ''}
                    placeholder="Razão Social completa"
                  />
                  {errors.razaoSocial && <span className="text-xs text-destructive">{errors.razaoSocial}</span>}
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={formData.nomeFantasia || ''}
                    onChange={(e) => handleChange('nomeFantasia', e.target.value)}
                    placeholder="Nome fantasia"
                  />
                </div>
                <div>
                  <Label>CNPJ *</Label>
                  <Input
                    value={formData.cnpj || ''}
                    onChange={(e) => handleCNPJChange(e.target.value)}
                    className={errors.cnpj ? 'border-destructive' : ''}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                  {errors.cnpj && <span className="text-xs text-destructive">{errors.cnpj}</span>}
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={formData.inscricaoEstadual || ''}
                    onChange={(e) => handleChange('inscricaoEstadual', e.target.value)}
                    placeholder="Número da IE"
                  />
                </div>
                <div>
                  <Label>Regime Tributário</Label>
                  <Select
                    value={formData.regimeTributario}
                    onValueChange={(value) => handleChange('regimeTributario', value as RegimeTributarioFornecedor)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIME_TRIBUTARIO_FORNECEDOR_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Fornecedor *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => handleChange('tipo', value as TipoFornecedor)}
                  >
                    <SelectTrigger className={errors.tipo ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_FORNECEDOR_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tipo && <span className="text-xs text-destructive">{errors.tipo}</span>}
                </div>
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={formData.origem}
                    onValueChange={(value) => handleChange('origem', value as OrigemFornecedor)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ORIGEM_FORNECEDOR_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Segmento</Label>
                  <Select
                    value={formData.segmento}
                    onValueChange={(value) => handleChange('segmento', value as SegmentoFornecedor)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SEGMENTO_FORNECEDOR_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange('status', value as 'ativo' | 'inativo')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Endereço */}
            <TabsContent value="endereco" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={formData.endereco?.logradouro || ''}
                    onChange={(e) => handleEnderecoChange('logradouro', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={formData.endereco?.numero || ''}
                    onChange={(e) => handleEnderecoChange('numero', e.target.value)}
                    placeholder="Nº"
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={formData.endereco?.complemento || ''}
                    onChange={(e) => handleEnderecoChange('complemento', e.target.value)}
                    placeholder="Sala, Andar, etc."
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={formData.endereco?.bairro || ''}
                    onChange={(e) => handleEnderecoChange('bairro', e.target.value)}
                    placeholder="Bairro"
                  />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={formData.endereco?.cep || ''}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input
                    value={formData.endereco?.cidade || ''}
                    onChange={(e) => handleEnderecoChange('cidade', e.target.value)}
                    className={errors.cidade ? 'border-destructive' : ''}
                    placeholder="Cidade"
                  />
                  {errors.cidade && <span className="text-xs text-destructive">{errors.cidade}</span>}
                </div>
                <div>
                  <Label>UF *</Label>
                  <Select
                    value={formData.endereco?.uf}
                    onValueChange={(value) => handleEnderecoChange('uf', value)}
                  >
                    <SelectTrigger className={errors.uf ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS_BRASIL.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.uf && <span className="text-xs text-destructive">{errors.uf}</span>}
                </div>
                <div>
                  <Label>País</Label>
                  <Input
                    value={formData.endereco?.pais || 'Brasil'}
                    onChange={(e) => handleEnderecoChange('pais', e.target.value)}
                    placeholder="País"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Contato */}
            <TabsContent value="contato" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nome do Contato Principal</Label>
                  <Input
                    value={formData.contato?.nome || ''}
                    onChange={(e) => handleContatoChange('nome', e.target.value)}
                    placeholder="Nome do contato"
                  />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.contato?.email || ''}
                    onChange={(e) => handleContatoChange('email', e.target.value)}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <Label>Telefone Fixo</Label>
                  <Input
                    value={formData.contato?.telefoneFixo || ''}
                    onChange={(e) => handlePhoneChange('telefoneFixo', e.target.value)}
                    placeholder="(00) 0000-0000"
                    maxLength={14}
                  />
                </div>
                <div>
                  <Label>Celular / WhatsApp</Label>
                  <Input
                    value={formData.contato?.celularWhatsApp || ''}
                    onChange={(e) => handlePhoneChange('celularWhatsApp', e.target.value)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div>
                  <Label>Site</Label>
                  <Input
                    value={formData.contato?.site || ''}
                    onChange={(e) => handleContatoChange('site', e.target.value)}
                    placeholder="www.empresa.com.br"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Comercial */}
            <TabsContent value="comercial" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Pagamento Padrão</Label>
                  <Select
                    value={formData.condicoesPagamento?.formaPagamento}
                    onValueChange={(value) => handleCondicoesPagamentoChange('formaPagamento', value as FormaPagamentoPadrao)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORMA_PAGAMENTO_PADRAO_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo Médio (dias)</Label>
                  <Input
                    type="number"
                    value={formData.condicoesPagamento?.prazoMedioDias || ''}
                    onChange={(e) => handleCondicoesPagamentoChange('prazoMedioDias', parseInt(e.target.value) || 0)}
                    placeholder="Ex: 14, 21, 28"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Observações sobre Condições de Pagamento</Label>
                  <Textarea
                    value={formData.condicoesPagamento?.observacoes || ''}
                    onChange={(e) => handleCondicoesPagamentoChange('observacoes', e.target.value)}
                    placeholder="Detalhes sobre condições de pagamento..."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Observações */}
            <TabsContent value="observacoes" className="space-y-4 mt-4">
              <div>
                <Label>Observações Gerais</Label>
                <Textarea
                  value={formData.observacoes || ''}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  placeholder="Observações sobre o fornecedor..."
                  rows={6}
                />
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{fornecedor ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
