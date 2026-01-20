import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

/**
 * Index page - redirects to Timeline as the main entry point.
 */
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to timeline as the primary view
    navigate("/timeline", { replace: true });
  }, [navigate]);

  return null;
};

export default Index;
