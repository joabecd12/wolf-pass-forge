
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendTicketEmailRequest {
  participantName: string;
  participantEmail: string;
  participantCategory: string;
  qrCodeData: string;
  participantId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { participantName, participantEmail, participantCategory, qrCodeData, participantId }: SendTicketEmailRequest = await req.json();

    // Force validapass.com.br domain for QR codes
    const validationUrl = `https://validapass.com.br/validar?id=${participantId}`;
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(validationUrl)}`;

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "Wolf Day Brazil <noreply@wolfdaybr.com.br>",
      to: [participantEmail],
      subject: "🎫 Seu ingresso para o Wolf Day Brazil está pronto!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a1a, #4a4a4a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; color: white;">🐺 Wolf Day Brazil</h1>
            <p style="margin: 10px 0 0 0; color: #FFD700;">Seu ingresso está pronto!</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #ddd;">
            <h2>Olá, ${participantName}!</h2>
            
            <p>Parabéns! Sua inscrição para o Wolf Day Brazil foi confirmada com sucesso.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📋 Informações do Ingresso</h3>
              <p><strong>Nome:</strong> ${participantName}</p>
              <p><strong>Email:</strong> ${participantEmail}</p>
              <p><strong>Categoria:</strong> ${participantCategory}</p>
              <p><strong>ID do Ingresso:</strong> ${participantId ? participantId.substring(0, 8).toUpperCase() : 'N/A'}</p>
            </div>

            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
              <h3>🎫 QR Code do Ingresso</h3>
              <p><strong>Apresente este QR Code na entrada do evento:</strong></p>
              <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block; margin: 10px 0;">
                <img src="${qrCodeImageUrl}" alt="QR Code do Ingresso" style="width: 200px; height: 200px; display: block;" />
              </div>
              <p style="font-size: 12px; color: #666; margin-top: 10px;">
                Este QR Code contém todas as informações do seu ingresso.<br/>
                Guarde este email - ele é o seu ingresso oficial!
              </p>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4>📌 Instruções Importantes:</h4>
              <ul>
                <li>Guarde este email com cuidado - ele contém seu ingresso oficial</li>
                <li>Apresente o QR Code na entrada do evento</li>
                <li>Você pode imprimir este email ou mostrar no celular</li>
                <li>Chegue com antecedência para evitar filas</li>
                <li>Traga um documento de identidade com foto</li>
              </ul>
            </div>

            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4>🗓️ Informações do Evento:</h4>
              <p><strong>Data:</strong> 24 e 25 de setembro de 2025</p>
              <p><strong>Horário:</strong> 08h às 20h</p>
              <p><strong>Local:</strong> Vibra São Paulo - Av. das Nações Unidas, nº 17955 - São Paulo - SP</p>
            </div>

            <p>Estamos ansiosos para vê-lo no Wolf Day Brazil!</p>
            
            <p>Atenciosamente,<br/>
            <strong>Equipe Wolf Day Brazil</strong></p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
            <p>Este é um email automático. Se você não se inscreveu para o Wolf Day Brazil, pode ignorar esta mensagem.</p>
            <p>© 2024 Wolf Day Brazil - Todos os direitos reservados</p>
          </div>
        </div>
      `
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-ticket-email function:", error);
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
