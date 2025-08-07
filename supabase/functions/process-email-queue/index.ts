import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando processamento da fila de emails...");

    // Buscar emails pendentes (limitado a 10 por execução para respeitar rate limits)
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Erro ao buscar emails: ${fetchError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("Nenhum email pendente encontrado");
      return new Response(
        JSON.stringify({ message: "Nenhum email pendente", processed: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processando ${pendingEmails.length} emails...`);

    let successCount = 0;
    let errorCount = 0;

    for (const email of pendingEmails) {
      // Pular emails que já excederam o número máximo de tentativas
      if (email.retry_count >= email.max_retries) {
        continue;
      }
      
      try {
        // Marcar como "enviando"
        await supabase
          .from('email_queue')
          .update({ status: 'sending', updated_at: new Date().toISOString() })
          .eq('id', email.id);

        // Enviar email
        const emailResponse = await resend.emails.send({
          from: "Wolf Day Brazil <noreply@wolfdaybr.com.br>",
          to: [email.email],
          subject: email.subject,
          html: email.html_content,
        });

        console.log(`Email enviado para ${email.email}:`, emailResponse);

        // Marcar como enviado
        await supabase
          .from('email_queue')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        successCount++;

        // Delay de 600ms entre emails para respeitar rate limit do Resend (2 req/sec)
        if (pendingEmails.indexOf(email) < pendingEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }

      } catch (emailError: any) {
        console.error(`Erro ao enviar email para ${email.email}:`, emailError);

        const newRetryCount = email.retry_count + 1;
        const newStatus = newRetryCount >= email.max_retries ? 'failed' : 'pending';
        const scheduledAt = newStatus === 'pending' 
          ? new Date(Date.now() + (newRetryCount * 5 * 60 * 1000)).toISOString() // 5 min * retry_count
          : email.scheduled_at;

        await supabase
          .from('email_queue')
          .update({ 
            status: newStatus,
            retry_count: newRetryCount,
            error_message: emailError.message,
            scheduled_at: scheduledAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        errorCount++;
      }
    }

    const result = {
      message: "Processamento concluído",
      processed: pendingEmails.length,
      successful: successCount,
      failed: errorCount
    };

    console.log("Resultado do processamento:", result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Erro no processamento da fila:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);