import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Index from "./pages/Index";
import Timeline from "./pages/Timeline";
import Documents from "./pages/Documents";
import Sources from "./pages/Sources";
import Consent from "./pages/Consent";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Guardrails from "./pages/docs/Guardrails";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/consent" element={<Consent />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/docs/guardrails" element={<Guardrails />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
