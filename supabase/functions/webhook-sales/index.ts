// supabase/functions/webhook-sales/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS (útil para testes manuais com cURL e para provedores)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hubla-token, x-hubla-webhook-token",
};

// Helpers
function get<T = any>(obj: any, path: string, fallback?: T): T | undefined {
  try {
    const val = path.split(".").reduce((acc: any, key) => acc?.[key], obj);
    return (val === undefined ? fallback : val) as T | undefined;
  } catch {
    return fallback;
  }
}

function resolveCategory(offerName?: string | null, productName?: string | null): "Wolf Gold" | "Wolf Black" | "VIP Wolf" {
  const base = `${offerName ?? ""} ${productName ?? ""}`.toLowerCase();
  if (base.includes("vip")) return "VIP Wolf";
  if (base.includes("black")) return "Wolf Black";
  if (base.includes("gold")) return "Wolf Gold";
  // Default seguro (enum existente)
  return "Wolf Gold";
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // 2) Lê corpo
  const textBody = await req.text();
  let data: any = {};
  try {
    data = textBody ? JSON.parse(textBody) : {};
  } catch {
    // mantém como texto bruto
  }

  // Inicializa Supabase (Service Role)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase env vars ausentes");
    return new Response(JSON.stringify({ error: "Misconfigured function" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Normaliza o payload vindo da Hubla
  const event = get<any>(data, "event") ?? data;
  const type = (get<string>(data, "type") ?? "").toString() || "unknown";

  const userEmail = get<string>(event, "userEmail") ?? get<string>(data, "userEmail") ?? null;
  const userName = get<string>(event, "userName") ?? get<string>(data, "userName") ?? null;
  const userPhone = get<string>(event, "userPhone") ?? get<string>(data, "userPhone") ?? null;
  const productName = get<string>(event, "productName") ?? get<string>(data, "productName") ?? null;
  const offerName = get<string>(event, "offerName") ?? get<string>(data, "offerName") ?? null;
  const transactionId = get<string>(event, "transactionId") ?? get<string>(data, "transactionId") ?? null;
  const totalAmount = get<number>(event, "totalAmount") ?? get<number>(data, "totalAmount") ?? null;
  const paidAt = get<string>(event, "paidAt") ?? get<string>(data, "paidAt") ?? null;
  const createdAt = get<string>(event, "createdAt") ?? get<string>(data, "createdAt") ?? null;

  // 2.1) Log de auditoria - salvar bruto
  try {
    await supabase.from("hubla_raw_events").insert({
      provider: "hubla",
      type,
      transaction_id: transactionId ?? null,
      payload: (typeof data === "object" ? data : { raw: textBody }) as any,
    });
  } catch (e) {
    console.error("Falha ao inserir em hubla_raw_events:", e);
  }

  // 3) Fluxo de processamento (somente se houver email e transação)
  let participantId: string | null = null;
  let assignedCategory: "Wolf Gold" | "Wolf Black" | "VIP Wolf" = resolveCategory(offerName, productName);
  let status = "received";
  let errorMessage: string | null = null;

  try {
    if (!userEmail || !transactionId) {
      status = "skipped";
      throw new Error("Payload incompleto: é necessário userEmail e transactionId");
    }

    // 3.1) Registra/atualiza venda em wolf_sales (evita duplicar por transaction_id)
    try {
      const { data: existing } = await supabase
        .from("wolf_sales")
        .select("transaction_id")
        .eq("transaction_id", transactionId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("wolf_sales").insert({
          user_email: userEmail,
          transaction_id: transactionId,
          user_name: userName ?? null,
          user_phone: userPhone ?? null,
          product_name: productName ?? null,
          offer_name: offerName ?? null,
          total_amount: totalAmount ?? null,
          created_at: createdAt ?? null,
          paid_at: paidAt ?? null,
        });
      }
    } catch (e) {
      console.error("Falha ao registrar wolf_sales:", e);
      // não aborta fluxo
    }

    // 3.2) Localiza ou cria participante
    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();

    if (existingParticipant?.id) {
      participantId = existingParticipant.id;
    } else {
      // Criar participante novo
      const { data: inserted, error: insertParticipantErr } = await supabase
        .from("participants")
        .insert({
          name: userName ?? userEmail.split("@")[0],
          email: userEmail,
          phone: userPhone ?? null,
          category: assignedCategory,
          presencas: {},
        })
        .select("id")
        .maybeSingle();

      if (insertParticipantErr) throw insertParticipantErr;
      participantId = inserted?.id ?? null;
    }

    if (!participantId) throw new Error("Falha ao obter participantId");

    // 3.3) Garante ticket
    try {
      const { data: existingTicket } = await supabase
        .from("tickets")
        .select("id")
        .eq("participant_id", participantId)
        .maybeSingle();

      if (!existingTicket) {
        await supabase.from("tickets").insert({
          participant_id: participantId,
          // Usamos o próprio ID do participante como QR (scanner e página de validação aceitam este formato)
          qr_code: participantId,
        });
      }
    } catch (e) {
      console.error("Falha ao garantir ticket:", e);
      // segue fluxo
    }

    status = "processed";
  } catch (err: any) {
    errorMessage = err?.message ?? String(err);
    console.error("Erro no processamento do webhook Hubla:", err);
  } finally {
    // 4) Log final consolidado
    try {
      await supabase.from("webhook_sales_logs").insert({
        origin: "hubla",
        status,
        raw_payload: (typeof data === "object" ? data : { raw: textBody }) as any,
        buyer_email: userEmail,
        buyer_name: userName,
        product_name: productName,
        product_id: transactionId ?? null,
        assigned_category: assignedCategory,
        participant_id: participantId,
        error_message: errorMessage,
      });
    } catch (e) {
      console.error("Falha ao inserir webhook_sales_logs:", e);
    }
  }

  // 5) Confirma recebimento
  return new Response(
    JSON.stringify({ ok: true, status }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
