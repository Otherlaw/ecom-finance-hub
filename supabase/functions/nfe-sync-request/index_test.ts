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
