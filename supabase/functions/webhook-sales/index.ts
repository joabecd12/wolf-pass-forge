// supabase/functions/webhook-sales/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

// CORS (útil para testes manuais com cURL e para provedores)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hubla-token, x-hubla-webhook-token, x-lastlink-token, x-lastlink-webhook-token",
};

// Resend client para envio imediato de emails
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Helpers
function get<T = any>(obj: any, path: string, fallback?: T): T | undefined {
  try {
    const val = path.split(".").reduce((acc: any, key) => acc?.[key], obj);
    return (val === undefined ? fallback : val) as T | undefined;
  } catch {
    return fallback;
  }
}

const OFFER_ID_CATEGORY_MAP: Record<string, "Wolf Gold" | "Wolf Black" | "VIP Wolf"> = {
  // Preencha com os IDs reais das ofertas, por exemplo:
  // "offer-id-vip": "VIP Wolf",
  // "offer-id-black": "Wolf Black",
  // "offer-id-gold": "Wolf Gold",
};

function resolveCategory(input: {
  offerId?: string | null;
  offerNameV2?: string | null;
  offerName?: string | null;
  productName?: string | null;
}): "Wolf Gold" | "Wolf Black" | "VIP Wolf" {
  const { offerId, offerNameV2, offerName, productName } = input;

  // 1) Prioriza mapeamento por offerId
  if (offerId && OFFER_ID_CATEGORY_MAP[offerId]) {
    return OFFER_ID_CATEGORY_MAP[offerId];
  }

  // 2) Depois tenta pelos nomes (novo campo) e, em seguida, pelos antigos
  const base = `${offerNameV2 ?? ""} ${offerName ?? ""} ${productName ?? ""}`.toLowerCase();
  if (base.includes("vip")) return "VIP Wolf";
  if (base.includes("black")) return "Wolf Black";
  if (base.includes("gold")) return "Wolf Gold";

  // 3) Fallback seguro
  return "Wolf Gold";
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1) Autenticação por token fixo (Hubla e Lastlink)
  const hublaToken = Deno.env.get("HUBLA_WEBHOOK_TOKEN") ?? "";
  const lastlinkToken = Deno.env.get("LASTLINK_WEBHOOK_TOKEN") ?? "";
  const rawAuth =
    req.headers.get("authorization") ||
    req.headers.get("x-hubla-token") ||
    req.headers.get("x-hubla-webhook-token") ||
    req.headers.get("x-lastlink-token") ||
    req.headers.get("x-lastlink-webhook-token") ||
    "";

  // Suporta "Bearer <token>" ou valor cru
  let provided = rawAuth;
  if (provided.toLowerCase().startsWith("bearer ")) {
    provided = provided.slice(7).trim();
  }

  let origin: "hubla" | "lastlink" | "unknown" = "unknown";
  if (provided && hublaToken && provided === hublaToken) origin = "hubla";
  if (provided && lastlinkToken && provided === lastlinkToken) origin = "lastlink";

  if (origin === "unknown") {
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
  const type = (get<string>(data, "type") ?? get<string>(data, "Event") ?? "").toString() || "unknown";

// v2 fields (priorities per Hubla v2 and business rules)
const userEmailV2 = get<string>(event, "user.email")
  ?? get<string>(event, "customer.email")
  ?? get<string>(event, "buyer.email")
  ?? get<string>(event, "order.customer.email")
  ?? get<string>(data, "customer.email")
  ?? get<string>(data, "user.email")
  ?? null;

const userFirst = get<string>(event, "user.firstName") 
  ?? get<string>(event, "user.firstname") 
  ?? get<string>(event, "user.first_name") 
  ?? null;
const userLast = get<string>(event, "user.lastName") 
  ?? get<string>(event, "user.lastname") 
  ?? get<string>(event, "user.last_name") 
  ?? null;
const userName_user = get<string>(event, "user.name") ?? null;
const buyerName_v2 = get<string>(event, "buyer.name") ?? null;
const customerName_v2 = get<string>(event, "customer.name") ?? null;

const v2UserPhone = get<string>(event, "user.phone") ?? null;
const v2BuyerPhone = get<string>(event, "buyer.phone") ?? null;
const v2CustomerPhone = get<string>(event, "customer.phone")
  ?? get<string>(event, "order.customer.phone")
  ?? get<string>(data, "customer.phone")
  ?? null;

const transactionIdV2 = get<string>(event, "invoice.id")
  ?? get<string>(event, "purchase.id")
  ?? get<string>(event, "order.id")
  ?? get<string>(data, "invoice.id")
  ?? null;
const invoiceStatus = get<string>(event, "invoice.status")
  ?? get<string>(data, "invoice.status")
  ?? get<string>(event, "status")
  ?? null;
const paidAtV2 = get<string>(event, "invoice.paid_at")
  ?? get<string>(event, "invoice.paidAt")
  ?? get<string>(data, "invoice.paid_at")
  ?? null;
const createdAtV2 = get<string>(event, "invoice.created_at")
  ?? get<string>(event, "invoice.createdAt")
  ?? get<string>(data, "invoice.created_at")
  ?? null;
const amountCentsV2 = get<number>(event, "invoice.amount.totalCents")
  ?? get<number>(data, "invoice.amount.totalCents")
  ?? null;

// legacy v1 fields
const userEmailLegacy = get<string>(event, "userEmail") ?? get<string>(data, "userEmail") ?? null;
const userNameLegacy = get<string>(event, "userName") ?? get<string>(data, "userName") ?? null;
const legacyCustomerPhone = get<string>(data, "customer.phone")
  ?? get<string>(data, "customer.whatsapp")
  ?? get<string>(data, "customer.whatsapp_number")
  ?? null;
const productName = get<string>(event, "productName")
  ?? get<string>(data, "productName")
  ?? get<string>(event, "product.name")
  ?? get<string>(event, "order.product.name")
  ?? get<string>(event, "items.0.name")
  ?? get<string>(event, "items.0.title")
  ?? get<string>(event, "plan.name")
  ?? get<string>(data, "Data.Products.0.Name")
  ?? get<string>(data, "Data.Offer.Name")
  ?? null;
const offerName = get<string>(event, "offerName")
  ?? get<string>(data, "offerName")
  ?? get<string>(event, "offers.0.name")
  ?? get<string>(event, "products.0.offers.0.name")
  ?? null;
const transactionIdLegacy = get<string>(event, "transactionId") ?? get<string>(data, "transactionId") ?? null;
const totalAmountLegacy = get<number>(event, "totalAmount") ?? get<number>(data, "totalAmount") ?? null;
const paidAtLegacy = get<string>(event, "paidAt") ?? get<string>(data, "paidAt") ?? null;
const createdAtLegacy = get<string>(event, "createdAt") ?? get<string>(data, "createdAt") ?? null;

// Lastlink-specific fields (fallbacks)
const llEmail = get<string>(data, "Data.Buyer.Email") ?? null;
const llName = get<string>(data, "Data.Buyer.Name") ?? null;
const llPhone = get<string>(data, "Data.Buyer.PhoneNumber") ?? null;
const llTransactionId = get<string>(data, "Data.Purchase.PaymentId") ?? get<string>(data, "Id") ?? null;
const llProductName = get<string>(data, "Data.Products.0.Name") ?? get<string>(data, "Data.Offer.Name") ?? null;
const llOfferId = get<string>(data, "Data.Offer.Id") ?? null;
const llOfferName = get<string>(data, "Data.Offer.Name") ?? null;
const llPaidAt = get<string>(data, "Data.Purchase.PaymentDate") ?? null;
const llCreatedAt = get<string>(data, "CreatedAt") ?? null;
const llPriceValue = get<number>(data, "Data.Purchase.Price.Value") ?? null;
const llAmountCents = typeof llPriceValue === "number" ? Math.round(llPriceValue * 100) : null;
const llEventType = get<string>(data, "Event") ?? null;

// resolved core identifiers (prefer v2, then lastlink, then legacy)
const userEmail = userEmailV2 ?? llEmail ?? userEmailLegacy;
const transactionId = transactionIdV2 ?? llTransactionId ?? transactionIdLegacy;
const paidAt = paidAtV2 ?? llPaidAt ?? paidAtLegacy;
const createdAt = createdAtV2 ?? llCreatedAt ?? createdAtLegacy;

// resolve amount (prefer v2 cents, then lastlink cents, then legacy total)
const amountCents = (amountCentsV2 ?? llAmountCents ?? null);
const totalAmount = amountCents != null ? amountCents / 100 : (totalAmountLegacy ?? null);
// resolve name (do NOT derive from email)
const collapseWhitespace = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const firstLast = collapseWhitespace([userFirst, userLast].filter(Boolean).join(" "));
let resolvedName = "";
let nameSource: 'user.first+last' | 'user.name' | 'buyer.name' | 'customer.name' | 'fallback' = 'fallback';
if (firstLast) {
  resolvedName = firstLast;
  nameSource = 'user.first+last';
} else if (collapseWhitespace(userName_user)) {
  resolvedName = collapseWhitespace(userName_user);
  nameSource = 'user.name';
} else if (collapseWhitespace(buyerName_v2)) {
  resolvedName = collapseWhitespace(buyerName_v2);
  nameSource = 'buyer.name';
} else if (collapseWhitespace(customerName_v2)) {
  resolvedName = collapseWhitespace(customerName_v2);
  nameSource = 'customer.name';
} else if (collapseWhitespace(llName)) {
  resolvedName = collapseWhitespace(llName);
  nameSource = 'lastlink.buyer.name';
} else {
  resolvedName = 'Cliente';
  nameSource = 'fallback';
}

// resolve phone (digits only)
const normalizePhone = (p?: string | null) => (p ?? "").replace(/\D/g, "");
const phoneUser = normalizePhone(v2UserPhone);
const phoneBuyer = normalizePhone(v2BuyerPhone);
const phoneCustomer = normalizePhone(v2CustomerPhone);
const phoneLegacy = normalizePhone(legacyCustomerPhone);
const phoneLastlink = normalizePhone(llPhone);
let resolvedPhone: string | null = null;
let phoneSource: 'user.phone' | 'buyer.phone' | 'customer.phone' | 'lastlink.phone' | 'legacy.whatsapp' | 'none' = 'none';
if (phoneUser) {
  resolvedPhone = phoneUser;
  phoneSource = 'user.phone';
} else if (phoneBuyer) {
  resolvedPhone = phoneBuyer;
  phoneSource = 'buyer.phone';
} else if (phoneLastlink) {
  resolvedPhone = phoneLastlink;
  phoneSource = 'lastlink.phone';
} else if (phoneCustomer) {
  resolvedPhone = phoneCustomer;
  phoneSource = 'customer.phone';
} else if (phoneLegacy) {
  resolvedPhone = phoneLegacy;
  phoneSource = 'legacy.whatsapp';
} else {
  resolvedPhone = null;
  phoneSource = 'none';
}

// Campos v2 (prioritários) do payload Hubla
const offerIdV2 = get<string>(event, "products.0.offers.0.id")
  ?? get<string>(data, "products.0.offers.0.id")
  ?? llOfferId
  ?? null;
const offerNameV2 = get<string>(event, "products.0.offers.0.name")
  ?? get<string>(data, "products.0.offers.0.name")
  ?? llOfferName
  ?? null;

// 2.1) Log de auditoria - salvar bruto
  try {
    await supabase.from("hubla_raw_events").insert({
      provider: origin,
      type,
      transaction_id: transactionId ?? null,
      payload: (typeof data === "object" ? data : { raw: textBody }) as any,
    });
  } catch (e) {
    console.error("Falha ao inserir em hubla_raw_events:", e);
  }

  // 3) Fluxo de processamento (somente se houver email e transação)
  let participantId: string | null = null;
let assignedCategory: "Wolf Gold" | "Wolf Black" | "VIP Wolf" = resolveCategory({
  offerId: offerIdV2,
  offerNameV2,
  offerName,
  productName,
});
  let status = "received";
  let errorMessage: string | null = null;
  let isNewSale = false;
  let wasNewParticipant = false;
  let wasNewTicket = false;

  try {
    if (!userEmail || !transactionId) {
      status = "skipped";
      throw new Error("Payload incompleto: é necessário userEmail e transactionId");
    }

    // 3.0) Processa somente eventos pagos quando o status existir
    const knownPaid = new Set(["paid","approved","succeeded","completed","authorized","confirmed","settled"]);
    const hasStatus = typeof invoiceStatus === "string" && invoiceStatus.length > 0;
if (hasStatus && !knownPaid.has(invoiceStatus!.toLowerCase())) {
      status = "skipped_unpaid";
      throw new Error(`Evento ignorado: invoice.status='${invoiceStatus}'`);
    }
    // Lastlink: considerar pago se Event === 'Purchase_Order_Confirmed' OU se houver PaymentDate
    if (origin === "lastlink") {
      const lastlinkEvent = (llEventType ?? "").toLowerCase();
      const isPaidLastlink = lastlinkEvent === "purchase_order_confirmed" || !!llPaidAt;
      if (!isPaidLastlink) {
        status = "skipped_unpaid";
        throw new Error(`Evento ignorado (lastlink): Event='${llEventType}', PaymentDate='${llPaidAt}'`);
      }
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
          user_name: resolvedName ?? null,
          user_phone: resolvedPhone ?? null,
          product_name: productName ?? null,
          offer_name: offerName ?? null,
          total_amount: totalAmount ?? null,
          created_at: createdAt ?? null,
          paid_at: paidAt ?? null,
        });
        isNewSale = true;
      }
    } catch (e) {
      console.error("Falha ao registrar wolf_sales:", e);
      // não aborta fluxo
    }

    // 3.2) Localiza ou cria participante
    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("id, phone, name")
      .eq("email", userEmail)
      .maybeSingle();

    if (existingParticipant?.id) {
      participantId = existingParticipant.id;
      // Atualizar phone apenas se vazio e se temos um resolvido
      if ((!existingParticipant.phone || existingParticipant.phone.length === 0) && resolvedPhone) {
        try {
          await supabase
            .from("participants")
            .update({ phone: resolvedPhone })
            .eq("id", participantId);
        } catch (e) {
          console.error("Falha ao atualizar phone do participante:", e);
        }
      }
      // Não sobrescrever name existente
    } else {
      // Criar participante novo
      const { data: inserted, error: insertParticipantErr } = await supabase
        .from("participants")
        .insert({
          name: resolvedName,
          email: userEmail,
          phone: resolvedPhone ?? null,
          category: assignedCategory,
          presencas: {},
        })
        .select("id")
        .maybeSingle();

      if (insertParticipantErr) throw insertParticipantErr;
      participantId = inserted?.id ?? null;
      wasNewParticipant = true;
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
        wasNewTicket = true;
      }
    } catch (e) {
      console.error("Falha ao garantir ticket:", e);
      // segue fluxo
    }
    // 3.4) Envia email usando send-ticket-email function (apenas em nova venda)
    try {
      if ((isNewSale || wasNewTicket) && userEmail && participantId) {
        // buscar QR code do ticket
        const { data: ticketRow } = await supabase
          .from("tickets")
          .select("qr_code")
          .eq("participant_id", participantId)
          .maybeSingle();
        const qrCodeData = ticketRow?.qr_code ?? participantId;

        try {
          // Chama a função send-ticket-email para usar o template correto
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-ticket-email', {
            body: {
              participantId,
              participantName: resolvedName,
              participantEmail: userEmail,
              participantCategory: assignedCategory,
              qrCodeData
            }
          });

          if (emailError) {
            console.error("Erro ao chamar send-ticket-email:", emailError);
            // Fallback para fila de email se a função falhar
            await supabase.from("email_queue").insert({
              participant_id: participantId,
              email: userEmail,
              subject: "Seu ingresso Wolf Day Brazil",
              html_content: `Erro ao processar template. Participante: ${resolvedName}, Categoria: ${assignedCategory}, QR: ${qrCodeData}`,
              status: 'pending',
            });
          } else {
            console.log(`Email de ingresso enviado via send-ticket-email para ${userEmail}`);
          }
        } catch (invokErr) {
          console.error("Falha ao invocar send-ticket-email, adicionando à fila:", invokErr);
          await supabase.from("email_queue").insert({
            participant_id: participantId,
            email: userEmail,
            subject: "Seu ingresso Wolf Day Brazil",
            html_content: `Erro ao processar template. Participante: ${resolvedName}, Categoria: ${assignedCategory}, QR: ${qrCodeData}`,
            status: 'pending',
          });
        }
      }
    } catch (emailErr) {
      console.error("Erro etapa de email:", emailErr);
    }

    status = "processed";
  } catch (err: any) {
    errorMessage = err?.message ?? String(err);
    console.error(`Erro no processamento do webhook (${origin}):`, err);
  } finally {
    // 4) Log final consolidado - mapear status para valores aceitos
    let logStatus: "success" | "duplicate" | "error" = "error";
    if (status === "processed") logStatus = "success";
    else if (status === "duplicate") logStatus = "duplicate";
    else logStatus = "error";
    
    try {
      await supabase.from("webhook_sales_logs").insert({
        origin,
        status: logStatus,
        raw_payload: (typeof data === "object" ? data : { raw: textBody }) as any,
        buyer_email: userEmail,
        buyer_name: resolvedName,
        product_name: productName,
        offer_id: offerIdV2,
        offer_name_v2: offerNameV2,
        product_id: transactionId ?? null,
        assigned_category: assignedCategory,
        participant_id: participantId,
        amount_cents: amountCents ?? null,
        name_source: nameSource,
        phone_source: phoneSource,
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
