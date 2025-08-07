import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { QrCode, CheckCircle, XCircle, Search, Printer, Camera, Monitor } from "lucide-react";
import { printLabel } from "@/components/labels/LabelPrint";
import { QrReader } from "react-qr-reader";
import { toZonedTime, format } from 'date-fns-tz';

interface ValidationResult {
  valid: boolean;
  participant?: {
    id: string;
    name: string;
    email: string;
    category: string;
    codigo: string;
    short_id?: string;
    presencas: Record<string, boolean>;
  };
  ticket?: {
    id: string;
    is_validated: boolean;
    validated_at?: string;
  };
  message: string;
  todayDate?: string;
  validatedToday?: boolean;
}

export function QRScanner() {
  const [manualCode, setManualCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { toast } = useToast();

  const getTodayDateBrasilia = () => {
    const now = new Date();
    const brasiliaTime = toZonedTime(now, 'America/Sao_Paulo');
    return format(brasiliaTime, 'yyyy-MM-dd');
  };

  const verifyTicket = async (qrCodeData: string) => {
    setIsValidating(true);
    const todayDate = getTodayDateBrasilia();
    
    try {
      let codigo: string;
      
      console.log("Input received:", qrCodeData);
      
      // Check if it's a URL or just a code
      if (qrCodeData.startsWith("http")) {
        // Extract participant code from QR code URL
        const url = new URL(qrCodeData);
        const id = url.searchParams.get("id");
        if (!id) {
          throw new Error("QR Code inválido");
        }
        codigo = id;
      } else {
        // Assume it's just the participant code
        codigo = qrCodeData.trim();
      }
      
      console.log("Searching for participant code:", codigo);

      // Try multiple search strategies to find the participant
      let participants, participantError;
      
      // Strategy 1: Search by short_id (8-character code)
      ({ data: participants, error: participantError } = await supabase
        .from("participants")
        .select(`
          *,
          tickets (
            id,
            qr_code,
            is_validated,
            validated_at
          )
        `)
        .eq('short_id', codigo.toUpperCase()));

      // Strategy 2: Search by full UUID (participant ID)
      if (!participants || participants.length === 0) {
        ({ data: participants, error: participantError } = await supabase
          .from("participants")
          .select(`
            *,
            tickets (
              id,
              qr_code,
              is_validated,
              validated_at
            )
          `)
          .eq('id', codigo));
      }

      // Strategy 3: Exact match on codigo field
      if (!participants || participants.length === 0) {
        ({ data: participants, error: participantError } = await supabase
          .from("participants")
          .select(`
            *,
            tickets (
              id,
              qr_code,
              is_validated,
              validated_at
            )
          `)
          .eq('codigo', codigo));
      }

      // Strategy 4: Case-insensitive search on codigo field
      if (!participants || participants.length === 0) {
        ({ data: participants, error: participantError } = await supabase
          .from("participants")
          .select(`
            *,
            tickets (
              id,
              qr_code,
              is_validated,
              validated_at
            )
          `)
          .ilike('codigo', codigo));
      }

      // Strategy 5: Search by ticket QR code (exact match)
      if (!participants || participants.length === 0) {
        const { data: tickets } = await supabase
          .from("tickets")
          .select(`
            *,
            participants (*)
          `)
          .eq('qr_code', qrCodeData);
        
        if (tickets && tickets.length > 0) {
          participants = [tickets[0].participants];
        }
      }

      // Strategy 6: Extract UUID from QR code URL and search by participant ID
      if (!participants || participants.length === 0 && qrCodeData.includes('validar?id=')) {
        const urlMatch = qrCodeData.match(/validar\?id=([a-f0-9-]+)/);
        if (urlMatch) {
          const participantId = urlMatch[1];
          ({ data: participants, error: participantError } = await supabase
            .from("participants")
            .select(`
              *,
              tickets (
                id,
                qr_code,
                is_validated,
                validated_at
              )
            `)
            .eq('id', participantId));
        }
      }

      if (participantError || !participants || participants.length === 0) {
        console.log("Participant not found for code:", codigo);
        setLastValidation({
          valid: false,
          message: "Participante não encontrado"
        });
        return;
      }

      const participant = participants[0];
      const ticket = participant.tickets[0];
      
      if (!ticket) {
        setLastValidation({
          valid: false,
          participant,
          message: "Ingresso não encontrado"
        });
        return;
      }

      // Check if already validated today
      const presencas = (participant.presencas as Record<string, boolean>) || {};
      const validatedToday = presencas[todayDate] === true;

      if (validatedToday) {
        setLastValidation({
          valid: false,
          participant,
          ticket,
          message: "Participante já validado hoje",
          todayDate,
          validatedToday: true
        });
        return;
      }

      // Ticket is valid and not validated today
      setLastValidation({
        valid: true,
        participant,
        ticket,
        message: "Participante válido - pronto para validação de presença hoje!",
        todayDate,
        validatedToday: false
      });

    } catch (error) {
      console.error("Verification error:", error);
      setLastValidation({
        valid: false,
        message: "Erro ao verificar ingresso"
      });
      
      toast({
        title: "Erro",
        description: "Erro ao verificar ingresso",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const validateTicket = async (participantId: string, todayDate: string) => {
    try {
      // Update participant presencas
      const { data: participant, error: fetchError } = await supabase
        .from('participants')
        .select('presencas')
        .eq('id', participantId)
        .single();

      if (fetchError) {
        console.error('Error fetching participant:', fetchError);
        toast({
          title: "Erro",
          description: "Erro ao buscar participante",
          variant: "destructive",
        });
        return;
      }

      const presencas = (participant.presencas as Record<string, boolean>) || {};
      presencas[todayDate] = true;

      const { error: updateError } = await supabase
        .from('participants')
        .update({ presencas })
        .eq('id', participantId);

      if (updateError) {
        console.error('Error updating participant presencas:', updateError);
        toast({
          title: "Erro",
          description: "Erro ao validar presença",
          variant: "destructive",
        });
        return;
      }

      // Record validation event
      const { error: validationError } = await supabase
        .from('validations')
        .insert({
          ticket_id: lastValidation?.ticket?.id,
          validated_at: new Date().toISOString(),
          validated_by: 'QR Scanner'
        });

      if (validationError) {
        console.error('Error recording validation:', validationError);
      }

      // Update local state
      setLastValidation(prev => prev && {
        ...prev,
        valid: false,
        validatedToday: true,
        participant: prev.participant ? {
          ...prev.participant,
          presencas
        } : undefined,
        message: "Presença validada com sucesso para hoje!"
      });

      toast({
        title: "Sucesso!",
        description: "Presença validada com sucesso para hoje!",
      });
    } catch (error) {
      console.error('Error validating presence:', error);
      toast({
        title: "Erro",
        description: "Erro ao validar presença",
        variant: "destructive",
      });
    }
  };

  const handleManualValidation = () => {
    if (!manualCode.trim()) {
      toast({
        title: "Erro",
        description: "Digite o código do QR",
        variant: "destructive",
      });
      return;
    }

    verifyTicket(manualCode);
    setManualCode("");
  };

  const handleScan = (result: any) => {
    console.log("Scan result received:", result);
    
    if (result) {
      console.log("QR Code detected:", result.text);
      const text = result.text?.trim();
      
      if (text && text.length > 0) {
        console.log("Processing QR code:", text);
        verifyTicket(text);
      } else {
        console.log("Empty QR code text");
      }
    } else {
      console.log("No QR code detected in frame");
    }
  };

  const handleError = (error: any) => {
    console.error("Camera error:", error);
    setCameraError("Erro ao acessar a câmera. Verifique as permissões.");
    setScanMode("manual");
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Wolf Gold":
        return "bg-wolf-gold text-wolf-black";
      case "Wolf Black":
        return "bg-wolf-black text-white";
      case "VIP Wolf":
        return "bg-wolf-vip text-white";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode size={20} />
            Scanner de QR Code - Presença por Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={scanMode === "manual" ? "default" : "outline"}
              onClick={() => setScanMode("manual")}
              className="flex-1"
            >
              <Monitor size={16} className="mr-2" />
              Input Manual
            </Button>
            <Button
              variant={scanMode === "camera" ? "default" : "outline"}
              onClick={() => {
                setScanMode("camera");
                setCameraError(null);
              }}
              className="flex-1"
            >
              <Camera size={16} className="mr-2" />
              Câmera
            </Button>
          </div>

          {cameraError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{cameraError}</p>
            </div>
          )}

          {scanMode === "manual" && (
            <div>
              <Label htmlFor="manual-code">Código Manual do QR</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Digite o código do participante (ex: 1D3EAE35) ou URL completa do QR"
                  onKeyPress={(e) => e.key === "Enter" && handleManualValidation()}
                />
                <Button
                  onClick={handleManualValidation}
                  disabled={isValidating}
                >
                  <Search size={16} />
                  {isValidating ? "Verificando..." : "Verificar"}
                </Button>
              </div>
            </div>
          )}

          {scanMode === "camera" && (
            <div>
              <Label>Scanner de Câmera</Label>
              <div className="border rounded-lg overflow-hidden bg-black">
                <QrReader
                  onResult={handleScan}
                  constraints={{
                    facingMode: "environment",
                    frameRate: { ideal: 30, min: 10 },
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 480 },
                    aspectRatio: 16/9
                  }}
                  containerStyle={{
                    width: "100%",
                    height: "300px"
                  }}
                  videoContainerStyle={{
                    paddingTop: 0,
                    height: "300px"
                  }}
                  videoStyle={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                  scanDelay={300}
                  ViewFinder={() => (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '200px',
                        height: '200px',
                        border: '2px solid #00ff00',
                        borderRadius: '12px',
                        backgroundColor: 'transparent'
                      }}
                    />
                  )}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Aponte a câmera para o QR code do ingresso
              </p>
              {cameraError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {cameraError}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {lastValidation && (
        <Card className={`border-2 ${lastValidation.valid ? "border-green-500" : lastValidation.validatedToday ? "border-orange-500" : "border-red-500"}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastValidation.valid ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : lastValidation.validatedToday ? (
                <XCircle className="text-orange-500" size={20} />
              ) : (
                <XCircle className="text-red-500" size={20} />
              )}
              Resultado da Validação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`p-4 rounded-lg ${
              lastValidation.valid ? "bg-green-50" : 
              lastValidation.validatedToday ? "bg-orange-50" : 
              "bg-red-50"
            }`}>
              <p className={`font-medium ${
                lastValidation.valid ? "text-green-800" : 
                lastValidation.validatedToday ? "text-orange-800" : 
                "text-red-800"
              }`}>
                {lastValidation.message}
              </p>
            </div>

            {lastValidation.participant && (
              <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                   <h4 className="font-semibold">Dados do Participante:</h4>
                   <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                     {lastValidation.valid && !lastValidation.validatedToday && (
                       <Button
                         onClick={() => validateTicket(lastValidation.participant!.id, lastValidation.todayDate!)}
                         variant="default"
                         size="sm"
                         className="w-full sm:w-auto"
                         disabled={isValidating}
                       >
                         <CheckCircle size={16} className="mr-2" />
                         {isValidating ? 'Validando...' : 'Validar Presença Hoje'}
                       </Button>
                     )}
                     <Button
                       onClick={() => printLabel({
                         id: lastValidation.participant!.id,
                         name: lastValidation.participant!.name,
                         category: lastValidation.participant!.category
                       })}
                       variant="outline"
                       size="sm"
                       className="w-full sm:w-auto"
                     >
                       <Printer size={16} className="mr-2" />
                       Imprimir Etiqueta
                     </Button>
                   </div>
                 </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome</Label>
                    <p className="font-medium">{lastValidation.participant.name}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p>{lastValidation.participant.email}</p>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Badge className={getCategoryColor(lastValidation.participant.category)}>
                      {lastValidation.participant.category}
                    </Badge>
                  </div>
                  {lastValidation.todayDate && (
                    <div>
                      <Label>Data Atual</Label>
                      <p>{format(new Date(lastValidation.todayDate + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    </div>
                  )}
                </div>

                {/* Show all presence days */}
                {lastValidation.participant.presencas && Object.keys(lastValidation.participant.presencas).length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                    <h4 className="font-medium text-gray-800 mb-2">Dias presentes no evento:</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(lastValidation.participant.presencas)
                        .filter(([_, present]) => present)
                        .map(([date]) => (
                          <Badge key={date} variant="secondary">
                            {format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </Badge>
                        ))}
                    </div>
                    {Object.keys(lastValidation.participant.presencas).filter(([_, present]) => present).length === 0 && (
                      <p className="text-gray-600 text-sm">Nenhuma presença registrada ainda</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}