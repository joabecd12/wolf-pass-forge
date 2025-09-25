import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Users, CheckCircle, AlertTriangle, FileText } from "lucide-react";

interface SyncStats {
  totalValidations: number;
  participantsWithValidations: number;
  participantsAlreadyMarked: number;
  participantsToSync: number;
}

interface SyncResult {
  success: boolean;
  updatedCount: number;
  errors: string[];
}

export function PresenceSyncPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const EVENT_DATE = "2025-09-24";

  const analyzeData = async () => {
    setIsLoading(true);
    try {
      // Get all validations for the event date
      const { data: validations, error: validationsError } = await supabase
        .from('validations')
        .select(`
          ticket_id,
          validated_at,
          ticket:tickets (
            participant_id,
            participant:participants (
              id,
              name,
              presencas
            )
          )
        `)
        .gte('validated_at', `${EVENT_DATE}T00:00:00`)
        .lt('validated_at', `${EVENT_DATE}T23:59:59`);

      if (validationsError) throw validationsError;

      const totalValidations = validations?.length || 0;
      
      // Get unique participants from validations
      const participantIds = [...new Set(validations?.map(v => v.ticket?.participant?.id).filter(Boolean))];
      const participantsWithValidations = participantIds.length;

      // Check how many already have presence marked for this date
      let participantsAlreadyMarked = 0;
      let participantsToSync = 0;

      validations?.forEach(validation => {
        const participant = validation.ticket?.participant;
        if (participant) {
          const presencas = participant.presencas as Record<string, boolean> || {};
          if (presencas[EVENT_DATE]) {
            participantsAlreadyMarked++;
          } else {
            participantsToSync++;
          }
        }
      });

      // Remove duplicates for accurate count
      const uniqueParticipantsToSync = new Set();
      validations?.forEach(validation => {
        const participant = validation.ticket?.participant;
        if (participant) {
          const presencas = participant.presencas as Record<string, boolean> || {};
          if (!presencas[EVENT_DATE]) {
            uniqueParticipantsToSync.add(participant.id);
          }
        }
      });

      setStats({
        totalValidations,
        participantsWithValidations,
        participantsAlreadyMarked: participantsAlreadyMarked,
        participantsToSync: uniqueParticipantsToSync.size
      });

    } catch (error: any) {
      console.error('Erro ao analisar dados:', error);
      toast.error('Erro ao analisar dados: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const syncPresences = async () => {
    if (!stats || stats.participantsToSync === 0) return;

    setIsSyncing(true);
    setSyncResult(null);

    try {
      // Get all validations for the event date again
      const { data: validations, error: validationsError } = await supabase
        .from('validations')
        .select(`
          ticket:tickets (
            participant_id,
            participant:participants (
              id,
              presencas
            )
          )
        `)
        .gte('validated_at', `${EVENT_DATE}T00:00:00`)
        .lt('validated_at', `${EVENT_DATE}T23:59:59`);

      if (validationsError) throw validationsError;

      // Get unique participants that need syncing
      const participantsToUpdate = new Map();
      
      validations?.forEach(validation => {
        const participant = validation.ticket?.participant;
        if (participant) {
          const presencas = participant.presencas as Record<string, boolean> || {};
          if (!presencas[EVENT_DATE]) {
            participantsToUpdate.set(participant.id, {
              ...presencas,
              [EVENT_DATE]: true
            });
          }
        }
      });

      const errors: string[] = [];
      let updatedCount = 0;

      // Update participants in batches
      const batchSize = 100;
      const participantEntries = Array.from(participantsToUpdate.entries());
      
      for (let i = 0; i < participantEntries.length; i += batchSize) {
        const batch = participantEntries.slice(i, i + batchSize);
        
        for (const [participantId, newPresencas] of batch) {
          try {
            const { error: updateError } = await supabase
              .from('participants')
              .update({ presencas: newPresencas })
              .eq('id', participantId);

            if (updateError) {
              errors.push(`Erro ao atualizar participante ${participantId}: ${updateError.message}`);
            } else {
              updatedCount++;
            }
          } catch (error: any) {
            errors.push(`Erro ao atualizar participante ${participantId}: ${error.message}`);
          }
        }
      }

      setSyncResult({
        success: errors.length === 0,
        updatedCount,
        errors
      });

      if (errors.length === 0) {
        toast.success(`Sincronização concluída! ${updatedCount} participantes atualizados.`);
      } else {
        toast.error(`Sincronização concluída com ${errors.length} erros. ${updatedCount} participantes atualizados.`);
      }

      // Refresh analysis
      await analyzeData();

    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro na sincronização: ' + error.message);
      setSyncResult({
        success: false,
        updatedCount: 0,
        errors: [error.message]
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sincronizar Presenças do Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta funcionalidade irá marcar como presente todos os participantes que tiveram QR codes escaneados em {EVENT_DATE}, 
            mesmo que os operadores não tenham clicado em "Validar Presença Hoje".
          </AlertDescription>
        </Alert>

        <div className="flex gap-4">
          <Button 
            onClick={analyzeData} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? "Analisando..." : "Analisar Dados"}
          </Button>
          
          {stats && stats.participantsToSync > 0 && (
            <Button 
              onClick={syncPresences} 
              disabled={isSyncing}
            >
              {isSyncing ? "Sincronizando..." : `Sincronizar ${stats.participantsToSync} Participantes`}
            </Button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total de Escaneamentos</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalValidations}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Participantes Únicos</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.participantsWithValidations}</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Já Marcados</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.participantsAlreadyMarked}</p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Para Sincronizar</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{stats.participantsToSync}</p>
            </div>
          </div>
        )}

        {syncResult && (
          <Alert className={syncResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <CheckCircle className={`h-4 w-4 ${syncResult.success ? "text-green-600" : "text-red-600"}`} />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  Resultado da Sincronização: {syncResult.updatedCount} participantes atualizados
                </p>
                {syncResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm text-red-600 font-medium">Erros encontrados:</p>
                    <ul className="text-sm text-red-600 list-disc list-inside">
                      {syncResult.errors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {syncResult.errors.length > 5 && (
                        <li>... e mais {syncResult.errors.length - 5} erros</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {stats && stats.participantsToSync === 0 && stats.participantsWithValidations > 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Todos os participantes que escanearam QR codes já estão marcados como presentes!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}