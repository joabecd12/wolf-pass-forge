import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, QrCode, FileText, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const { signOut, user } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
    } catch (error) {
      toast({
        title: "Erro ao fazer logout",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-3 md:p-4 mb-4 md:mb-6 bg-wolf-black border-wolf-gold border-2">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <div className="text-lg md:text-2xl font-bold text-wolf-gold text-center md:text-left">
            🐺 Wolf Day Brazil 2025
          </div>
          <div className="text-xs md:text-sm text-white text-center md:text-left">
            Sistema de Ingressos
          </div>
          {user && (
            <div className="text-xs text-white/70 text-center md:text-left">
              {user.email}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1 md:gap-2 justify-center md:justify-end">
          <Button
            variant={activeTab === "participants" ? "default" : "outline"}
            onClick={() => onTabChange("participants")}
            className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2"
            size="sm"
          >
            <Users size={14} className="md:w-4 md:h-4" />
            <span className="hidden sm:inline">Participantes</span>
            <span className="sm:hidden">Part.</span>
          </Button>
          
          <Button
            variant={activeTab === "scanner" ? "default" : "outline"}
            onClick={() => onTabChange("scanner")}
            className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2"
            size="sm"
          >
            <QrCode size={14} className="md:w-4 md:h-4" />
            <span className="hidden sm:inline">Scanner</span>
            <span className="sm:hidden">QR</span>
          </Button>
          
          <Button
            variant={activeTab === "reports" ? "default" : "outline"}
            onClick={() => onTabChange("reports")}
            className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2"
            size="sm"
          >
            <FileText size={14} className="md:w-4 md:h-4" />
            <span className="hidden sm:inline">Relatórios</span>
            <span className="sm:hidden">Rel.</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            size="sm"
          >
            <LogOut size={14} className="md:w-4 md:h-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}