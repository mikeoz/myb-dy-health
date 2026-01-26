import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * RootGate - Auth-based redirect gate for the root path.
 * Redirects to /home if authenticated, /auth if not.
 */
export default function RootGate() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate("/home", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  return null;
}
