import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Play, Pause, RotateCcw, AlertCircle, Search, Calendar, Filter, Users, Send } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns';

interface EmailQueueItem {
  id: string;
  participant_id: string;
  email: string;
  subject: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  scheduled_at: string;
  sent_at?: string;
  created_at: string;
}

export const EmailQueueManager = () => {
  const [queueItems, setQueueItems] = useState<EmailQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('emailQueueItemsPerPage');
    return saved ? parseInt(saved) : 10;
  });
  const [participantsStats, setParticipantsStats] = useState({
    total: 0,
    withEmails: 0,
    withoutEmails: 0
  });
  const { toast } = useToast();

  // Timezone constante para Brasília
  const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

  // Função para obter data no timezone de Brasília
  const getBrazilDate = (date?: Date) => {
    return toZonedTime(date || new Date(), BRAZIL_TIMEZONE);
  };

  // Função para formatar data no timezone de Brasília
  const formatBrazilDate = (dateString: string) => {
    return formatInTimeZone(new Date(dateString), BRAZIL_TIMEZONE, 'dd/MM/yyyy HH:mm');
  };

  // Função para filtrar por datas no timezone de Brasília
  const getDateFilterRange = () => {
    const nowInBrazil = getBrazilDate();
    
    switch (dateFilter) {
      case 'today':
        return {
          start: startOfDay(nowInBrazil),
          end: endOfDay(nowInBrazil)
        };
      case 'last7days':
        return {
          start: startOfDay(subDays(nowInBrazil, 7)),
          end: endOfDay(nowInBrazil)
        };
      case 'last30days':
        return {
          start: startOfDay(subDays(nowInBrazil, 30)),
          end: endOfDay(nowInBrazil)
        };
      case 'thisWeek':
        return {
          start: startOfDay(subDays(nowInBrazil, nowInBrazil.getDay())),
          end: endOfDay(nowInBrazil)
        };
      case 'thisMonth':
        return {
          start: startOfDay(new Date(nowInBrazil.getFullYear(), nowInBrazil.getMonth(), 1)),
          end: endOfDay(nowInBrazil)
        };
      default:
        return null;
    }
  };

  const fetchQueueItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueueItems(data || []);
      
      // Fetch participants stats
      await fetchParticipantsStats();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: `Erro ao carregar fila de emails: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchParticipantsStats = async () => {
    try {
      // Get total participants count
      const { count: totalParticipants, error: totalError } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Get participants with emails in queue
      const { data: participantsWithEmails, error: emailError } = await supabase
        .from('participants')
        .select('id')
        .in('id', queueItems.map(item => item.participant_id).filter(Boolean));

      if (emailError) throw emailError;

      setParticipantsStats({
        total: totalParticipants || 0,
        withEmails: participantsWithEmails?.length || 0,
        withoutEmails: (totalParticipants || 0) - (participantsWithEmails?.length || 0)
      });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    try {
      console.log("Iniciando processamento da fila...");
      
      const { data, error } = await supabase.functions.invoke('process-email-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log("Resposta da função:", { data, error });
      
      if (error) {
        console.error("Erro na função:", error);
        throw error;
      }

      toast({
        title: "Fila processada",
        description: `${data?.processed || 0} emails processados. ${data?.successful || 0} enviados com sucesso.`,
      });

      fetchQueueItems();
    } catch (error: any) {
      console.error("Erro ao processar fila:", error);
      toast({
        title: "Erro",
        description: `Erro ao processar fila: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const retryFailedEmails = async () => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .update({ 
          status: 'pending', 
          retry_count: 0,
          error_message: null,
          scheduled_at: new Date().toISOString()
        })
        .eq('status', 'failed');

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Emails falhados foram reagendados para envio",
      });

      fetchQueueItems();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: `Erro ao reagendar emails: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const sendToAllWithoutEmails = async () => {
    setIsBulkAdding(true);
    try {
      // Get participants without emails in queue
      const { data: allParticipants, error: participantsError } = await supabase
        .from('participants')
        .select('id, name, email');

      if (participantsError) throw participantsError;

      const participantsWithEmails = new Set(queueItems.map(item => item.participant_id).filter(Boolean));
      const participantsWithoutEmails = allParticipants?.filter(p => !participantsWithEmails.has(p.id)) || [];

      if (participantsWithoutEmails.length === 0) {
        toast({
          title: "Informação",
          description: "Todos os participantes já têm emails na fila",
        });
        return;
      }

      // Create email queue entries for participants without emails
      const emailsToAdd = participantsWithoutEmails.map(participant => ({
        participant_id: participant.id,
        email: participant.email,
        subject: "Wolf Day Brazil - Seu Ingresso Digital",
        html_content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1a202c; margin: 0; font-size: 28px;">Wolf Day Brazil</h1>
                <p style="color: #4a5568; margin: 10px 0 0 0; font-size: 16px;">Seu ingresso digital chegou!</p>
              </div>
              
              <div style="background-color: #f7fafc; border-radius: 6px; padding: 20px; margin-bottom: 20px;">
                <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 20px;">Olá, ${participant.name}!</h2>
                <p style="color: #4a5568; margin: 0; line-height: 1.6;">
                  Seja bem-vindo(a) ao Wolf Day Brazil! Seu ingresso foi confirmado e você está pronto para participar do maior evento de networking e tecnologia do Brasil.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #e2e8f0; border-radius: 6px; padding: 15px; display: inline-block;">
                  <p style="margin: 0; color: #2d3748; font-weight: bold;">Guarde bem este email!</p>
                  <p style="margin: 5px 0 0 0; color: #4a5568; font-size: 14px;">Você precisará dele para validar sua entrada no evento</p>
                </div>
              </div>
              
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
                <p style="color: #718096; margin: 0; font-size: 14px; text-align: center;">
                  Em caso de dúvidas, entre em contato conosco.<br>
                  Nos vemos no Wolf Day Brazil! 🐺
                </p>
              </div>
            </div>
          </div>
        `,
        status: 'pending',
        scheduled_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('email_queue')
        .insert(emailsToAdd);

      if (insertError) throw insertError;

      toast({
        title: "Sucesso",
        description: `${emailsToAdd.length} emails adicionados à fila para envio`,
      });

      fetchQueueItems();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: `Erro ao adicionar emails à fila: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsBulkAdding(false);
    }
  };

  const sendToAllParticipants = async () => {
    setIsBulkAdding(true);
    try {
      // Clear existing queue first
      const { error: deleteError } = await supabase
        .from('email_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      // Get all participants
      const { data: allParticipants, error: participantsError } = await supabase
        .from('participants')
        .select('id, name, email');

      if (participantsError) throw participantsError;

      if (!allParticipants || allParticipants.length === 0) {
        toast({
          title: "Informação",
          description: "Nenhum participante encontrado",
        });
        return;
      }

      // Create email queue entries for all participants
      const emailsToAdd = allParticipants.map(participant => ({
        participant_id: participant.id,
        email: participant.email,
        subject: "Wolf Day Brazil - Seu Ingresso Digital",
        html_content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1a202c; margin: 0; font-size: 28px;">Wolf Day Brazil</h1>
                <p style="color: #4a5568; margin: 10px 0 0 0; font-size: 16px;">Seu ingresso digital chegou!</p>
              </div>
              
              <div style="background-color: #f7fafc; border-radius: 6px; padding: 20px; margin-bottom: 20px;">
                <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 20px;">Olá, ${participant.name}!</h2>
                <p style="color: #4a5568; margin: 0; line-height: 1.6;">
                  Seja bem-vindo(a) ao Wolf Day Brazil! Seu ingresso foi confirmado e você está pronto para participar do maior evento de networking e tecnologia do Brasil.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #e2e8f0; border-radius: 6px; padding: 15px; display: inline-block;">
                  <p style="margin: 0; color: #2d3748; font-weight: bold;">Guarde bem este email!</p>
                  <p style="margin: 5px 0 0 0; color: #4a5568; font-size: 14px;">Você precisará dele para validar sua entrada no evento</p>
                </div>
              </div>
              
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
                <p style="color: #718096; margin: 0; font-size: 14px; text-align: center;">
                  Em caso de dúvidas, entre em contato conosco.<br>
                  Nos vemos no Wolf Day Brazil! 🐺
                </p>
              </div>
            </div>
          </div>
        `,
        status: 'pending',
        scheduled_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('email_queue')
        .insert(emailsToAdd);

      if (insertError) throw insertError;

      toast({
        title: "Sucesso",
        description: `${emailsToAdd.length} emails adicionados à fila para envio (fila anterior limpa)`,
      });

      fetchQueueItems();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: `Erro ao recriar fila de emails: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsBulkAdding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: "default",
      sending: "secondary",
      sent: "default",
      failed: "destructive"
    };

    const statusLabels = {
      pending: "Pendente",
      sending: "Enviando",
      sent: "Enviado",
      failed: "Falhou"
    };

    return (
      <Badge variant={statusColors[status as keyof typeof statusColors] as any}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const getQueueStats = () => {
    const pending = queueItems.filter(item => item.status === 'pending').length;
    const sent = queueItems.filter(item => item.status === 'sent').length;
    const failed = queueItems.filter(item => item.status === 'failed').length;
    const sending = queueItems.filter(item => item.status === 'sending').length;

    return { pending, sent, failed, sending };
  };

  // Filter emails based on search term and date
  const filteredItems = queueItems.filter(item => {
    // Filtro de busca por texto
    let matchesSearch = true;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      matchesSearch = (
        item.email.toLowerCase().includes(search) ||
        item.subject.toLowerCase().includes(search) ||
        item.status.toLowerCase().includes(search)
      );
    }

    // Filtro de data usando timezone de Brasília
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const dateRange = getDateFilterRange();
      if (dateRange) {
        const itemDate = toZonedTime(new Date(item.created_at), BRAZIL_TIMEZONE);
        matchesDate = itemDate >= dateRange.start && itemDate <= dateRange.end;
      }
    }

    return matchesSearch && matchesDate;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    localStorage.setItem('emailQueueItemsPerPage', value);
  };

  // Reset to page 1 when search or date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter]);

  useEffect(() => {
    fetchQueueItems();
  }, []);

  const stats = getQueueStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gerenciador de Fila de Emails
          </CardTitle>
          <CardDescription>
            Monitore e gerencie o envio de emails em lote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pendentes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.sending}</div>
              <div className="text-sm text-muted-foreground">Enviando</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
              <div className="text-sm text-muted-foreground">Enviados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">Falharam</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{participantsStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Participantes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{participantsStats.withoutEmails}</div>
              <div className="text-sm text-muted-foreground">Sem Email</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={processQueue} 
              disabled={isProcessing || stats.pending === 0}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? "Processando..." : "Processar Fila"}
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="secondary"
                  disabled={isBulkAdding || participantsStats.withoutEmails === 0}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Enviar para Novos ({participantsStats.withoutEmails})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Envio para Novos Participantes</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá adicionar {participantsStats.withoutEmails} emails à fila para participantes que ainda não receberam email.
                    Os emails serão processados automaticamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={sendToAllWithoutEmails} disabled={isBulkAdding}>
                    {isBulkAdding ? "Adicionando..." : "Confirmar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline"
                  disabled={isBulkAdding || participantsStats.total === 0}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Reenviar para Todos ({participantsStats.total})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Reenvio para Todos</AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>ATENÇÃO:</strong> Esta ação irá limpar a fila atual e criar novos emails para TODOS os {participantsStats.total} participantes.
                    Isso significa que pessoas que já receberam email receberão novamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={sendToAllParticipants} disabled={isBulkAdding}>
                    {isBulkAdding ? "Processando..." : "Confirmar Reenvio"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button 
              variant="outline" 
              onClick={retryFailedEmails}
              disabled={stats.failed === 0}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reagendar Falhados
            </Button>

            <Button 
              variant="outline" 
              onClick={fetchQueueItems}
              disabled={isLoading}
            >
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico da Fila</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search, Date Filter and Items per page selector */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por email, assunto ou status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filtrar por data" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as datas</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="thisWeek">Esta semana</SelectItem>
                    <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                    <SelectItem value="thisMonth">Este mês</SelectItem>
                    <SelectItem value="last30days">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="items-per-page" className="text-sm font-medium whitespace-nowrap">
                Mostrar:
              </Label>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground whitespace-nowrap">por página</span>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Agendado</TableHead>
                    <TableHead>Enviado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? "Nenhum email encontrado com os critérios de busca." : "Nenhum email na fila."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.email}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          {item.retry_count}/{item.max_retries}
                          {item.error_message && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3 text-red-500" />
                              <span className="text-xs text-red-500 truncate max-w-[200px]" title={item.error_message}>
                                {item.error_message}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatBrazilDate(item.scheduled_at)}
                        </TableCell>
                        <TableCell>
                          {item.sent_at ? formatBrazilDate(item.sent_at) : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredItems.length)} de {filteredItems.length} emails
                  </div>
                  
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};