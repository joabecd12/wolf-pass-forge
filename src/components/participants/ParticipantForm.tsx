import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { toTitleCase } from "@/lib/nameUtils";

interface ParticipantFormProps {
  onParticipantAdded: () => void;
}

export function ParticipantForm({ onParticipantAdded }: ParticipantFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !category) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check if email already exists
      const { data: existingParticipant } = await supabase
        .from("participants")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingParticipant) {
        toast({
          title: "Email já cadastrado",
          description: "Já existe um participante cadastrado com este email",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Format name properly before saving
      const formattedName = toTitleCase(name.trim());

      // Create participant
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          name: formattedName,
          email,
          phone,
          category: category as any,
        })
        .select()
        .single();

      if (participantError) throw participantError;

      // Generate QR code data
      const qrCodeData = `https://validapass.com.br/validar?id=${participant.id}`;

      // Create ticket
      const { error: ticketError } = await supabase
        .from("tickets")
        .insert({
          participant_id: participant.id,
          qr_code: qrCodeData,
        });

      if (ticketError) throw ticketError;

      // Add email to queue for batch processing
      try {
        const emailSubject = "Seu ingresso Wolf Day Brazil - Confirmação de Participação";
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Wolf Day Brazil - Seu Ingresso</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
              .content { padding: 30px; }
              .qr-section { text-align: center; background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
              .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🐺 Wolf Day Brazil</h1>
                <p>Parabéns! Sua participação foi confirmada</p>
              </div>
              
              <div class="content">
                <h2>Olá, ${participant.name}!</h2>
                <p>Ficamos muito felizes em confirmar sua participação no <strong>Wolf Day Brazil</strong>!</p>
                
                <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #1976d2;">📋 Detalhes da sua participação:</h3>
                  <p><strong>Nome:</strong> ${participant.name}</p>
                  <p><strong>Email:</strong> ${participant.email}</p>
                  <p><strong>Categoria:</strong> ${participant.category}</p>
                </div>

                <div class="qr-section">
                  <h3>🎫 Seu Ingresso Digital</h3>
                  <p>Use este QR Code no dia do evento para validar sua entrada:</p>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData)}" alt="QR Code do Ingresso" style="max-width: 200px; height: auto;" />
                  <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    <strong>Link de validação:</strong><br>
                    <a href="${qrCodeData}" style="color: #667eea; word-break: break-all;">${qrCodeData}</a>
                  </p>
                </div>

                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="margin-top: 0; color: #856404;">⚠️ Informações Importantes:</h4>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>Guarde este email com cuidado - você precisará do QR Code no dia do evento</li>
                    <li>Chegue com antecedência para validar sua entrada</li>
                    <li>Em caso de dúvidas, entre em contato conosco</li>
                  </ul>
                </div>
              </div>

              <div class="footer">
                <p><strong>Wolf Day Brazil</strong></p>
                <p>O maior evento de marketing digital do Brasil</p>
                <p style="font-size: 12px; color: #999;">
                  Este é um email automático, não responda a esta mensagem.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        const { error: queueError } = await supabase
          .from('email_queue')
          .insert({
            participant_id: participant.id,
            email: participant.email,
            subject: emailSubject,
            html_content: emailHtml,
            status: 'pending',
            scheduled_at: new Date().toISOString()
          });

        if (queueError) {
          console.error("Email queue error:", queueError);
          toast({
            title: "Participante cadastrado",
            description: "Participante cadastrado com sucesso, mas houve erro ao agendar email",
            variant: "default",
          });
        } else {
          toast({
            title: "Sucesso!",
            description: "Participante cadastrado e email agendado para envio",
          });
        }
      } catch (emailError) {
        console.error("Email queue error:", emailError);
        toast({
          title: "Participante cadastrado",
          description: "Participante cadastrado com sucesso, mas houve erro ao agendar email",
          variant: "default",
        });
      }

      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setCategory("");
      
      onParticipantAdded();
    } catch (error: any) {
      console.error("Error:", error);
      
      // Handle unique constraint violation
      if (error?.message?.includes('duplicate key') || error?.code === '23505') {
        toast({
          title: "Email já cadastrado",
          description: "Já existe um participante cadastrado com este email",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao cadastrar participante",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus size={20} />
          Novo Participante
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo do participante"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div>
            <Label htmlFor="category">Categoria *</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wolf Gold">Wolf Gold</SelectItem>
                <SelectItem value="Wolf Black">Wolf Black</SelectItem>
                <SelectItem value="VIP Wolf">VIP Wolf</SelectItem>
                <SelectItem value="Camarote">Camarote</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Cadastrando..." : "Cadastrar Participante"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}