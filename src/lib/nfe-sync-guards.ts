/**
 * Guards para evitar disparos de sync de NF-e durante cooldown (next_retry_at).
 *
 * Importante: usamos fetch direto para funções GET com query params.
 */

import { supabase } from "@/integrations/supabase/client";

export type NfeCooldownGuardResult =
  | { allowed: true }
  | { allowed: false; next_retry_at: string };

export async function shouldStartNfeSyncNow(empresaId: string): Promise<NfeCooldownGuardResult> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return { allowed: true };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return { allowed: true };

  const response = await fetch(
    `${supabaseUrl}/functions/v1/nfe-status?empresa_id=${encodeURIComponent(empresaId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) return { allowed: true };

  const data = (await response.json()) as { sync_state?: { next_retry_at?: string | null } };
  const nextRetryAt = data?.sync_state?.next_retry_at;
  if (nextRetryAt) {
    const retryDate = new Date(nextRetryAt);
    if (retryDate > new Date()) {
      return { allowed: false, next_retry_at: nextRetryAt };
    }
  }

  return { allowed: true };
}
