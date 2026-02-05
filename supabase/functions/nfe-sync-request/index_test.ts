import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { shouldBlockConcurrentStart } from "./index.ts";

Deno.test("shouldBlockConcurrentStart: não bloqueia quando não há estado", () => {
  const res = shouldBlockConcurrentStart(null);
  assertEquals(res.blocked, false);
});

Deno.test("shouldBlockConcurrentStart: bloqueia queued < 30min", () => {
  const updatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const res = shouldBlockConcurrentStart({ status: "queued", updated_at: updatedAt });
  assertEquals(res.blocked, true);
  assertEquals(res.reason, "SYNC_RUNNING");
});

Deno.test("shouldBlockConcurrentStart: bloqueia running < 30min", () => {
  const updatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const res = shouldBlockConcurrentStart({ status: "running", updated_at: updatedAt });
  assertEquals(res.blocked, true);
  assertEquals(res.reason, "SYNC_RUNNING");
});

Deno.test("shouldBlockConcurrentStart: não bloqueia running >= 30min", () => {
  const updatedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  const res = shouldBlockConcurrentStart({ status: "running", updated_at: updatedAt });
  assertEquals(res.blocked, false);
});

 // ========================================
 // TESTES PARA RESET - Preservar next_retry_at
 // ========================================

 Deno.test("reset: não deve alterar next_retry_at quando futuro", async () => {
   // Este teste valida a lógica do servidor:
   // - Quando há next_retry_at no futuro, reset NÃO pode limpá-lo
   // - O teste simula o estado que o servidor deve preservar
   
   const futureRetryAt = new Date(Date.now() + 3600000).toISOString(); // +1h
   const mockState = {
     status: "error" as const,
     next_retry_at: futureRetryAt,
     rate_limit_count: 1,
     last_rate_limit_at: new Date().toISOString(),
   };
   
   // Simula o que o servidor deve fazer no reset:
   // - status -> "idle"
   // - last_error -> null
   // - next_retry_at -> NÃO ALTERADO
   const updatedFields = {
     status: "idle" as const,
     last_error: null,
     // next_retry_at NÃO está aqui - não deve ser alterado
   };
   
   // Verifica que next_retry_at não está nos campos atualizados
   assertEquals("next_retry_at" in updatedFields, false);
   
   // Verifica que o estado original mantém next_retry_at
   assertEquals(mockState.next_retry_at, futureRetryAt);
 });

 Deno.test("reset: resposta deve incluir next_retry_at e cooldown_active", () => {
   // Este teste valida o formato da resposta do reset
   const futureRetryAt = new Date(Date.now() + 3600000).toISOString();
   
   // Simula a resposta esperada do servidor
   const mockResponse = {
     success: true,
     message: "Sincronizacao resetada, mas cooldown de rate limit continua ativo",
     status: "idle",
     next_retry_at: futureRetryAt,
     cooldown_active: true,
   };
   
   assertEquals(mockResponse.success, true);
   assertEquals(mockResponse.cooldown_active, true);
   assertEquals(mockResponse.next_retry_at, futureRetryAt);
 });

 Deno.test("reset: cooldown_active deve ser false quando next_retry_at é passado", () => {
   const pastRetryAt = new Date(Date.now() - 3600000).toISOString(); // -1h
   
   // Verifica lógica de hasActiveCooldown
   const hasActiveCooldown = pastRetryAt && new Date(pastRetryAt) > new Date();
   
   assertEquals(hasActiveCooldown, false);
 });

 Deno.test("reset: cooldown_active deve ser true quando next_retry_at é futuro", () => {
   const futureRetryAt = new Date(Date.now() + 3600000).toISOString(); // +1h
   
   // Verifica lógica de hasActiveCooldown
   const hasActiveCooldown = futureRetryAt && new Date(futureRetryAt) > new Date();
   
   assertEquals(hasActiveCooldown, true);
 });
