import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, Mail, Edit, Trash2, Printer, Search, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TicketGenerator } from "@/components/tickets/TicketGenerator";
import { printLabel } from "@/components/labels/LabelPrint";
import QRCode from "qrcode";

interface Participant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  category: string;
  created_at: string;
  tickets: Array<{
    id: string;
    qr_code: string;
    is_validated: boolean;
    validated_at?: string;
  }>;
}

interface ParticipantsListProps {
  refreshTrigger: number;
}

export function ParticipantsList({ refreshTrigger }: ParticipantsListProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalBd, setTotalBd] = useState(0);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('participants-per-page');
    return saved ? parseInt(saved) : 30;
  });
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null);
  const { toast } = useToast();

  const loadTotalCount = async () => {
    try {
      const { count, error } = await supabase
        .from('participants')
        .select('id', { count: 'exact', head: true });
      
      if (error) throw error;
      setTotalBd(count ?? 0);
    } catch (error) {
      console.error("❌ Error loading total count:", error);
    }
  };

  const loadFilteredCount = async () => {
    try {
      let query = supabase
        .from('participants')
        .select('id', { count: 'exact', head: true });

      // Apply category filter
      if (categoryFilter !== "all") {
        query = query.eq('category', categoryFilter as "Wolf Gold" | "Wolf Black" | "VIP Wolf");
      }
      
      // Apply search filter
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { count, error } = await query;
      
      if (error) throw error;
      setTotalFiltered(count ?? 0);
    } catch (error) {
      console.error("❌ Error loading filtered count:", error);
    }
  };

  const loadParticipants = async () => {
    try {
      console.log("🔄 Carregando participantes...");
      
      // Calculate pagination range
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
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
        .order("created_at", { ascending: false })
        .range(from, to);

      // Apply category filter
      if (categoryFilter !== "all") {
        query = query.eq('category', categoryFilter as "Wolf Gold" | "Wolf Black" | "VIP Wolf");
      }
      
      // Apply search filter
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      const participantData = data || [];
      console.log(`✅ ${participantData.length} participantes carregados da página ${currentPage}`);
      setParticipants(participantData);
    } catch (error) {
      console.error("❌ Error loading participants:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar participantes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTotalCount();
    loadFilteredCount();
    loadParticipants();
  }, [refreshTrigger]);

  useEffect(() => {
    loadFilteredCount();
    setCurrentPage(1);
  }, [categoryFilter, searchTerm]);

  useEffect(() => {
    loadParticipants();
  }, [currentPage, itemsPerPage, categoryFilter, searchTerm]);

  // Save items per page to localStorage
  useEffect(() => {
    localStorage.setItem('participants-per-page', itemsPerPage.toString());
  }, [itemsPerPage]);

  const totalPages = Math.ceil(totalFiltered / itemsPerPage);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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


  const handleEditClick = (participant: Participant) => {
    setEditingParticipant(participant);
    setEditName(participant.name);
    setEditEmail(participant.email);
    setEditPhone(participant.phone || "");
    setEditCategory(participant.category);
    setIsEditDialogOpen(true);
  };

  const handleUpdateParticipant = async () => {
    if (!editingParticipant || !editName || !editEmail || !editCategory) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("participants")
        .update({
          name: editName,
          email: editEmail,
          phone: editPhone,
          category: editCategory as any,
        })
        .eq("id", editingParticipant.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Participante atualizado com sucesso",
      });

      setIsEditDialogOpen(false);
      loadParticipants();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar participante",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    try {
      // First delete the ticket
      const { error: ticketError } = await supabase
        .from("tickets")
        .delete()
        .eq("participant_id", participantId);

      if (ticketError) throw ticketError;

      // Then delete the participant
      const { error: participantError } = await supabase
        .from("participants")
        .delete()
        .eq("id", participantId);

      if (participantError) throw participantError;

      toast({
        title: "Sucesso!",
        description: "Participante excluído com sucesso",
      });

      loadParticipants();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir participante",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = (participants: Participant[], filename: string) => {
    const headers = ['Nome', 'E-mail', 'Telefone', 'Categoria', 'Status', 'ID'];
    
    const csvData = participants.map(participant => {
      const ticket = participant.tickets[0];
      const status = ticket ? (ticket.is_validated ? 'Validado' : 'Pendente') : 'Sem ingresso';
      
      return [
        participant.name,
        participant.email,
        participant.phone || '',
        participant.category,
        status,
        participant.id
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadAllParticipants = async () => {
    try {
      const allParticipants: Participant[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const to = from + batchSize - 1;
        
        let query = supabase
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
          .order("created_at", { ascending: false })
          .range(from, to);

        // Apply category filter if exists
        if (categoryFilter !== "all") {
          query = query.eq('category', categoryFilter as "Wolf Gold" | "Wolf Black" | "VIP Wolf");
        }
        
        // Apply search filter if exists
        if (searchTerm.trim()) {
          const search = searchTerm.toLowerCase();
          query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allParticipants.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allParticipants;
    } catch (error) {
      console.error("❌ Error loading all participants:", error);
      throw error;
    }
  };

  const handleExportVisible = async () => {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `participantes-wolfday-filtrados-${currentDate}.csv`;
      
      toast({
        title: "Carregando dados...",
        description: "Buscando participantes para exportação",
      });

      const allFilteredParticipants = await loadAllParticipants();
      exportToCSV(allFilteredParticipants, filename);
      
      toast({
        title: "Exportação concluída!",
        description: `${allFilteredParticipants.length} participantes exportados`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar participantes",
        variant: "destructive",
      });
    }
  };

  const handleExportAll = async () => {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `participantes-wolfday-todos-${currentDate}.csv`;
      
      toast({
        title: "Carregando dados...",
        description: "Buscando todos os participantes para exportação",
      });

      // Reset filters to get all participants
      const originalCategoryFilter = categoryFilter;
      const originalSearchTerm = searchTerm;
      
      // Temporarily clear filters to get all data
      const allParticipants: Participant[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const to = from + batchSize - 1;
        
        const { data, error } = await supabase
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
          .order("created_at", { ascending: false })
          .range(from, to);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allParticipants.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      exportToCSV(allParticipants, filename);
      
      toast({
        title: "Exportação concluída!",
        description: `${allParticipants.length} participantes exportados`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar todos os participantes",
        variant: "destructive",
      });
    }
  };

  const resendEmail = async (participant: Participant) => {
    if (participant.tickets.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum ingresso encontrado para este participante",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(participant.id);

    try {
      const ticket = participant.tickets[0];
      
      // Call the send-ticket-email edge function with just the participant ID
      const { error } = await supabase.functions.invoke('send-ticket-email', {
        body: {
          participantName: participant.name,
          participantEmail: participant.email,
          participantCategory: participant.category,
          participantId: participant.id,
          qrCodeData: '' // Not needed anymore, the edge function will generate it
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Email reenviado para ${participant.email}`,
      });
    } catch (error) {
      console.error("Error resending email:", error);
      toast({
        title: "Erro",
        description: "Erro ao reenviar email",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(null);
    }
  };

  const handleForceRefresh = async () => {
    setIsLoading(true);
    console.log("🔄 Forçando atualização dos dados...");
    // Clear all state
    setParticipants([]);
    setTotalBd(0);
    setTotalFiltered(0);
    // Clear filters
    setCategoryFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
    // Reload data
    await loadTotalCount();
    await loadFilteredCount();
    await loadParticipants();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="animate-pulse">Carregando participantes...</div>
          <div className="text-sm text-muted-foreground">
            Consultando banco de dados...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span>Participantes ({totalFiltered})</span>
            <Button
              onClick={handleForceRefresh}
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
              disabled={isLoading}
            >
              🔄 Atualizar
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Total no BD: {totalBd} | Filtrados: {totalFiltered} | Página: {participants.length}
          </div>
        </CardTitle>
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-input"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <Label htmlFor="category-filter" className="text-sm font-medium whitespace-nowrap">
              Categoria:
            </Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="category-filter" className="w-full sm:w-[180px] bg-background border-input">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-background border-input z-50">
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="Wolf Gold">Wolf Gold</SelectItem>
                <SelectItem value="Wolf Black">Wolf Black</SelectItem>
                <SelectItem value="VIP Wolf">VIP Wolf</SelectItem>
                <SelectItem value="Camarote">Camarote</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Export and Items per page selector */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-2">
            <Button
              onClick={handleExportVisible}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Participantes
            </Button>
            
            {(categoryFilter !== "all" || searchTerm.trim()) && (
              <Button
                onClick={handleExportAll}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar Todos
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="items-per-page" className="text-sm font-medium whitespace-nowrap">
              Mostrar:
            </Label>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger id="items-per-page" className="w-20 bg-background border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-input z-50">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">por página</span>
          </div>
          
          {totalPages > 1 && (
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalFiltered === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {totalBd === 0 ? "Nenhum participante cadastrado" : "Nenhum participante encontrado para os filtros aplicados"}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => {
                    const ticket = participant.tickets[0];
                    return (
                      <TableRow key={participant.id}>
                        <TableCell className="font-medium">
                          {participant.name}
                        </TableCell>
                        <TableCell>{participant.email}</TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(participant.category)}>
                            {participant.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ticket ? (
                            <Badge variant={ticket.is_validated ? "default" : "secondary"}>
                              {ticket.is_validated ? "Validado" : "Pendente"}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Sem ingresso</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => printLabel(participant)}
                              disabled={!ticket}
                              title="Imprimir Etiqueta"
                            >
                              <Printer size={14} />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resendEmail(participant)}
                              disabled={!ticket || isSendingEmail === participant.id}
                              title="Reenviar Email"
                            >
                              {isSendingEmail === participant.id ? (
                                <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                              ) : (
                                <Mail size={14} />
                              )}
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(participant)}
                              title="Editar Participante"
                            >
                              <Edit size={14} />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  title="Excluir Participante"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o participante {participant.name}? 
                                    Esta ação não pode ser desfeita e o ingresso também será excluído.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteParticipant(participant.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden space-y-3">
              {participants.map((participant) => {
                const ticket = participant.tickets[0];
                return (
                  <Card key={participant.id} className="p-4 border border-border/50">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{participant.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
                          {participant.phone && (
                            <p className="text-xs text-muted-foreground">{participant.phone}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge className={`${getCategoryColor(participant.category)} text-xs`}>
                            {participant.category}
                          </Badge>
                          {ticket ? (
                            <Badge variant={ticket.is_validated ? "default" : "secondary"} className="text-xs">
                              {ticket.is_validated ? "Validado" : "Pendente"}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Sem ingresso</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printLabel(participant)}
                          disabled={!ticket}
                          className="h-8 px-2 text-xs"
                        >
                          <Printer size={12} />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resendEmail(participant)}
                          disabled={!ticket || isSendingEmail === participant.id}
                          className="h-8 px-2 text-xs"
                        >
                          {isSendingEmail === participant.id ? (
                            <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <Mail size={12} />
                          )}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditClick(participant)}
                          className="h-8 px-2 text-xs"
                        >
                          <Edit size={12} />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2 text-xs"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[90vw]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base">Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Tem certeza que deseja excluir o participante {participant.name}? 
                                Esta ação não pode ser desfeita e o ingresso também será excluído.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteParticipant(participant.id)}
                                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            onClick={() => handlePageChange(pageNumber)}
                            isActive={currentPage === pageNumber}
                            className="cursor-pointer"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Participante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome completo do participante"
              />
            </div>

            <div>
              <Label htmlFor="edit-email">E-mail *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <Label htmlFor="edit-category">Categoria *</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
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

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateParticipant}
                disabled={isUpdating}
              >
                {isUpdating ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}