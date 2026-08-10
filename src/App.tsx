import React, { Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Quantum Laboratory Runtime Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", backgroundColor: "#f5f3ee", color: "#0d0d0d", fontFamily: "monospace", minHeight: "100vh" }}>
          <h2 style={{ color: "#ef4444" }}>QUANTUM LABORATORY DIAGNOSTIC EXCEPTION</h2>
          <p style={{ color: "#6f6759" }}>A runtime exception was intercepted by the laboratory error boundary:</p>
          <pre style={{ backgroundColor: "#e8e4dd", padding: "16px", borderRadius: "8px", overflow: "auto", color: "#7f1d1d" }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "16px", padding: "10px 20px", backgroundColor: "#0ea5b7", color: "#f5f3ee", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
          >
            RELOAD LABORATORY WORKSPACE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
