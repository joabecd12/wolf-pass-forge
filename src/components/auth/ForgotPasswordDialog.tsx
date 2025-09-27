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

export function ForgotPasswordDialog() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await resetPassword(email);

      if (error) {
        setError("Erro ao enviar email de recuperação");
      } else {
        toast({
          title: "Email enviado",
          description: "Verifique sua caixa de entrada para redefinir sua senha",
        });
        setOpen(false);
        setEmail("");
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
        <button
          type="button"
          className="text-wolf-gold hover:text-wolf-gold/80 text-sm underline-offset-4 hover:underline transition-colors"
        >
          Esqueci minha senha
        </button>
      </DialogTrigger>
      <DialogContent className="bg-wolf-black border-wolf-gold border-2">
        <DialogHeader>
          <DialogTitle className="text-wolf-gold">Recuperar Senha</DialogTitle>
          <DialogDescription className="text-white/70">
            Digite seu email para receber instruções de recuperação
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="text-white text-sm">Email</Label>
            <Input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-background border-wolf-gold/30 h-11"
              placeholder="seu@email.com"
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
              {loading ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}