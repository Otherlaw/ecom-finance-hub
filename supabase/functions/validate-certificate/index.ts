/**
 * Edge Function para validar certificado digital A1 (PFX/P12)
 * 
 * Valida:
 * - Se a senha está correta
 * - Se o certificado não está expirado
 * - Extrai o CNPJ do certificado para comparação
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forgeModule from "https://esm.sh/node-forge@1.3.1?target=deno";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// esm.sh pode expor node-forge como default export dependendo do target
const forge: any = (forgeModule as any)?.default ?? (forgeModule as any);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationResult {
  valid: boolean;
  error?: string;
  detail?: string;
  code?: string;
  field?: string;
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

function normalizeBase64(input: string) {
  let s = (input ?? "").trim();

  // aceita DataURL
  s = s.replace(/^data:.*;base64,/, "");

  // remove quebras/espacos
  s = s.replace(/\s/g, "");

  // aceita base64url
  s = s.replace(/-/g, "+").replace(/_/g, "/");

  // corrige padding
  const mod = s.length % 4;
  if (mod) s += "=".repeat(4 - mod);

  return s;
}

function bytesToBinaryString(bytes: Uint8Array) {
  // Evita "Maximum call stack size" em arquivos maiores
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode(...chunk));
  }
  return parts.join("");
}

/**
 * Extrai CNPJ do certificado ICP-Brasil usando estratégia de prioridade.
 * 
 * Prioridade de extração:
 * 1. SAN (Subject Alternative Name) - OID 2.16.76.1.3.3 (id-icpbr-pj-cnpj)
 * 2. Common Name (CN) - padrão "NOME DA EMPRESA:CNPJ"
 * 3. Último campo OU (Organizational Unit) - geralmente contém CNPJ do titular
 * 4. Fallback: varrer atributos do Subject do FIM para o INÍCIO
 */
interface ExtractionResult {
  cnpj: string;
  source: string;
}

function extractCnpjFromSAN(cert: any): ExtractionResult | null {
  try {
    const sanExtension = cert.getExtension("subjectAltName");
    if (!sanExtension) {
      console.log("[extractCnpj] SAN extension não encontrada");
      return null;
    }

    console.log("[extractCnpj] SAN encontrado, analisando altNames...");
    
    // node-forge expõe altNames como array
    const altNames = (sanExtension as any).altNames || [];
    
    for (const altName of altNames) {
      // otherName tem type === 0 em node-forge
      if (altName.type === 0) {
        console.log("[extractCnpj] otherName encontrado:", JSON.stringify(altName));
        
        // Tentar extrair do value diretamente
        if (altName.value) {
          let valueStr = "";
          
          // Se for objeto ASN.1, tentar extrair valor
          if (typeof altName.value === "object" && altName.value.value) {
            valueStr = String(altName.value.value);
          } else {
            valueStr = String(altName.value);
          }
          
          const cnpjMatch = valueStr.match(/\d{14}/);
          if (cnpjMatch) {
            console.log("[extractCnpj] CNPJ encontrado no SAN otherName:", cnpjMatch[0]);
            return { cnpj: cnpjMatch[0], source: "SAN/otherName" };
          }
        }
        
        // Tentar OID específico ICP-Brasil (2.16.76.1.3.3)
        if (altName.oid === "2.16.76.1.3.3") {
          const valueStr = String(altName.value || "");
          const cnpjMatch = valueStr.match(/\d{14}/);
          if (cnpjMatch) {
            console.log("[extractCnpj] CNPJ encontrado via OID 2.16.76.1.3.3:", cnpjMatch[0]);
            return { cnpj: cnpjMatch[0], source: "SAN/OID-2.16.76.1.3.3" };
          }
        }
      }
      
      // Também verificar outros tipos de altName que possam conter CNPJ
      if (altName.value) {
        const valueStr = String(altName.value);
        const cnpjMatch = valueStr.match(/\d{14}/);
        if (cnpjMatch) {
          console.log(`[extractCnpj] CNPJ encontrado no SAN type=${altName.type}:`, cnpjMatch[0]);
          return { cnpj: cnpjMatch[0], source: `SAN/type-${altName.type}` };
        }
      }
    }
    
    return null;
  } catch (e) {
    console.error("[extractCnpj] Erro ao processar SAN:", e);
    return null;
  }
}

