import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        if (error.message === "Invalid login credentials") {
          setError("Email ou senha incorretos");
        } else if (error.message === "User already registered") {
          setError("Usuário já cadastrado. Faça login.");
        } else {
          setError(error.message);
        }
      } else {
        if (!isLogin) {
          toast({
            title: "Conta criada com sucesso",
            description: "Verifique seu email para confirmar a conta",
          });
        } else {
          toast({
            title: "Login realizado com sucesso",
            description: "Bem-vindo ao sistema",
          });
          navigate("/");
        }
      }
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-wolf-black border-wolf-gold border-2">
        <CardHeader className="text-center space-y-2">
          <div className="text-2xl md:text-3xl font-bold text-wolf-gold mb-2">
            🐺 Wolf Day Brazil
          </div>
          <CardTitle className="text-white text-lg md:text-xl">
            {isLogin ? "Login Administrativo" : "Criar Conta"}
          </CardTitle>
          <CardDescription className="text-white/70 text-sm">
            {isLogin 
              ? "Acesse o painel de controle" 
              : "Crie uma conta para acessar o sistema"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-background border-wolf-gold/30 h-11"
                placeholder="seu@email.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white text-sm">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-background border-wolf-gold/30 h-11 pr-10"
                  placeholder="Sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-wolf-gold/70 hover:text-wolf-gold transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-wolf-gold text-wolf-black hover:bg-wolf-gold/90 h-11 font-medium"
              disabled={loading}
            >
              {loading ? "Carregando..." : (isLogin ? "Entrar" : "Criar Conta")}
            </Button>
            
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-wolf-gold hover:text-wolf-gold/80 text-sm underline-offset-4 hover:underline transition-colors"
                disabled={loading}
              >
                {isLogin 
                  ? "Não tem conta? Criar uma agora" 
                  : "Já tem conta? Fazer login"
                }
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}