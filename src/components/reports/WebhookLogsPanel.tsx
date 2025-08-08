import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Webhook, CheckCircle, XCircle, AlertCircle, Eye, RefreshCw, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns-tz';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface WebhookLog {
  id: string;
  origin: string;
  raw_payload: any;
  buyer_name: string | null;
  buyer_email: string | null;
  product_name: string | null;
  product_id: string | null;
  assigned_category: string | null;
  participant_id: string | null;
  status: 'success' | 'error' | 'duplicate';
  error_message: string | null;
  processed_at: string;
  created_at: string;
}

export function WebhookLogsPanel() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const { toast } = useToast();
  const webhookUrl = "https://validapass.com.br/webhooks/venda";
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast({ title: "URL copiada", description: "Cole na plataforma de pagamento para ativar o webhook." });
    } catch (e) {
      toast({ title: "Falha ao copiar", description: "Copie manualmente a URL.", variant: "destructive" });
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("webhook_sales_logs")
        .select("*")
        .order("processed_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (originFilter !== "all") {
        query = query.eq("origin", originFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading webhook logs:", error);
        return;
      }

      setLogs((data || []) as WebhookLog[]);
    } catch (error) {
      console.error("Error loading webhook logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [statusFilter, originFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Sucesso</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      case 'duplicate':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />Duplicado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOriginBadge = (origin: string) => {
    const colors = {
      hubla: "bg-blue-100 text-blue-800",
      monetizze: "bg-purple-100 text-purple-800",
      hotmart: "bg-orange-100 text-orange-800",
      braip: "bg-teal-100 text-teal-800",
      unknown: "bg-gray-100 text-gray-800"
    };

    return (
      <Badge className={colors[origin as keyof typeof colors] || colors.unknown}>
        {origin.toUpperCase()}
      </Badge>
    );
  };

  const getUniqueOrigins = () => {
    return Array.from(new Set(logs.map(log => log.origin))).filter(origin => origin);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2">Carregando logs de webhooks...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* URL pública do webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Endpoint público de Webhook
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm break-all">{webhookUrl}</code>
                <Button variant="outline" size="sm" onClick={handleCopy} aria-label="Copiar URL do webhook">
                  <Copy className="h-4 w-4 mr-2" /> Copiar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Copie esta URL e cole na plataforma de pagamento (ex: Hubla, Monetizze, Hotmart, etc) para que os participantes sejam adicionados automaticamente ao sistema após a compra.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header with filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Logs de Webhooks de Vendas
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="duplicate">Duplicado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {getUniqueOrigins().map((origin) => (
                  <SelectItem key={origin} value={origin}>
                    {origin.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium">Sucessos</div>
              <div className="text-2xl font-bold text-green-700">
                {logs.filter(log => log.status === 'success').length}
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-red-600 font-medium">Erros</div>
              <div className="text-2xl font-bold text-red-700">
                {logs.filter(log => log.status === 'error').length}
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm text-yellow-600 font-medium">Duplicados</div>
              <div className="text-2xl font-bold text-yellow-700">
                {logs.filter(log => log.status === 'duplicate').length}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Total</div>
              <div className="text-2xl font-bold text-blue-700">{logs.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum log de webhook encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.processed_at), 'dd/MM/yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      {getOriginBadge(log.origin)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.buyer_name || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">{log.buyer_email || "N/A"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-48 truncate" title={log.product_name || "N/A"}>
                        {log.product_name || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.assigned_category && (
                        <Badge variant="outline">{log.assigned_category}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Detalhes do Webhook</DialogTitle>
                          </DialogHeader>
                          {selectedLog && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <strong>ID:</strong> {selectedLog.id}
                                </div>
                                <div>
                                  <strong>Origem:</strong> {getOriginBadge(selectedLog.origin)}
                                </div>
                                <div>
                                  <strong>Status:</strong> {getStatusBadge(selectedLog.status)}
                                </div>
                                <div>
                                  <strong>Data:</strong> {format(new Date(selectedLog.processed_at), 'dd/MM/yyyy HH:mm:ss')}
                                </div>
                              </div>
                              
                              {selectedLog.error_message && (
                                <div>
                                  <strong>Erro:</strong>
                                  <pre className="bg-red-50 p-2 rounded text-red-700 text-sm mt-1">
                                    {selectedLog.error_message}
                                  </pre>
                                </div>
                              )}

                              <div>
                                <strong>Payload Raw:</strong>
                                <pre className="bg-gray-50 p-4 rounded text-sm mt-2 overflow-x-auto">
                                  {JSON.stringify(selectedLog.raw_payload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}