function extractCnpjFromCN(cert: any): ExtractionResult | null {
  try {
    const cnAttr = cert.subject.getField("CN");
    if (!cnAttr || !cnAttr.value) {
      return null;
    }
    
    const cnValue = String(cnAttr.value);
    console.log("[extractCnpj] Common Name:", cnValue);
    
    // Padrão típico ICP-Brasil: "NOME DA EMPRESA:12345678000199"
    const parts = cnValue.split(":");
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1].trim();
      const cnpjMatch = lastPart.match(/^\d{14}$/);
      if (cnpjMatch) {
        console.log("[extractCnpj] CNPJ encontrado no CN (após ':'):", cnpjMatch[0]);
        return { cnpj: cnpjMatch[0], source: "CN/after-colon" };
      }
    }
    
    // Tentar encontrar CNPJ em qualquer parte do CN
    const cnpjMatch = cnValue.match(/\d{14}/);
    if (cnpjMatch) {
      console.log("[extractCnpj] CNPJ encontrado no CN:", cnpjMatch[0]);
      return { cnpj: cnpjMatch[0], source: "CN/embedded" };
    }
    
    return null;
  } catch (e) {
    console.error("[extractCnpj] Erro ao processar CN:", e);
    return null;
  }
}

function extractCnpjFromOU(cert: any): ExtractionResult | null {
  try {
    const subject = cert.subject;
    
    // Coletar todos os campos OU
    const ouFields: string[] = [];
    for (const attr of subject.attributes) {
      if (attr.shortName === "OU" || attr.name === "organizationalUnitName") {
        if (attr.value) {
          ouFields.push(String(attr.value));
        }
      }
    }
    
    console.log("[extractCnpj] Campos OU encontrados:", ouFields);
    
    // Buscar no ÚLTIMO OU primeiro (mais provável ter o CNPJ do titular)
    for (let i = ouFields.length - 1; i >= 0; i--) {
      const ouValue = ouFields[i];
      
      // CNPJ com 14 dígitos
      const cnpjMatch = ouValue.match(/\d{14}/);
      if (cnpjMatch) {
        console.log(`[extractCnpj] CNPJ encontrado no OU[${i}]:`, cnpjMatch[0]);
        return { cnpj: cnpjMatch[0], source: `OU[${i}]` };
      }
      
      // CNPJ formatado
      const cnpjFormatted = ouValue.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      if (cnpjFormatted) {
        const cnpj = cnpjFormatted[0].replace(/\D/g, "");
        console.log(`[extractCnpj] CNPJ formatado encontrado no OU[${i}]:`, cnpj);
        return { cnpj, source: `OU[${i}]/formatted` };
      }
    }
    
    return null;
  } catch (e) {
    console.error("[extractCnpj] Erro ao processar OU:", e);
    return null;
  }
}

function extractCnpjFromSubjectReverse(cert: any): ExtractionResult | null {
  try {
    const subject = cert.subject;
    const attributes = [...subject.attributes].reverse(); // Do fim para o início
    
    console.log("[extractCnpj] Varrendo atributos do Subject (reverso)...");
    
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      const value = attr.value as string;
      const fieldName = attr.shortName || attr.name || "unknown";
      
      if (!value) continue;
      
      // CNPJ com 14 dígitos
      const cnpjMatch = value.match(/\d{14}/);
      if (cnpjMatch) {
        console.log(`[extractCnpj] CNPJ encontrado em ${fieldName} (reverso[${i}]):`, cnpjMatch[0]);
        return { cnpj: cnpjMatch[0], source: `Subject/${fieldName}/reverse` };
      }
      
      // CNPJ formatado
      const cnpjFormatted = value.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      if (cnpjFormatted) {
        const cnpj = cnpjFormatted[0].replace(/\D/g, "");
        console.log(`[extractCnpj] CNPJ formatado encontrado em ${fieldName}:`, cnpj);
        return { cnpj, source: `Subject/${fieldName}/formatted` };
      }
    }
    
    return null;
  } catch (e) {
    console.error("[extractCnpj] Erro ao processar Subject reverso:", e);
    return null;
  }
}

