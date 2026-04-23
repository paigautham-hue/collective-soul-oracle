import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProjectDetail from "./pages/ProjectDetail";
import Wizard from "./pages/Wizard";
import GraphExplorer from "./pages/GraphExplorer";
import SimulationMonitor from "./pages/SimulationMonitor";
import ReportReader from "./pages/ReportReader";
import AgentChat from "./pages/AgentChat";
import AdminDashboard from "./pages/AdminDashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/project/:id" component={ProjectDetail} />
      <Route path="/project/:id/wizard" component={Wizard} />
      <Route path="/project/:id/graph" component={GraphExplorer} />
      <Route path="/project/:id/simulation/:runId" component={SimulationMonitor} />
      <Route path="/project/:id/report/:reportId" component={ReportReader} />
      <Route path="/project/:id/chat" component={AgentChat} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.12 0.02 265 / 0.90)",
                backdropFilter: "blur(16px)",
                border: "1px solid oklch(0.35 0.05 265 / 0.35)",
                color: "oklch(0.97 0.005 265)",
                fontFamily: "Cormorant Garamond, serif",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
