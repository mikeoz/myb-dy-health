import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Index from "./pages/Index";
import Home from "./pages/Home";
import Journal from "./pages/Journal";
import Timeline from "./pages/Timeline";
import EventDetails from "./pages/EventDetails";
import Documents from "./pages/Documents";
import Sources from "./pages/Sources";
import Consent from "./pages/Consent";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Guardrails from "./pages/docs/Guardrails";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth route without layout */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Main app routes with layout */}
          <Route element={<AppLayout><Index /></AppLayout>} path="/" />
          <Route path="/home" element={<AppLayout><Home /></AppLayout>} />
          <Route path="/journal" element={<AppLayout><Journal /></AppLayout>} />
          <Route path="/timeline" element={<AppLayout><Timeline /></AppLayout>} />
          <Route path="/event/:id" element={<AppLayout><EventDetails /></AppLayout>} />
          <Route path="/documents" element={<AppLayout><Documents /></AppLayout>} />
          <Route path="/sources" element={<AppLayout><Sources /></AppLayout>} />
          <Route path="/consent" element={<AppLayout><Consent /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
          <Route path="/docs/guardrails" element={<AppLayout><Guardrails /></AppLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
