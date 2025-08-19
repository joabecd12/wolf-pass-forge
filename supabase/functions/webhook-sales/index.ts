// supabase/functions/webhook-sales/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req: Request) => {
  // 1) Autenticação por token fixo
  const expected = Deno.env.get("HUBLA_WEBHOOK_TOKEN") ?? "";
  const rawAuth =
    req.headers.get("authorization") ||
    req.headers.get("x-hubla-token") ||
    req.headers.get("x-hubla-webhook-token") ||
    "";

  // Suporta "Bearer <token>" ou valor cru
  let provided = rawAuth;
  if (provided.toLowerCase().startsWith("bearer ")) {
    provided = provided.slice(7).trim();
  }

  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Lê corpo (log simples por enquanto)
  const body = await req.text();
  try {
    const data = body ? JSON.parse(body) : {};
    console.log("HUBLA WEBHOOK RECEBIDO:", JSON.stringify(data));
    // TODO: aqui entra o upsert na sua base (posso adicionar depois)
  } catch {
    console.log("HUBLA WEBHOOK (texto bruto):", body);
  }

  // 3) Confirma recebimento
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
