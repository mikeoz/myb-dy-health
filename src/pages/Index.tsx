import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

/**
 * Index page - redirects to Home as the main entry point.
 */
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to home as the primary view
    navigate("/home", { replace: true });
  }, [navigate]);

  return null;
};

export default Index;
