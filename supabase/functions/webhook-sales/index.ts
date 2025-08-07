import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Resend
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface HublaWebhookPayload {
  event: string;
  data: {
    id: string;
    email: string;
    name: string;
    product_name: string;
    product_id?: string;
    status: string;
    created_at: string;
  };
}

interface MonetizzeWebhookPayload {
  postback_type: string;
  customer: {
    email: string;
    name: string;
  };
  product: {
    name: string;
    id: string;
  };
  commissions: Array<{
    status: string;
  }>;
}

interface ProcessedSale {
  origin: string;
  buyerName: string;
  buyerEmail: string;
  productName: string;
  productId?: string;
  category: string;
}

// Product mapping configuration
const PRODUCT_CATEGORY_MAPPING: Record<string, string> = {
  // Hubla product mappings
  "vip-wolf": "VIP Wolf",
  "wolf-gold": "Wolf Gold", 
  "wolf-black": "Wolf Black",
  "ingresso-vip": "VIP Wolf",
  "ingresso-gold": "Wolf Gold",
  "ingresso-black": "Wolf Black",
  
  // Add more mappings as needed
  // "produto-id-monetizze": "Wolf Gold",
  // "produto-id-hotmart": "VIP Wolf",
};

function detectOrigin(payload: any, headers: Headers): string {
  // Check User-Agent for Hubla
  const userAgent = headers.get("user-agent") || "";
  if (userAgent.includes("Hubla") || payload.event) {
    return "hubla";
  }
  
  // Check for Monetizze structure
  if (payload.postback_type && payload.customer) {
    return "monetizze";
  }
  
  // Check for Hotmart structure
  if (payload.data && payload.data.buyer && payload.data.product) {
    return "hotmart";
  }
  
  // Check for Braip structure
  if (payload.trans_id && payload.client_email) {
    return "braip";
  }
  
  return "unknown";
}

function mapProductToCategory(productName: string, productId?: string): string {
  const searchKey = (productId || productName).toLowerCase();
  
  // Try exact match first
  if (PRODUCT_CATEGORY_MAPPING[searchKey]) {
    return PRODUCT_CATEGORY_MAPPING[searchKey];
  }
  
  // Try partial matches
  for (const [key, category] of Object.entries(PRODUCT_CATEGORY_MAPPING)) {
    if (searchKey.includes(key) || key.includes(searchKey)) {
      return category;
    }
  }
  
  // Default category
  return "Wolf Gold";
}

function processSaleData(payload: any, origin: string): ProcessedSale | null {
  switch (origin) {
    case "hubla":
      const hublaData = payload as HublaWebhookPayload;
      if (hublaData.event !== "sale.approved" && hublaData.data.status !== "approved") {
        return null; // Only process approved sales
      }
      
      return {
        origin,
        buyerName: hublaData.data.name,
        buyerEmail: hublaData.data.email,
        productName: hublaData.data.product_name,
        productId: hublaData.data.product_id,
        category: mapProductToCategory(hublaData.data.product_name, hublaData.data.product_id),
      };
      
    case "monetizze":
      const monetizzeData = payload as MonetizzeWebhookPayload;
      if (monetizzeData.postback_type !== "sale" || !monetizzeData.commissions.some(c => c.status === "approved")) {
        return null;
      }
      
      return {
        origin,
        buyerName: monetizzeData.customer.name,
        buyerEmail: monetizzeData.customer.email,
        productName: monetizzeData.product.name,
        productId: monetizzeData.product.id,
        category: mapProductToCategory(monetizzeData.product.name, monetizzeData.product.id),
      };
      
    // Add cases for hotmart, braip, etc.
    default:
      console.log(`Unsupported origin: ${origin}`);
      return null;
  }
}

async function generateQRCode(text: string): Promise<string> {
  // Simple QR code generation - you might want to use a proper library
  return `QR_${text.substring(0, 8)}_${Date.now()}`;
}

async function createParticipantAndTicket(saleData: ProcessedSale): Promise<{ participantId: string; ticketId: string } | null> {
  try {
    // Check if participant already exists
    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("id")
      .eq("email", saleData.buyerEmail)
      .single();

    let participantId: string;

    if (existingParticipant) {
      // Update existing participant category if different
      await supabase
        .from("participants")
        .update({ 
          category: saleData.category,
          name: saleData.buyerName // Update name in case it changed
        })
        .eq("id", existingParticipant.id);
      
      participantId = existingParticipant.id;
    } else {
      // Create new participant
      const { data: newParticipant, error: participantError } = await supabase
        .from("participants")
        .insert({
          name: saleData.buyerName,
          email: saleData.buyerEmail,
          category: saleData.category,
          presencas: {},
        })
        .select("id")
        .single();

      if (participantError) {
        console.error("Error creating participant:", participantError);
        return null;
      }

      participantId = newParticipant.id;
    }

    // Check if ticket already exists for this participant
    const { data: existingTicket } = await supabase
      .from("tickets")
      .select("id")
      .eq("participant_id", participantId)
      .single();

    if (existingTicket) {
      console.log("Ticket already exists for this participant");
      return { participantId, ticketId: existingTicket.id };
    }

    // Create ticket with QR code
    const qrCode = await generateQRCode(participantId);
    
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        participant_id: participantId,
        qr_code: qrCode,
      })
      .select("id")
      .single();

    if (ticketError) {
      console.error("Error creating ticket:", ticketError);
      return null;
    }

    return { participantId, ticketId: ticket.id };
  } catch (error) {
    console.error("Error in createParticipantAndTicket:", error);
    return null;
  }
}

