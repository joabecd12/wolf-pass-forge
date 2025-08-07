import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Users, TrendingUp, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns-tz';

interface DayPresence {
  date: string;
  count: number;
  participants: Array<{
    id: string;
    name: string;
    category: string;
  }>;
}

export function PresenceByDayPanel() {
  const [loading, setLoading] = useState(true);
  const [presenceData, setPresenceData] = useState<DayPresence[]>([]);
  const [filteredPresenceData, setFilteredPresenceData] = useState<DayPresence[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    loadPresenceData();
  }, []);

  const loadPresenceData = async () => {
    try {
      // Get all participants with their presencas
      const { data: participants, error } = await supabase
        .from('participants')
        .select('id, name, category, presencas')
        .not('presencas', 'is', null);

      if (error) {
        console.error('Error loading presence data:', error);
        return;
      }

      // Process the data to group by date
      const dateMap = new Map<string, DayPresence>();

      participants?.forEach(participant => {
        const presencas = participant.presencas || {};
        
        Object.entries(presencas).forEach(([date, present]) => {
          if (present) {
            if (!dateMap.has(date)) {
              dateMap.set(date, {
                date,
                count: 0,
                participants: []
              });
            }
            
            const dayData = dateMap.get(date)!;
            dayData.count++;
            dayData.participants.push({
              id: participant.id,
              name: participant.name,
              category: participant.category
            });
          }
        });
      });

      // Convert to array and sort by date
      const sortedData = Array.from(dateMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setPresenceData(sortedData);
      setFilteredPresenceData(sortedData);
      
      // Get total registered participants
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true });
      
      setTotalParticipants(count || 0);
    } catch (error) {
      console.error('Error loading presence data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data by category
  useEffect(() => {
    if (selectedCategory === "all") {
      setFilteredPresenceData(presenceData);
    } else {
      const filtered = presenceData.map(dayData => ({
        ...dayData,
        participants: dayData.participants.filter(p => p.category === selectedCategory),
        count: dayData.participants.filter(p => p.category === selectedCategory).length
      })).filter(dayData => dayData.count > 0);
      setFilteredPresenceData(filtered);
    }
  }, [selectedCategory, presenceData]);

  // Export CSV for a specific day
  const exportDayToCSV = (dayData: DayPresence) => {
    const csvContent = [
      ['Nome', 'Categoria', 'Data'],
      ...dayData.participants.map(p => [
        p.name, 
        p.category, 
        format(new Date(dayData.date + 'T00:00:00'), 'dd/MM/yyyy')
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `presencas-${dayData.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get unique categories
  const categories = ["all", ...Array.from(new Set(
    presenceData.flatMap(day => day.participants.map(p => p.category))
  ))];

  const dataToShow = selectedCategory === "all" ? presenceData : filteredPresenceData;

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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-2">Carregando dados de presença...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dias do Evento</p>
                <p className="text-2xl font-bold">{presenceData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Participantes</p>
                <p className="text-2xl font-bold">{totalParticipants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Presenças Únicas</p>
                <p className="text-2xl font-bold">
                  {presenceData.reduce((acc, day) => acc + day.count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Presence Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Presenças por Dia do Evento
            </CardTitle>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.filter(cat => cat !== "all").map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {dataToShow.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {selectedCategory === "all" 
                  ? "Nenhuma presença registrada ainda" 
                  : "Nenhuma presença encontrada para a categoria selecionada"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {dataToShow.map((dayData) => (
                <Card key={dayData.date} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          {format(new Date(dayData.date + 'T00:00:00'), 'dd/MM/yyyy')} 
                          {dayData.date === format(new Date(), 'yyyy-MM-dd') && (
                            <Badge variant="outline" className="ml-2">Hoje</Badge>
                          )}
                        </h3>
                        <Badge variant="secondary">
                          {dayData.count} presença{dayData.count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportDayToCSV(dayData)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Exportar CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {dayData.participants.map((participant) => (
                        <div 
                          key={participant.id} 
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <span className="text-sm font-medium">{participant.name}</span>
                          <Badge className={getCategoryColor(participant.category)}>
                            {participant.category}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}