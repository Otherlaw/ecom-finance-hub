/**
 * Edge Function para validar certificado digital A1 (PFX/P12)
 * 
 * Valida:
 * - Se a senha está correta
 * - Se o certificado não está expirado
 * - Extrai o CNPJ do certificado para comparação
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationResult {
  valid: boolean;
  error?: string;
  certificate_info?: {
    cnpj: string | null;
    common_name: string | null;
    issuer: string | null;
    valid_from: string;
    valid_to: string;
    is_expired: boolean;
    days_until_expiry: number;
  };
  cnpj_match?: boolean;
}

// Extrai CNPJ do Subject ou do SAN (Subject Alternative Name) do certificado
function extractCnpjFromCertificate(cert: forge.pki.Certificate): string | null {
  try {
    // Tentar extrair do Subject (campo OU ou CN pode conter o CNPJ)
    const subject = cert.subject;
    
    for (const attr of subject.attributes) {
      // Buscar em diferentes campos
      const value = attr.value as string;
      if (value) {
        // CNPJ tem 14 dígitos
        const cnpjMatch = value.match(/\d{14}/);
        if (cnpjMatch) {
          return cnpjMatch[0];
        }
        // Formato com pontuação
        const cnpjFormatted = value.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
        if (cnpjFormatted) {
          return cnpjFormatted[0].replace(/\D/g, "");
        }
      }
    }

    // Tentar extrair do campo otherName no SAN (padrão ICP-Brasil)
    const sanExtension = cert.getExtension("subjectAltName");
    if (sanExtension && (sanExtension as any).altNames) {
      for (const altName of (sanExtension as any).altNames) {
        if (altName.value) {
          const cnpjMatch = String(altName.value).match(/\d{14}/);
          if (cnpjMatch) {
            return cnpjMatch[0];
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.error("Erro ao extrair CNPJ do certificado:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Autenticar usuario via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ valid: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse payload
    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[validate-certificate] Erro ao parsear JSON:", parseErr);
      return new Response(
        JSON.stringify({ valid: false, error: "invalid_json", detail: "O corpo da requisição não é um JSON válido", code: "PARSE_ERROR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { pfx_base64, password, cnpj, expected_cnpj, uf, environment } = body;

    // Validar campos obrigatórios
    if (!pfx_base64) {
      console.error("[validate-certificate] Campo obrigatório faltando: pfx_base64");
      return new Response(
        JSON.stringify({ valid: false, error: "missing_field", field: "pfx_base64", detail: "O campo pfx_base64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password) {
      console.error("[validate-certificate] Campo obrigatório faltando: password");
      return new Response(
        JSON.stringify({ valid: false, error: "missing_field", field: "password", detail: "O campo password é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usar cnpj ou expected_cnpj (backward compatibility)
    const expectedCnpj = cnpj || expected_cnpj;

    console.log("[validate-certificate] Validando certificado... CNPJ esperado:", expectedCnpj, "UF:", uf);

    // Normalizar base64 (aceitar data URL e remover espaços/quebras de linha)
    let normalizedBase64 = typeof pfx_base64 === "string" ? pfx_base64 : "";
    
    // Remover prefixo data:...;base64,
    if (normalizedBase64.includes("base64,")) {
      normalizedBase64 = normalizedBase64.split("base64,").pop() || "";
    }
    
    // Remover espaços e quebras de linha
    normalizedBase64 = normalizedBase64.replace(/\s/g, "");
    
    // Corrigir padding do base64 (adicionar '=' até múltiplo de 4)
    const remainder = normalizedBase64.length % 4;
    if (remainder > 0) {
      normalizedBase64 += "=".repeat(4 - remainder);
    }

    console.log("[validate-certificate] Base64 normalizado, length:", normalizedBase64.length);

    // Converter base64 para binary
    let pfxBinary: string;
    try {
      // Validação rápida de caracteres (evita erros confusos do decode)
      if (!/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
        console.error("[validate-certificate] Base64 contém caracteres inválidos");
        return new Response(
          JSON.stringify({ valid: false, error: "invalid_base64", detail: "O base64 contém caracteres inválidos", code: "INVALID_BASE64_CHARS" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      pfxBinary = forge.util.decode64(normalizedBase64);
      console.log("[validate-certificate] Base64 decodificado com sucesso, bytes:", pfxBinary.length);
    } catch (e: any) {
      console.error("[validate-certificate] Erro ao decodificar base64:", e.message);
      return new Response(
        JSON.stringify({ valid: false, error: "decode_error", detail: "Não foi possível decodificar o base64", code: "BASE64_DECODE_FAILED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tentar abrir o PFX com a senha
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      const asn1 = forge.asn1.fromDer(pfxBinary);
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
      console.log("[validate-certificate] PFX aberto com sucesso");
    } catch (e: any) {
      console.error("[validate-certificate] Erro ao abrir PFX:", e.message);
      
      // Mensagens de erro comuns
      if (e.message?.includes("Invalid password") || e.message?.includes("MAC")) {
        return new Response(
          JSON.stringify({ valid: false, error: "wrong_password", detail: "A senha do certificado está incorreta", code: "INVALID_PASSWORD" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (e.message?.includes("Too few bytes")) {
        return new Response(
          JSON.stringify({ valid: false, error: "corrupted_file", detail: "O arquivo PFX está corrompido ou incompleto", code: "CORRUPTED_PFX" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ valid: false, error: "open_failed", detail: `Não foi possível abrir o certificado: ${e.message}`, code: "PFX_OPEN_FAILED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair certificado
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBags = bags[forge.pki.oids.certBag];
    
    if (!certBags || certBags.length === 0) {
      console.error("[validate-certificate] Nenhum certificado encontrado no PFX");
      return new Response(
        JSON.stringify({ valid: false, error: "no_certificate", detail: "Nenhum certificado encontrado no arquivo PFX", code: "NO_CERT_IN_PFX" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pegar o primeiro certificado (geralmente o do usuário/empresa)
    const cert = certBags[0].cert;
    if (!cert) {
      console.error("[validate-certificate] Certificado nulo no bag");
      return new Response(
        JSON.stringify({ valid: false, error: "invalid_certificate", detail: "O certificado dentro do PFX é inválido", code: "INVALID_CERT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair informações
    const validFrom = cert.validity.notBefore;
    const validTo = cert.validity.notAfter;
    const now = new Date();
    const isExpired = now > validTo;
    const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Common Name
    const cnAttr = cert.subject.getField("CN");
    const commonName = cnAttr ? String(cnAttr.value) : null;

    // Issuer
    const issuerCn = cert.issuer.getField("CN");
    const issuer = issuerCn ? String(issuerCn.value) : null;

    // Extrair CNPJ
    const certCnpj = extractCnpjFromCertificate(cert);

    // Verificar match de CNPJ se fornecido
    let cnpjMatch: boolean | undefined;
    if (expectedCnpj && certCnpj) {
      const cleanExpected = expectedCnpj.replace(/\D/g, "");
      cnpjMatch = certCnpj === cleanExpected;
      console.log("[validate-certificate] Comparando CNPJs:", { certCnpj, expected: cleanExpected, match: cnpjMatch });
    }

    const result: ValidationResult = {
      valid: !isExpired,
      certificate_info: {
        cnpj: certCnpj,
        common_name: commonName,
        issuer: issuer,
        valid_from: validFrom.toISOString(),
        valid_to: validTo.toISOString(),
        is_expired: isExpired,
        days_until_expiry: daysUntilExpiry,
      },
      cnpj_match: cnpjMatch,
    };

    if (isExpired) {
      result.error = `Certificado expirado em ${validTo.toLocaleDateString("pt-BR")}`;
    } else if (cnpjMatch === false) {
      result.valid = false;
      result.error = `CNPJ do certificado (${certCnpj}) não corresponde ao CNPJ da empresa (${expectedCnpj})`;
    } else if (daysUntilExpiry <= 30) {
      // Aviso se vai expirar em breve (mas ainda válido)
      result.error = `Atenção: certificado expira em ${daysUntilExpiry} dias`;
    }

    console.log("[validate-certificate] Resultado:", { 
      valid: result.valid, 
      cnpj: certCnpj,
      expired: isExpired,
      days: daysUntilExpiry 
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[validate-certificate] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