async function sendTicketEmail(participantId: string, ticketId: string, saleData: ProcessedSale): Promise<boolean> {
  try {
    // Get participant and ticket data
    const { data: participant } = await supabase
      .from("participants")
      .select(`
        *,
        tickets (
          qr_code,
          id
        )
      `)
      .eq("id", participantId)
      .single();

    if (!participant || !participant.tickets || participant.tickets.length === 0) {
      console.error("Participant or ticket not found");
      return false;
    }

    const ticket = participant.tickets[0];

    // Generate ticket HTML content
    const ticketHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .ticket { border: 2px solid #000; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; }
          .qr-section { text-align: center; margin: 20px 0; }
          .info { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h1>Seu Ingresso</h1>
            <h2>${saleData.category}</h2>
          </div>
          
          <div class="info">
            <strong>Nome:</strong> ${participant.name}<br>
            <strong>Email:</strong> ${participant.email}<br>
            <strong>Categoria:</strong> ${participant.category}<br>
            <strong>Código:</strong> ${participant.short_id || ticket.id.substring(0, 8)}
          </div>
          
          <div class="qr-section">
            <p><strong>QR Code:</strong></p>
            <p style="font-family: monospace; background: #f0f0f0; padding: 10px;">
              ${ticket.qr_code}
            </p>
            <p><small>Apresente este código na entrada do evento</small></p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Evento <noreply@validapass.com.br>",
      to: [participant.email],
      subject: `Seu ingresso ${saleData.category} está pronto!`,
      html: ticketHtml,
    });

    console.log("Email sent successfully:", emailResponse);
    return true;
  } catch (error) {
    console.error("Error sending ticket email:", error);
    return false;
  }
}

async function logWebhookExecution(
  saleData: ProcessedSale | null, 
  rawPayload: any, 
  participantId?: string, 
  status: "success" | "error" | "duplicate" = "error", 
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from("webhook_sales_logs")
      .insert({
        origin: saleData?.origin || "unknown",
        raw_payload: rawPayload,
        buyer_name: saleData?.buyerName,
        buyer_email: saleData?.buyerEmail,
        product_name: saleData?.productName,
        product_id: saleData?.productId,
        assigned_category: saleData?.category,
        participant_id: participantId,
        status,
        error_message: errorMessage,
      });
  } catch (error) {
    console.error("Error logging webhook execution:", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const rawPayload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(rawPayload, null, 2));

    // Detect origin platform
    const origin = detectOrigin(rawPayload, req.headers);
    console.log("Detected origin:", origin);

    // Process sale data
    const saleData = processSaleData(rawPayload, origin);
    
    if (!saleData) {
      console.log("Sale data not processed (might not be an approved sale)");
      await logWebhookExecution(null, rawPayload, undefined, "error", "Sale not approved or invalid data");
      
      return new Response(JSON.stringify({ 
        message: "Webhook received but not processed (sale not approved or invalid data)" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Processed sale data:", saleData);

    // Create participant and ticket
    const result = await createParticipantAndTicket(saleData);
    
    if (!result) {
      const errorMsg = "Failed to create participant or ticket";
      await logWebhookExecution(saleData, rawPayload, undefined, "error", errorMsg);
      
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Send ticket email
    const emailSent = await sendTicketEmail(result.participantId, result.ticketId, saleData);
    
    if (!emailSent) {
      const errorMsg = "Participant created but failed to send email";
      await logWebhookExecution(saleData, rawPayload, result.participantId, "error", errorMsg);
      
      return new Response(JSON.stringify({ 
        message: "Participant created but email failed",
        participantId: result.participantId 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Log successful execution
    await logWebhookExecution(saleData, rawPayload, result.participantId, "success");

    return new Response(JSON.stringify({ 
      message: "Sale processed successfully",
      participantId: result.participantId,
      ticketId: result.ticketId,
      category: saleData.category 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in webhook-sales function:", error);
    
    try {
      await logWebhookExecution(null, {}, undefined, "error", error.message);
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);