import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerificationRequest {
  email: string;
  nomeEmpresa: string;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, nomeEmpresa }: VerificationRequest = await req.json();

    if (!email || !nomeEmpresa) {
      throw new Error("Missing required fields: email and nomeEmpresa");
    }

    console.log(`Generating verification code for ${email}`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate 6-digit code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing codes for this email
    await supabase
      .from("email_verification_codes")
      .delete()
      .eq("email", email.toLowerCase());

    // Insert new code
    const { error: insertError } = await supabase
      .from("email_verification_codes")
      .insert({
        email: email.toLowerCase(),
        code,
        expires_at: expiresAt.toISOString(),
        metadata: { nome_empresa: nomeEmpresa },
      });

    if (insertError) {
      console.error("Error inserting code:", insertError);
      throw new Error("Erro ao gerar código de verificação");
    }

    // Send email with code
    const emailResponse = await resend.emails.send({
      from: "ECOM Finance <onboarding@resend.dev>",
      reply_to: "ecomfinanceapp@gmail.com",
      to: [email],
      subject: "Código de Verificação - ECOM Finance",
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificação</title>
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
          
          <!-- Code Section -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 700; color: #1e3a5f; text-align: center;">
                Confirme seu e-mail
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151; text-align: center;">
                Olá, <strong>${nomeEmpresa}</strong>!
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151; text-align: center;">
                Use o código abaixo para confirmar seu cadastro no ECOM Finance:
              </p>
              
              <!-- Code Box -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px solid #2563eb; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                <p style="margin: 0; font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #1e3a5f; font-family: 'Courier New', monospace;">
                  ${code}
                </p>
              </div>
              
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
                ⏱️ Este código expira em <strong>10 minutos</strong>.
              </p>
            </td>
          </tr>
          
          <!-- Security Note -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  🔒 <strong>Dica de segurança:</strong> Nunca compartilhe este código com ninguém. Nossa equipe nunca irá solicitar seu código.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center; line-height: 1.6;">
                Se você não solicitou este código, ignore este e-mail.<br>
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

    console.log("Verification code email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Código enviado com sucesso" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-verification-code function:", error);
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
