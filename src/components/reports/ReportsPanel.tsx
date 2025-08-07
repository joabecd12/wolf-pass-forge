import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { EmailQueueManager } from "@/components/email/EmailQueueManager";
import { PresenceByDayPanel } from "./PresenceByDayPanel";
import { WebhookLogsPanel } from "./WebhookLogsPanel";

interface Stats {
  total: number;
  validated: number;
  pending: number;
  byCategory: Record<string, { total: number; validated: number }>;
}

interface RecentValidation {
  id: string;
  validated_at: string;
  ticket: {
    participant: {
      name: string;
      category: string;
    };
  };
}

export function ReportsPanel() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    validated: 0,
    pending: 0,
    byCategory: {}
  });
  const [recentValidations, setRecentValidations] = useState<RecentValidation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    try {
      // Get participants with tickets
      const { data: participants, error } = await supabase
        .from("participants")
        .select(`
          id,
          category,
          tickets (
            id,
            is_validated
          )
        `);

      if (error) throw error;

      // Calculate stats
      const stats: Stats = {
        total: participants?.length || 0,
        validated: 0,
        pending: 0,
        byCategory: {}
      };

      participants?.forEach(participant => {
        const ticket = participant.tickets[0];
        const category = participant.category;

        // Initialize category if not exists
        if (!stats.byCategory[category]) {
          stats.byCategory[category] = { total: 0, validated: 0 };
        }

        stats.byCategory[category].total++;

        if (ticket?.is_validated) {
          stats.validated++;
          stats.byCategory[category].validated++;
        } else {
          stats.pending++;
        }
      });

      setStats(stats);

      // Get recent validations
      const { data: validations, error: validationsError } = await supabase
        .from("validations")
        .select(`
          id,
          validated_at,
          ticket:tickets (
            participant:participants (
              name,
              category
            )
          )
        `)
        .order("validated_at", { ascending: false })
        .limit(10);

      if (validationsError) throw validationsError;
      setRecentValidations(validations as any || []);

    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const categoryData = Object.entries(stats.byCategory).map(([category, data]) => ({
    category,
    total: data.total,
    validated: data.validated,
    pending: data.total - data.validated
  }));

  const pieData = Object.entries(stats.byCategory).map(([category, data]) => ({
    name: category,
    value: data.total
  }));

  const COLORS = {
    "Wolf Gold": "#FFA500",
    "Wolf Black": "#262626", 
    "VIP Wolf": "#B347E6"
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          Carregando relatórios...
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="analytics" className="space-y-6">
      <TabsList>
        <TabsTrigger value="analytics">Análises</TabsTrigger>
        <TabsTrigger value="email-queue">Fila de Emails</TabsTrigger>
        <TabsTrigger value="webhook-logs">Logs de Webhooks</TabsTrigger>
      </TabsList>

      <TabsContent value="analytics" className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Validados</p>
                  <p className="text-2xl font-bold text-green-600">{stats.validated}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Taxa</p>
                  <p className="text-2xl font-bold">
                    {stats.total > 0 ? Math.round((stats.validated / stats.total) * 100) : 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Ingressos por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="validated" fill="#22c55e" name="Validados" />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pendentes" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || "#8884d8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Validations */}
        <Card>
          <CardHeader>
            <CardTitle>Validações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentValidations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma validação registrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentValidations.map((validation) => (
                    <TableRow key={validation.id}>
                      <TableCell className="font-medium">
                        {validation.ticket.participant.name}
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(validation.ticket.participant.category)}>
                          {validation.ticket.participant.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(validation.validated_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Presence by Day Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Presenças por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <PresenceByDayPanel />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="email-queue">
        <EmailQueueManager />
      </TabsContent>

      <TabsContent value="webhook-logs">
        <WebhookLogsPanel />
      </TabsContent>
    </Tabs>
  );
}