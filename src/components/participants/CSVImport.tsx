import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVImportProps {
  onImportComplete: () => void;
}

export const CSVImport = ({ onImportComplete }: CSVImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [sendEmails, setSendEmails] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = `nome;email;telefone;categoria
"João Silva";"joao.silva@email.com";"11999999999";"Wolf Gold"
"Maria Santos";"maria.santos@email.com";"11888888888";"Wolf Black"
"Pedro Costa";"pedro.costa@email.com";"11777777777";"VIP Wolf"`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_participantes.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Validação de email
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Detectar separador automaticamente
  const detectDelimiter = (line: string): string => {
    const commaCount = (line.match(/,/g) || []).length;
    const semicolonCount = (line.match(/;/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
  };

  // Parser CSV mais robusto com suporte a múltiplos separadores
  const parseCSVLine = (line: string, delimiter: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result.map(val => val.replace(/^"|"$/g, ''));
  };

  const parseCSV = (csvText: string) => {
    console.log('Iniciando parse do CSV...');
    const lines = csvText.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Arquivo CSV está vazio');
    }

    // Detectar separador automaticamente
    const delimiter = detectDelimiter(lines[0]);
    console.log('Separador detectado:', delimiter);

    const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
    console.log('Headers encontrados:', headers);
    
    // Validar colunas obrigatórias
    const requiredHeaders = ['nome', 'email', 'categoria'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      throw new Error(`CSV deve conter as colunas obrigatórias: ${missingHeaders.join(', ')}. Colunas encontradas: ${headers.join(', ')}`);
    }
    
    // A coluna telefone é opcional
    const optionalHeaders = ['telefone'];
    const expectedHeaders = [...requiredHeaders, ...optionalHeaders];
    
    // Verificar se existem colunas não reconhecidas
    const unknownHeaders = headers.filter(header => !expectedHeaders.includes(header));
    if (unknownHeaders.length > 0) {
      console.warn('Colunas não reconhecidas (serão ignoradas):', unknownHeaders);
    }

    const participants = [];
    const emails = new Set();
    const validCategories = ['Wolf Gold', 'Wolf Black', 'VIP Wolf', 'Camarote'];
    
    for (let i = 1; i < lines.length; i++) {
      const lineData = lines[i].trim();
      if (!lineData) continue; // Pular linhas vazias
      
      console.log(`Processando linha ${i + 1}:`, lineData);
      const values = parseCSVLine(lineData, delimiter);
      const participant: any = {};
      
      headers.forEach((header, index) => {
        participant[header] = values[index] ? values[index].trim() : '';
      });

      console.log(`Dados da linha ${i + 1}:`, participant);

      // Validações
      if (!participant.nome || !participant.email || !participant.categoria) {
        throw new Error(`Linha ${i + 1}: dados obrigatórios em branco (nome: "${participant.nome}", email: "${participant.email}", categoria: "${participant.categoria}")`);
      }

      // Validar formato do email
      if (!isValidEmail(participant.email)) {
        throw new Error(`Linha ${i + 1}: formato de email inválido: "${participant.email}"`);
      }

      // Validar categoria
      if (!validCategories.includes(participant.categoria)) {
        throw new Error(`Linha ${i + 1}: categoria deve ser 'Wolf Gold', 'Wolf Black', 'VIP Wolf' ou 'Camarote'. Recebido: "${participant.categoria}"`);
      }

      // Verificar emails duplicados no CSV
      const emailLower = participant.email.toLowerCase();
      if (emails.has(emailLower)) {
        throw new Error(`Linha ${i + 1}: email duplicado no arquivo CSV: "${participant.email}"`);
      }
      emails.add(emailLower);

      participants.push({
        name: participant.nome,
        email: participant.email,
        phone: participant.telefone || null,
        category: participant.categoria as 'Wolf Gold' | 'Wolf Black' | 'VIP Wolf'
      });
    }

    console.log(`Parse concluído: ${participants.length} participantes válidos`);
    return participants;
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const csvText = await file.text();
      const participants = parseCSV(csvText);

      // Check for existing emails in database
      const emails = participants.map(p => p.email);
      const { data: existingParticipants } = await supabase
        .from('participants')
        .select('email')
        .in('email', emails);

      const existingEmails = new Set(existingParticipants?.map(p => p.email.toLowerCase()) || []);
      const validParticipants = participants.filter(p => !existingEmails.has(p.email.toLowerCase()));
      const duplicateEmails = participants.filter(p => existingEmails.has(p.email.toLowerCase()));

      if (duplicateEmails.length > 0) {
        const duplicateEmailsList = duplicateEmails.map(p => p.email).join(', ');
        
        if (validParticipants.length === 0) {
          toast({
            title: "Todos os emails já estão cadastrados",
            description: `Emails duplicados: ${duplicateEmailsList}`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        
        toast({
          title: "Alguns emails já estão cadastrados",
          description: `${duplicateEmails.length} emails duplicados foram ignorados. ${validParticipants.length} participantes serão importados.`,
          variant: "default",
        });
      }

      if (validParticipants.length === 0) {
        setIsLoading(false);
        return;
      }

      // Inserir participantes válidos no banco
      const { data: insertedParticipants, error: participantsError } = await supabase
        .from('participants')
        .insert(validParticipants)
        .select();

      if (participantsError) {
        throw new Error(participantsError.message);
      }

      // Criar tickets para cada participante
      const ticketsToInsert = insertedParticipants.map(participant => ({
        participant_id: participant.id,
        qr_code: `${participant.id}-${Date.now()}`
      }));

      const { data: insertedTickets, error: ticketsError } = await supabase
        .from('tickets')
        .insert(ticketsToInsert)
        .select();

      if (ticketsError) {
        throw new Error(ticketsError.message);
      }

      // Se envio de emails estiver habilitado, adicionar à fila
      if (sendEmails) {
        const emailQueueEntries = insertedParticipants.map((participant, index) => {
          // Force validapass.com.br domain for QR codes
          const validationUrl = `https://validapass.com.br/validar?id=${participant.id}`;
          const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(validationUrl)}`;
          
          return {
            participant_id: participant.id,
            email: participant.email,
            subject: "🎫 Seu ingresso para o Wolf Day Brazil está pronto!",
            html_content: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #1a1a1a, #4a4a4a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; color: white;">🐺 Wolf Day Brazil</h1>
                  <p style="margin: 10px 0 0 0; color: #FFD700;">Seu ingresso está pronto!</p>
                </div>
                
                <div style="background: white; padding: 30px; border: 1px solid #ddd;">
                  <h2>Olá, ${participant.name}!</h2>
                  
                  <p>Parabéns! Sua inscrição para o Wolf Day Brazil foi confirmada com sucesso.</p>
                  
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">📋 Informações do Ingresso</h3>
                    <p><strong>Nome:</strong> ${participant.name}</p>
                    <p><strong>Email:</strong> ${participant.email}</p>
                    <p><strong>Categoria:</strong> ${participant.category}</p>
                    <p><strong>ID do Ingresso:</strong> ${participant.id ? participant.id.substring(0, 8).toUpperCase() : 'N/A'}</p>
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
          };
        });

        const { error: queueError } = await supabase
          .from('email_queue')
          .insert(emailQueueEntries);

        if (queueError) {
          console.error('Erro ao adicionar emails à fila:', queueError);
          toast({
            title: "Atenção",
            description: `${participants.length} participantes importados, mas houve erro ao agendar envio de emails.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sucesso!",
            description: `${validParticipants.length} participantes importados e ${emailQueueEntries.length} emails adicionados à fila de envio.`,
          });
        }
      } else {
        toast({
          title: "Sucesso!",
          description: `${validParticipants.length} participantes importados sem envio de emails.`,
        });
      }

      setFile(null);
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      onImportComplete();

    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Participantes via CSV
        </CardTitle>
        <CardDescription>
          Importe múltiplos participantes de uma vez usando um arquivo CSV
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            O arquivo CSV deve conter as colunas obrigatórias: <strong>nome, email, categoria</strong>.
            A coluna <strong>telefone</strong> é opcional. A categoria deve ser 'Wolf Gold', 'Wolf Black' ou 'VIP Wolf'.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="csv-file">Arquivo CSV</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="send-emails"
            checked={sendEmails}
            onCheckedChange={setSendEmails}
          />
          <Label htmlFor="send-emails">Enviar emails automaticamente</Label>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Template
          </Button>
          
          <Button
            onClick={handleImport}
            disabled={!file || isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>Importando...</>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};