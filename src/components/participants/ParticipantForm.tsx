import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

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

      // Create participant
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          name,
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

      // Send email directly via edge function
      try {
        const { error: emailError } = await supabase.functions.invoke('send-ticket-email', {
          body: {
            participantId: participant.id,
            participantName: participant.name,
            participantEmail: participant.email,
            participantCategory: participant.category,
            qrCodeData: qrCodeData
          }
        });

        if (emailError) {
          console.error("Email error:", emailError);
          toast({
            title: "Participante cadastrado",
            description: "Participante cadastrado com sucesso, mas houve erro ao enviar email",
            variant: "default",
          });
        } else {
          toast({
            title: "Sucesso!",
            description: "Participante cadastrado e email enviado com sucesso",
          });
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
        toast({
          title: "Participante cadastrado",
          description: "Participante cadastrado com sucesso, mas houve erro ao enviar email",
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