import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WelcomeEmailRequest {
  email: string;
  nomeEmpresa: string;
  appUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, nomeEmpresa, appUrl }: WelcomeEmailRequest = await req.json();

    // Validate required fields
    if (!email || !nomeEmpresa) {
      throw new Error("Missing required fields: email and nomeEmpresa");
    }

    console.log(`Sending welcome email to ${email} for company ${nomeEmpresa}`);

    const emailResponse = await resend.emails.send({
      from: "ECOM Finance <onboarding@resend.dev>",
      reply_to: "ecomfinanceapp@gmail.com",
      to: [email],
      subject: "Bem-vindo ao ECOM Finance! 🎉",
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao ECOM Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 560px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">
              <img src="https://bwfbozwyqujlykgaueez.supabase.co/storage/v1/object/public/email-assets/logo-ecom-finance.png?v=1" alt="ECOM Finance" width="180" style="display: block; max-width: 180px; height: auto;" />
            </td>
          </tr>
          
          <!-- Welcome Message -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: 700; color: #1e3a5f; text-align: center;">
                Bem-vindo ao ECOM Finance! 🎉
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Olá, <strong>${nomeEmpresa}</strong>!
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Sua conta foi criada com sucesso. Agora você pode gerenciar todas as finanças do seu e-commerce em um só lugar.
              </p>
            </td>
          </tr>
          
          <!-- Features List -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e3a5f;">Com o ECOM Finance você pode:</p>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                  <li>📊 Acompanhar vendas e métricas em tempo real</li>
                  <li>💰 Gerenciar fluxo de caixa e contas</li>
                  <li>📈 Analisar DRE e performance mensal</li>
                  <li>🔗 Integrar com marketplaces como Mercado Livre</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <a href="${appUrl || 'https://ecomfinance.lovable.app'}" 
                 style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563eb 0%, #1e3a5f 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                Acessar minha conta →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center; line-height: 1.6;">
                Você recebeu este email porque se cadastrou no ECOM Finance.<br>
                Em caso de dúvidas, entre em contato conosco.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
