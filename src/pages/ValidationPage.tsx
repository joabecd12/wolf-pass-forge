import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Shield, Loader2, Printer, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { printLabel } from "@/components/labels/LabelPrint";
import { toZonedTime, format } from 'date-fns-tz';

interface ValidationData {
  participant: {
    id: string;
    name: string;
    category: string;
    presencas: Record<string, boolean>;
  };
  ticket: {
    id: string;
    is_validated: boolean;
    validated_at?: string;
  };
}

export default function ValidationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [data, setData] = useState<ValidationData | null>(null);
  const [status, setStatus] = useState<"valid" | "validated_today" | "invalid">("invalid");
  const [todayDate, setTodayDate] = useState<string>("");
  const { toast } = useToast();

  const ticketId = searchParams.get("id");

  const getTodayDateBrasilia = () => {
    const now = new Date();
    const brasiliaTime = toZonedTime(now, 'America/Sao_Paulo');
    return format(brasiliaTime, 'yyyy-MM-dd');
  };

  useEffect(() => {
    setTodayDate(getTodayDateBrasilia());
    
    if (!authLoading && !user) {
      navigate('/admin');
      return;
    }
    
    if (user) {
      if (ticketId) {
        validateTicket();
      } else {
        // Redirect to scanner if no ticket ID
        navigate('/');
      }
    }
  }, [ticketId, user, authLoading, navigate]);

  const validateTicket = async () => {
    if (!ticketId) return;

    try {
      const today = getTodayDateBrasilia();
      
      // Buscar participante pelo ID
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .select(`
          id,
          name,
          category,
          presencas,
          tickets (
            id,
            is_validated,
            validated_at
          )
        `)
        .eq("id", ticketId)
        .maybeSingle();

      if (participantError || !participant) {
        setStatus("invalid");
        setLoading(false);
        return;
      }

      const ticket = participant.tickets[0];
      if (!ticket) {
        setStatus("invalid");
        setLoading(false);
        return;
      }

      // Check if already validated today
      const presencas = (participant.presencas as Record<string, boolean>) || {};
      const validatedToday = presencas[today] === true;

      setData({
        participant: {
          id: participant.id,
          name: participant.name,
          category: participant.category,
          presencas: presencas,
        },
        ticket: {
          id: ticket.id,
          is_validated: ticket.is_validated,
          validated_at: ticket.validated_at,
        },
      });

      setStatus(validatedToday ? "validated_today" : "valid");
    } catch (error) {
      console.error("Erro ao validar ingresso:", error);
      setStatus("invalid");
    } finally {
      setLoading(false);
    }
  };

  const markAsValidated = async () => {
    if (!data?.participant) return;

    setValidating(true);
    try {
      const today = getTodayDateBrasilia();
      
      // Update participant presencas
      const presencas = data.participant.presencas || {};
      presencas[today] = true;

      const { error: updateError } = await supabase
        .from("participants")
        .update({ presencas })
        .eq("id", data.participant.id);

      if (updateError) throw updateError;

      // Record validation
      await supabase
        .from("validations")
        .insert({
          ticket_id: data.ticket.id,
          validated_by: user?.email || "Unknown User",
          validated_by_user_id: user?.id,
          ip_address: "127.0.0.1",
          user_agent: navigator.userAgent,
        });

      setData({
        ...data,
        participant: {
          ...data.participant,
          presencas,
        },
      });
      setStatus("validated_today");

      toast({
        title: "Sucesso!",
        description: "Presença validada com sucesso para hoje!",
      });
    } catch (error) {
      console.error("Erro ao validar:", error);
      toast({
        title: "Erro",
        description: "Erro ao validar presença",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Wolf Gold":
        return "bg-wolf-gold text-wolf-black";
      case "Wolf Black":
        return "bg-wolf-black text-white";
      case "VIP Wolf":
        return "bg-wolf-vip text-white";
      case "Camarote":
        return "bg-purple-600 text-white";
      default:
        return "bg-muted";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wolf-primary via-wolf-secondary to-wolf-accent flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin h-8 w-8" />
            <span className="ml-2">{authLoading ? 'Verificando autenticação...' : 'Verificando ingresso...'}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wolf-primary via-wolf-secondary to-wolf-accent flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Header */}
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold mb-2">🐺 Wolf Day</h1>
          <p className="text-wolf-gold">Validação de Presença por Dia</p>
          <p className="text-sm text-white/80 mt-1">
            Hoje: {format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'dd/MM/yyyy', { timeZone: 'America/Sao_Paulo' })}
          </p>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Shield className="h-6 w-6" />
              Status do Ingresso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === "invalid" && (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                  <XCircle className="h-16 w-16 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-red-600">🚫 Participante Inválido</h3>
                  <p className="text-muted-foreground">
                    Código não encontrado ou inválido
                  </p>
                </div>
              </div>
            )}

            {status === "validated_today" && data && (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                  <XCircle className="h-16 w-16 text-orange-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-orange-600">⚠️ Já validado hoje</h3>
                  <p className="text-sm text-muted-foreground">
                    Presença já registrada para hoje ({format(new Date(todayDate + 'T00:00:00'), 'dd/MM/yyyy')})
                  </p>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <div>
                    <span className="font-semibold">Nome:</span> {data.participant.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Categoria:</span>
                    <Badge className={getCategoryColor(data.participant.category)}>
                      {data.participant.category}
                    </Badge>
                  </div>
                </div>
                
                {/* Show all presence days */}
                {data.participant.presencas && Object.keys(data.participant.presencas).length > 0 && (
                  <div className="mt-4 p-3 bg-white rounded-lg border">
                    <h4 className="font-medium text-gray-800 mb-2">Dias presentes no evento:</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(data.participant.presencas)
                        .filter(([_, present]) => present)
                        .map(([date]) => (
                          <Badge key={date} variant="secondary">
                            {format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={() => printLabel(data.participant)}
                  variant="outline"
                  size="lg"
                  className="w-full flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Etiqueta
                </Button>
              </div>
            )}

            {status === "valid" && data && (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-green-600">✅ Pronto para validação</h3>
                  <p className="text-lg font-semibold text-green-700">Presença pode ser registrada hoje</p>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <div>
                    <span className="font-semibold">Nome:</span> {data.participant.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Categoria:</span>
                    <Badge className={getCategoryColor(data.participant.category)}>
                      {data.participant.category}
                    </Badge>
                  </div>
                </div>

                {/* Show all presence days */}
                {data.participant.presencas && Object.keys(data.participant.presencas).length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                    <h4 className="font-medium text-gray-800 mb-2">Dias presentes no evento:</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(data.participant.presencas)
                        .filter(([_, present]) => present)
                        .map(([date]) => (
                          <Badge key={date} variant="secondary">
                            {format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </Badge>
                        ))}
                    </div>
                    {Object.keys(data.participant.presencas).filter(([_, present]) => present).length === 0 && (
                      <p className="text-gray-600 text-sm">Primeira presença no evento</p>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={markAsValidated}
                    disabled={validating}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    {validating ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Validando...
                      </>
                    ) : (
                      "Registrar Presença Hoje"
                    )}
                  </Button>
                  <Button
                    onClick={() => printLabel(data.participant)}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Etiqueta
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-white/80 text-sm">Sistema de validação Wolf Day Brazil</p>
          <Link to="/admin">
            <Button variant="outline" className="flex items-center gap-2">
              <Home size={16} />
              Painel Admin
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}