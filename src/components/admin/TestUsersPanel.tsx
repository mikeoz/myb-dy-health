import { useState } from "react";
import { Users, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { safeLog } from "@/lib/safe-logger";

/**
 * Test Users Panel (Development Only)
 * 
 * Allows creating dummy test users via the dev-create-test-user edge function.
 * 
 * GUARDRAIL: No PHI in logs
 * - Only log actions, never email addresses
 */

interface TestUser {
  email: string;
  displayName: string;
}

const TEST_USERS: TestUser[] = [
  { email: "test1@invalid.test", displayName: "Test User 1" },
  { email: "test2@invalid.test", displayName: "Test User 2" },
  { email: "test3@invalid.test", displayName: "Test User 3" },
];

export const TestUsersPanel = () => {
  const [loadingUser, setLoadingUser] = useState<string | null>(null);
  const { toast } = useToast();

  const createTestUser = async (user: TestUser) => {
    setLoadingUser(user.email);
    safeLog.info("Creating test user", { action: "create_test_user_attempt" });

    try {
      const { data, error } = await supabase.functions.invoke("dev-create-test-user", {
        body: { email: user.email, displayName: user.displayName },
      });

      if (error) {
        throw new Error(error.message || "Failed to create test user");
      }

      if (!data?.ok) {
        throw new Error(data?.error || "Failed to create test user");
      }

      safeLog.info("Test user created", { action: "create_test_user_success" });
      toast({
        title: "Test user created",
        description: `Created: ${user.email}`,
      });
    } catch (error) {
      safeLog.error("Failed to create test user", { 
        action: "create_test_user_error",
        errorType: "function_invoke_error"
      });
      toast({
        title: "Failed to create test user",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingUser(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Test Users (Development Only)</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Create dummy users for testing. These users have fake emails and a shared password.
      </p>

      <div className="space-y-2">
        {TEST_USERS.map((user) => (
          <div
            key={user.email}
            className="flex items-center justify-between rounded bg-muted/50 px-3 py-2"
          >
            <div>
              <span className="text-sm font-medium">{user.displayName}</span>
              <span className="ml-2 text-xs text-muted-foreground">{user.email}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => createTestUser(user)}
              disabled={loadingUser !== null}
            >
              {loadingUser === user.email ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded bg-muted/30 border border-border">
        <p className="text-xs text-muted-foreground">
          <strong>Shared test password:</strong> Use the value you set in TEST_USER_PASSWORD secret.
        </p>
      </div>
    </div>
  );
};
