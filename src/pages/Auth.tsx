import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { safeLog } from "@/lib/safe-logger";
import { Loader2 } from "lucide-react";

/**
 * Authentication Page
 * 
 * Handles user sign up and sign in.
 * 
 * GUARDRAIL: User isolation
 * - Authentication is required to access user-scoped data
 * - RLS policies enforce user isolation at the database level
 * 
 * GUARDRAIL: No PHI in logs
 * - Only log actions and metadata, never email or credentials
 */
const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        safeLog.info("User signup attempt", { action: "auth_signup_attempt" });
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: displayName,
            },
          },
        });

        if (error) throw error;

        safeLog.info("User signup success", { action: "auth_signup_success" });
        toast({
          title: "Account created",
          description: "You can now sign in to your account.",
        });
        setIsSignUp(false);
      } else {
        safeLog.info("User signin attempt", { action: "auth_signin_attempt" });
        
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        safeLog.info("User signin success", { action: "auth_signin_success" });
        toast({
          title: "Welcome back",
          description: "You have successfully signed in.",
        });
        navigate("/timeline");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred";
      safeLog.error("Auth error", { 
        action: isSignUp ? "auth_signup_error" : "auth_signin_error",
        errorType: "auth_failure"
      });
      toast({
        title: "Authentication failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">MyBödy</h1>
          <p className="text-muted-foreground mt-2">
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline"
              disabled={isLoading}
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your health data is protected with end-to-end encryption and strict access controls.
        </p>
      </div>
    </div>
  );
};

export default Auth;
