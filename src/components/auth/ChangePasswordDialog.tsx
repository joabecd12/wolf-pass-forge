import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key } from "lucide-react";

export function ChangePasswordDialog() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  
  const { updatePassword, signIn, user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      // Verify current password by attempting to sign in
      if (user?.email) {
        const { error: signInError } = await signIn(user.email, currentPassword);
        if (signInError) {
          setError("Senha atual incorreta");
          setLoading(false);
          return;
        }
      }

      const { error } = await updatePassword(newPassword);

      if (error) {
        setError("Erro ao alterar senha. Tente novamente.");
      } else {
        toast({
          title: "Senha alterada",
          description: "Sua senha foi alterada com sucesso",
        });
        setOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-wolf-gold/30 text-white hover:bg-wolf-gold/10"
        >
          <Key className="h-4 w-4 mr-2" />
          Alterar Senha
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-wolf-black border-wolf-gold border-2">
        <DialogHeader>
          <DialogTitle className="text-wolf-gold">Alterar Senha</DialogTitle>
          <DialogDescription className="text-white/70">
            Digite sua senha atual e escolha uma nova senha
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-white text-sm">Senha Atual</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-background border-wolf-gold/30 h-11 pr-10"
                placeholder="Sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wolf-gold/70 hover:text-wolf-gold transition-colors"
                disabled={loading}
              >
                {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-white text-sm">Nova Senha</Label>
            <Input
              id="new-password"
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-background border-wolf-gold/30 h-11"
              placeholder="Nova senha (mín. 6 caracteres)"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-white text-sm">Confirmar Nova Senha</Label>
            <Input
              id="confirm-password"
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-background border-wolf-gold/30 h-11"
              placeholder="Confirme a nova senha"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 border-wolf-gold/30 text-white hover:bg-wolf-gold/10"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-wolf-gold text-wolf-black hover:bg-wolf-gold/90 font-medium"
              disabled={loading}
            >
              {loading ? "Alterando..." : "Alterar Senha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}