function extractCnpjFromCertificate(cert: any): { cnpj: string | null; source: string | null } {
  console.log("[extractCnpj] Iniciando extração de CNPJ do certificado ICP-Brasil...");
  
  // Log de todos os atributos do Subject para debug
  try {
    const attrs = cert.subject.attributes.map((a: any) => ({
      name: a.shortName || a.name,
      value: a.value
    }));
    console.log("[extractCnpj] Atributos do Subject:", JSON.stringify(attrs, null, 2));
  } catch (e) {
    console.error("[extractCnpj] Erro ao logar atributos:", e);
  }
  
  // Prioridade 1: SAN com OID ICP-Brasil
  const sanResult = extractCnpjFromSAN(cert);
  if (sanResult) {
    return { cnpj: sanResult.cnpj, source: sanResult.source };
  }
  
  // Prioridade 2: Common Name (CN)
  const cnResult = extractCnpjFromCN(cert);
  if (cnResult) {
    return { cnpj: cnResult.cnpj, source: cnResult.source };
  }
  
  // Prioridade 3: Último campo OU
  const ouResult = extractCnpjFromOU(cert);
  if (ouResult) {
    return { cnpj: ouResult.cnpj, source: ouResult.source };
  }
  
  // Prioridade 4: Fallback - varrer Subject do fim para o início
  const subjectResult = extractCnpjFromSubjectReverse(cert);
  if (subjectResult) {
    return { cnpj: subjectResult.cnpj, source: subjectResult.source };
  }
  
  console.log("[extractCnpj] Nenhum CNPJ encontrado no certificado");
  return { cnpj: null, source: null };
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

    const normalizedBase64 = normalizeBase64(String(pfx_base64));
    console.log("[validate-certificate] Base64 normalizado, length:", normalizedBase64.length);

    // Converter base64 para bytes com std/encoding/base64 (mais robusto que regex)
    let pfxBinary: string;
    try {
      const bytes = decodeBase64(normalizedBase64);
      pfxBinary = bytesToBinaryString(bytes);
      console.log("[validate-certificate] Base64 decodificado com sucesso, bytes:", bytes.length);
    } catch (e: any) {
      const detail = e?.message ? String(e.message) : "Falha ao decodificar base64";
      console.error("[validate-certificate] Erro ao decodificar base64:", detail);
      return new Response(
        JSON.stringify({ valid: false, error: "PFX_BASE64_DECODE_FAILED", detail }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tentar abrir o PFX com a senha
    let p12: any;
    try {
      const asn1 = forge.asn1.fromDer(pfxBinary);
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
      console.log("[validate-certificate] PFX aberto com sucesso");
    } catch (e: any) {
      const errorMsg = e.message || "";
      console.error("[validate-certificate] Erro ao abrir PFX:", errorMsg);
      
      // Mensagens de erro comuns - senha incorreta pode gerar várias mensagens diferentes
      const isPasswordError = 
        errorMsg.includes("Invalid password") || 
        errorMsg.includes("MAC") ||
        errorMsg.includes("bits supported") ||  // "Only 8, 16, 24, or 32 bits supported"
        errorMsg.includes("PKCS#12") ||
        errorMsg.includes("decrypt") ||
        errorMsg.includes("Invalid key") ||
        errorMsg.includes("bad decrypt");
      
      if (isPasswordError) {
        return new Response(
          JSON.stringify({ valid: false, error: "wrong_password", detail: "A senha do certificado está incorreta", code: "INVALID_PASSWORD" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errorMsg.includes("Too few bytes")) {
        return new Response(
          JSON.stringify({ valid: false, error: "corrupted_file", detail: "O arquivo PFX está corrompido ou incompleto", code: "CORRUPTED_PFX" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ valid: false, error: "open_failed", detail: `Não foi possível abrir o certificado: ${errorMsg}`, code: "PFX_OPEN_FAILED" }),
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

    // Extrair CNPJ com nova lógica de prioridade
    const cnpjExtraction = extractCnpjFromCertificate(cert);
    const certCnpj = cnpjExtraction.cnpj;
    const cnpjSource = cnpjExtraction.source;
    
    console.log("[validate-certificate] CNPJ extraído:", { cnpj: certCnpj, source: cnpjSource });

    // Verificar match de CNPJ se fornecido
    let cnpjMatch: boolean | undefined;
    if (expectedCnpj && certCnpj) {
      const cleanExpected = expectedCnpj.replace(/\D/g, "");
      cnpjMatch = certCnpj === cleanExpected;
      console.log("[validate-certificate] Comparando CNPJs:", { certCnpj, expected: cleanExpected, match: cnpjMatch, source: cnpjSource });
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
