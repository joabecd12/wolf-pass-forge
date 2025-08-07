import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Play, Pause, RotateCcw, AlertCircle, Search, Calendar, Filter } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns';

interface EmailQueueItem {
  id: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('emailQueueItemsPerPage');
    return saved ? parseInt(saved) : 10;
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={processQueue} 
              disabled={isProcessing || stats.pending === 0}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? "Processando..." : "Processar Fila"}
            </Button>
            
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