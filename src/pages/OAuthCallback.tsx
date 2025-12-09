import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processando autorização...");

  useEffect(() => {
    const processOAuthCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Erro na autorização: ${error}`);
        setTimeout(() => navigate("/integracoes"), 3000);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Parâmetros de autorização ausentes");
        setTimeout(() => navigate("/integracoes"), 3000);
        return;
      }

      try {
        // Call the ml-oauth-callback edge function
        const response = await fetch(
          `https://bwfbozwyqujlykgaueez.supabase.co/functions/v1/ml-oauth-callback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code, state }),
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          setMessage("Mercado Livre conectado com sucesso!");
          setTimeout(() => navigate("/integracoes"), 2000);
        } else {
          setStatus("error");
          setMessage(data.error || "Erro ao processar autorização");
          setTimeout(() => navigate("/integracoes"), 3000);
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        setStatus("error");
        setMessage("Erro de conexão ao processar autorização");
        setTimeout(() => navigate("/integracoes"), 3000);
      }
    };

    processOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-lg">
        {status === "processing" && (
          <>
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Conectando ao Mercado Livre
            </h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Conexão Estabelecida!
            </h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Redirecionando...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Erro na Conexão
            </h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Redirecionando para integrações...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
