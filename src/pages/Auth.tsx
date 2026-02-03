import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Building2, FileText, Briefcase, ShieldCheck, RefreshCw } from "lucide-react";
const logoEcomFinance = "/lovable-uploads/logo-ecom-finance-auth.png";
import { formatCNPJ } from "@/lib/empresas-data";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Auth() {
  const navigate = useNavigate();
  const {
    signIn,
    signUp,
    resetPassword,
    isAuthenticated,
    loading: authLoading
  } = useAuth();
  const {
    createEmpresa
  } = useEmpresas();
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<"login" | "signup" | "forgot" | "verify">("login");
  const [rememberMe, setRememberMe] = useState(false);

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState("");

  // Signup form - Dados da Empresa
  const [signupRazaoSocial, setSignupRazaoSocial] = useState("");
  const [signupNomeFantasia, setSignupNomeFantasia] = useState("");
  const [signupCnpj, setSignupCnpj] = useState("");
  const [signupRegime, setSignupRegime] = useState<string>("");

  // Signup form - Dados de Acesso
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  // Verification code
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingSignupData, setPendingSignupData] = useState<{
    email: string;
    password: string;
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    regime: string;
  } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);

  // Redirecionar se já autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Cleanup cooldown interval
  useEffect(() => {
    return () => {
      if (cooldownInterval.current) {
        clearInterval(cooldownInterval.current);
      }
    };
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(60);
    if (cooldownInterval.current) {
      clearInterval(cooldownInterval.current);
    }
    cooldownInterval.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (cooldownInterval.current) {
            clearInterval(cooldownInterval.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setSignupCnpj(formatted);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    setIsLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast.success("Login realizado com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Informe seu e-mail");
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(forgotEmail);
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setActiveView("login");
      setForgotEmail("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar e-mail de recuperação");
    } finally {
      setIsLoading(false);
    }
  };

  const sendVerificationCode = async (email: string, nomeEmpresa: string) => {
    const { data, error } = await supabase.functions.invoke('send-verification-code', {
      body: { email, nomeEmpresa }
    });
    
    if (error) {
      console.error("Error sending verification code:", error);
      throw new Error("Erro ao enviar código de verificação");
    }
    
    if (!data?.success) {
      throw new Error(data?.error || "Erro ao enviar código de verificação");
    }
    
    return data;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!signupRazaoSocial || !signupCnpj || !signupRegime || !signupEmail || !signupPassword) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validar CNPJ (14 dígitos)
    const cnpjDigits = signupCnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      toast.error("CNPJ inválido - deve conter 14 dígitos");
      return;
    }
    if (signupPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    
    setIsLoading(true);
    try {
      // Verificar se CNPJ já existe
      const { data: existingEmpresa } = await supabase
        .from("empresas")
        .select("id")
        .eq("cnpj", signupCnpj)
        .maybeSingle();

      if (existingEmpresa) {
        toast.error("Este CNPJ já está cadastrado no sistema");
        setIsLoading(false);
        return;
      }

      // Verificar se email já existe
      // Note: This is a soft check, actual signup will fail if email exists in auth.users
      
      // Save signup data for after verification
      setPendingSignupData({
        email: signupEmail,
        password: signupPassword,
        razaoSocial: signupRazaoSocial,
        nomeFantasia: signupNomeFantasia,
        cnpj: signupCnpj,
        regime: signupRegime,
      });

      // Send verification code
      await sendVerificationCode(signupEmail, signupRazaoSocial);
      
      toast.success("Código de verificação enviado para seu e-mail!");
      startResendCooldown();
      setActiveView("verify");
      setVerificationCode("");
    } catch (error: any) {
      console.error("Erro no cadastro:", error);
      toast.error(error.message || "Erro ao enviar código de verificação");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!pendingSignupData || resendCooldown > 0) return;
    
    setIsLoading(true);
    try {
      await sendVerificationCode(pendingSignupData.email, pendingSignupData.razaoSocial);
      toast.success("Novo código enviado!");
      startResendCooldown();
      setVerificationCode("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao reenviar código");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    
    if (!pendingSignupData) {
      toast.error("Dados de cadastro não encontrados. Por favor, refaça o cadastro.");
      setActiveView("signup");
      return;
    }
    
    setIsLoading(true);
    try {
      // Verify code
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-email-code', {
        body: { 
          email: pendingSignupData.email, 
          code: verificationCode 
        }
      });
      
      if (verifyError) {
        throw new Error("Erro ao verificar código");
      }
      
      if (!verifyData?.valid) {
        toast.error(verifyData?.error || "Código inválido");
        setIsLoading(false);
        return;
      }
      
      // Code is valid, proceed with signup
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: pendingSignupData.email,
        password: pendingSignupData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nome: pendingSignupData.razaoSocial,
            empresa_razao_social: pendingSignupData.razaoSocial,
            empresa_nome_fantasia: pendingSignupData.nomeFantasia || null,
            empresa_cnpj: pendingSignupData.cnpj,
            empresa_regime: pendingSignupData.regime,
          },
        },
      });
      
      if (error) {
        if (error.message.includes("User already registered")) {
          throw new Error("Este email já está cadastrado");
        }
        throw error;
      }
      
      // Send welcome email (fire and forget)
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            email: pendingSignupData.email,
            nomeEmpresa: pendingSignupData.razaoSocial,
            appUrl: window.location.origin
          }
        });
        console.log("Welcome email sent successfully");
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
      
      toast.success("Conta criada com sucesso! Você já pode fazer login.");
      
      // Clear pending data
      setPendingSignupData(null);
      setVerificationCode("");
      
      // Go to login
      setActiveView("login");
      setLoginEmail(pendingSignupData.email);
    } catch (error: any) {
      console.error("Erro na verificação:", error);
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Tela de verificação de código
  if (activeView === "verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-md border bg-background">
          <CardContent className="p-6 flex flex-col gap-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <img src={logoEcomFinance} alt="ECOM Finance" className="h-14" />
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold">Confirme seu e-mail</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Enviamos um código de 6 dígitos para
                </p>
                <p className="text-sm font-medium text-primary mt-1">
                  {pendingSignupData?.email}
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyCode} className="flex flex-col gap-6">
              {/* OTP Input */}
              <div className="flex flex-col items-center gap-4">
                <InputOTP 
                  maxLength={6} 
                  value={verificationCode} 
                  onChange={setVerificationCode}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-muted-foreground">
                  O código expira em 10 minutos
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium rounded-lg" 
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Verificar código
              </Button>

              {/* Resend code */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Não recebeu o código?
                </p>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleResendCode}
                  disabled={isLoading || resendCooldown > 0}
                  className="text-primary"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 
                    ? `Reenviar em ${resendCooldown}s` 
                    : 'Reenviar código'}
                </Button>
              </div>

              <Button 
                type="button" 
                variant="ghost" 
                className="w-full" 
                onClick={() => {
                  setActiveView("signup");
                  setVerificationCode("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao cadastro
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de recuperação de senha
  if (activeView === "forgot") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-md border bg-background">
          <CardContent className="p-6 flex flex-col gap-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <img src={logoEcomFinance} alt="ECOM Finance" className="h-14" />
              <div className="text-center">
                <h1 className="text-xl font-semibold">Recuperar Senha</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Informe seu e-mail para receber o link de recuperação
                </p>
              </div>
            </div>

            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="forgot-email" 
                    type="email" 
                    placeholder="Digite seu e-mail" 
                    value={forgotEmail} 
                    onChange={e => setForgotEmail(e.target.value)} 
                    disabled={isLoading} 
                    className="border-0 shadow-none focus-visible:ring-0 h-full" 
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium rounded-lg" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar link de recuperação
              </Button>

              <Button 
                type="button" 
                variant="ghost" 
                className="w-full" 
                onClick={() => setActiveView("login")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de cadastro
  if (activeView === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-md border bg-background">
          <CardContent className="p-6 flex flex-col gap-5">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <img src={logoEcomFinance} alt="ECOM Finance" className="h-14" />
              <div className="text-center">
                <h1 className="text-xl font-semibold">Criar Conta</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Cadastre sua empresa para começar
                </p>
              </div>
            </div>

            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              {/* Dados da Empresa */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados da Empresa</p>
                <div className="h-px bg-border" />
              </div>

              {/* Razão Social */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-razao">Razão Social *</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="signup-razao" 
                    type="text" 
                    placeholder="Nome da empresa" 
                    value={signupRazaoSocial} 
                    onChange={e => setSignupRazaoSocial(e.target.value)} 
                    disabled={isLoading} 
                    className="border-0 shadow-none focus-visible:ring-0 h-full" 
                  />
                </div>
              </div>

              {/* Nome Fantasia */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-fantasia">Nome Fantasia</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="signup-fantasia" 
                    type="text" 
                    placeholder="Nome fantasia (opcional)" 
                    value={signupNomeFantasia} 
                    onChange={e => setSignupNomeFantasia(e.target.value)} 
                    disabled={isLoading} 
                    className="border-0 shadow-none focus-visible:ring-0 h-full" 
                  />
                </div>
              </div>

              {/* CNPJ */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-cnpj">CNPJ *</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="signup-cnpj" 
                    type="text" 
                    placeholder="00.000.000/0000-00" 
                    value={signupCnpj} 
                    onChange={e => handleCnpjChange(e.target.value)} 
                    disabled={isLoading} 
                    maxLength={18} 
                    className="border-0 shadow-none focus-visible:ring-0 h-full" 
                  />
                </div>
              </div>

              {/* Regime Tributário */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-regime">Regime Tributário *</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <Select value={signupRegime} onValueChange={setSignupRegime} disabled={isLoading}>
                    <SelectTrigger className="border-0 shadow-none focus:ring-0 h-full flex-1">
                      <SelectValue placeholder="Selecione o regime" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                      <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="lucro_real">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dados de Acesso */}
              <div className="flex flex-col gap-1 pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados de Acesso</p>
                <div className="h-px bg-border" />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">E-mail *</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="signup-email" 
                    type="email" 
                    placeholder="seu@email.com" 
                    value={signupEmail} 
                    onChange={e => setSignupEmail(e.target.value)} 
                    disabled={isLoading} 
                    className="border-0 shadow-none focus-visible:ring-0 h-full" 
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">Senha *</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="signup-password" 
                    type={showSignupPassword ? "text" : "password"} 
                    placeholder="Mínimo 6 caracteres" 
                    value={signupPassword} 
                    onChange={e => setSignupPassword(e.target.value)} 
                    disabled={isLoading} 
                    className="border-0 shadow-none focus-visible:ring-0 h-full flex-1" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowSignupPassword(!showSignupPassword)} 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSignupPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Senha */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-confirm">Confirmar senha *</Label>
                <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="signup-confirm" 
                    type={showSignupConfirmPassword ? "text" : "password"} 
                    placeholder="Repita a senha" 
                    value={signupConfirmPassword} 
                    onChange={e => setSignupConfirmPassword(e.target.value)} 
                    disabled={isLoading} 
                    className="border-0 shadow-none focus-visible:ring-0 h-full flex-1" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)} 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSignupConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium rounded-lg mt-2" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Continuar
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <span 
                  className="text-primary cursor-pointer hover:underline font-medium" 
                  onClick={() => setActiveView("login")}
                >
                  Entrar
                </span>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de login (default)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-md border bg-background">
        <CardContent className="p-6 flex flex-col gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <img alt="ECOM Finance" className="h-14" src="/lovable-uploads/b97b3f53-dfa9-4650-9a4a-0c0332a0c01f.png" />
            <div className="text-center">
              <h1 className="text-xl font-semibold">Bem-vindo de volta</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Entre na sua conta para continuar
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">E-mail</Label>
              <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <Input 
                  id="login-email" 
                  type="email" 
                  placeholder="Digite seu e-mail" 
                  value={loginEmail} 
                  onChange={e => setLoginEmail(e.target.value)} 
                  disabled={isLoading} 
                  className="border-0 shadow-none focus-visible:ring-0 h-full flex-1" 
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Senha</Label>
              <div className="flex items-center gap-2 border rounded-lg px-3 h-12 focus-within:ring-2 focus-within:ring-ring bg-background">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <Input 
                  id="login-password" 
                  type={showLoginPassword ? "text" : "password"} 
                  placeholder="Digite sua senha" 
                  value={loginPassword} 
                  onChange={e => setLoginPassword(e.target.value)} 
                  disabled={isLoading} 
                  className="border-0 shadow-none focus-visible:ring-0 h-full flex-1" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowLoginPassword(!showLoginPassword)} 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe} 
                  onCheckedChange={checked => setRememberMe(checked as boolean)} 
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Lembrar de mim
                </Label>
              </div>
              <button 
                type="button" 
                className="text-sm text-primary hover:underline" 
                onClick={() => setActiveView("forgot")}
              >
                Esqueceu a senha?
              </button>
            </div>

            {/* Submit */}
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium rounded-lg" 
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Entrar
            </Button>

            {/* Signup */}
            <p className="text-center text-sm text-muted-foreground mt-2">
              Não tem uma conta?{" "}
              <span 
                className="text-primary cursor-pointer hover:underline font-medium" 
                onClick={() => setActiveView("signup")}
              >
                Cadastre-se
              </span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
