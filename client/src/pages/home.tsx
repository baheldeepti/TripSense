import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PlanRequest, AnalysisResult } from "@shared/schema";
import { PlanForm } from "@/components/plan-form";
import { ContextSummaryPanel } from "@/components/context-summary";
import { RiskCard } from "@/components/risk-card";
import { SuggestionsCard } from "@/components/suggestions-card";
import { ReasoningCard } from "@/components/reasoning-card";
import { EmptyState } from "@/components/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Sparkles } from "lucide-react";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (data: PlanRequest) => {
      const res = await apiRequest("POST", "/api/agent/analyze-plan", data);
      return (await res.json()) as AnalysisResult;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze your plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: PlanRequest) => {
    analyzeMutation.mutate(data);
  };

  const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; badgeLabel: string; gradient: string }> = {
    good: {
      icon: CheckCircle2,
      label: "You're all set!",
      badgeLabel: "Good to Go",
      gradient: "from-emerald-500/15 via-emerald-500/8 to-teal-500/5 dark:from-emerald-500/20 dark:via-emerald-500/10 dark:to-teal-500/5 border-emerald-500/25",
    },
    caution: {
      icon: AlertTriangle,
      label: "A few things to watch",
      badgeLabel: "Caution",
      gradient: "from-amber-500/15 via-amber-500/8 to-orange-500/5 dark:from-amber-500/20 dark:via-amber-500/10 dark:to-orange-500/5 border-amber-500/25",
    },
    danger: {
      icon: XCircle,
      label: "Needs your attention",
      badgeLabel: "High Risk",
      gradient: "from-red-500/15 via-red-500/8 to-rose-500/5 dark:from-red-500/20 dark:via-red-500/10 dark:to-rose-500/5 border-red-500/25",
    },
  };

  const statusTextColor: Record<string, string> = {
    good: "text-emerald-700 dark:text-emerald-400",
    caution: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10" data-testid="img-logo">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <defs>
                  <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="hsl(25, 95%, 55%)" />
                    <stop offset="50%" stopColor="hsl(350, 80%, 55%)" />
                    <stop offset="100%" stopColor="hsl(262, 83%, 58%)" />
                  </linearGradient>
                  <linearGradient id="pin-inner" x1="14" y1="8" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="hsl(25, 95%, 60%)" />
                    <stop offset="100%" stopColor="hsl(262, 83%, 62%)" />
                  </linearGradient>
                </defs>
                <circle cx="20" cy="18" r="14" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeOpacity="0.2" fill="none" />
                <circle cx="20" cy="18" r="10" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
                <path d="M20 6C14.48 6 10 10.48 10 16c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z" fill="url(#pin-inner)" />
                <circle cx="20" cy="16" r="4" fill="white" fillOpacity="0.9" />
                <circle cx="20" cy="16" r="1.8" fill="url(#logo-gradient)" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight tracking-tight" data-testid="text-app-title">
                <span className="gradient-text">TripSense</span>
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Smart trip intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:flex gap-1 text-[10px]">
              <Sparkles className="h-3 w-3" />
              AI-Powered
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-20">
              <PlanForm onSubmit={handleSubmit} isLoading={analyzeMutation.isPending} />
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {analyzeMutation.isPending && <LoadingSkeleton />}

            {!analyzeMutation.isPending && result && (
              <>
                {(() => {
                  const config = statusConfig[result.overallStatus] || statusConfig.caution;
                  const textColor = statusTextColor[result.overallStatus] || statusTextColor.caution;
                  const StatusIcon = config.icon;
                  return (
                    <div
                      className={`flex items-center gap-3 p-4 rounded-md border bg-gradient-to-r ${config.gradient} animate-scale-in`}
                      data-testid="status-banner"
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        result.overallStatus === "good" ? "bg-emerald-500/15 dark:bg-emerald-500/20" :
                        result.overallStatus === "danger" ? "bg-red-500/15 dark:bg-red-500/20" :
                        "bg-amber-500/15 dark:bg-amber-500/20"
                      }`}>
                        <StatusIcon className={`h-5 w-5 ${textColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${textColor}`}>{config.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{result.statusMessage}</p>
                      </div>
                      <Badge variant="secondary" data-testid="badge-overall-status">
                        {config.badgeLabel}
                      </Badge>
                    </div>
                  );
                })()}
                <div className="animate-fade-in-up" style={{ animationDelay: "0.1s", opacity: 0 }}>
                  <ContextSummaryPanel
                    context={result.context}
                    overallStatus={result.overallStatus}
                  />
                </div>
                <div className="animate-fade-in-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
                  <RiskCard risks={result.risks} />
                </div>
                <div className="animate-fade-in-up" style={{ animationDelay: "0.3s", opacity: 0 }}>
                  <SuggestionsCard suggestions={result.suggestions} />
                </div>
                <div className="animate-fade-in-up" style={{ animationDelay: "0.4s", opacity: 0 }}>
                  <ReasoningCard
                    reasoning={result.reasoning}
                    statusMessage={result.statusMessage}
                    overallStatus={result.overallStatus}
                  />
                </div>
              </>
            )}

            {!analyzeMutation.isPending && !result && <EmptyState />}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-md gradient-bg-subtle border border-primary/10 animate-pulse-soft">
        <div className="w-10 h-10 rounded-full bg-primary/10" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-md bg-muted/40 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-5 w-36" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-3 rounded-md bg-muted/30 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
