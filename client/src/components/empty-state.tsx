import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, Lightbulb, Shield, Plane, Zap } from "lucide-react";

export function EmptyState() {
  const features = [
    { icon: Clock, label: "Timing Analysis", desc: "Will you arrive on time?", color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10 dark:bg-blue-500/15" },
    { icon: Shield, label: "Risk Detection", desc: "Spot problems before they happen", color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 dark:bg-amber-500/15" },
    { icon: Lightbulb, label: "Smart Suggestions", desc: "Better routes and alternatives", color: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/10 dark:bg-violet-500/15" },
    { icon: MapPin, label: "Venue Awareness", desc: "Hours, closures, and crowds", color: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/10 dark:bg-purple-500/15" },
    { icon: Plane, label: "Flight Smart", desc: "Auto-detect airport trips", color: "text-sky-500 dark:text-sky-400", bg: "bg-sky-500/10 dark:bg-sky-500/15" },
    { icon: Zap, label: "Instant Analysis", desc: "AI-powered in seconds", color: "text-rose-500 dark:text-rose-400", bg: "bg-rose-500/10 dark:bg-rose-500/15" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="text-center py-6">
        <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full gradient-bg-subtle border border-primary/15 mb-4">
          <MapPin className="h-7 w-7 text-primary" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center">
            <Zap className="h-3 w-3 text-amber-500 dark:text-amber-400" />
          </div>
        </div>
        <h3 className="text-xl font-bold tracking-tight mb-1.5" data-testid="text-empty-title">
          Where are you headed?
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed" data-testid="text-empty-description">
          Tell me your destination and when you're leaving. I'll analyze timing, venue hours, traffic, and more to make sure your trip goes smoothly.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">What I can help with</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {features.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-2.5 p-3 rounded-md bg-muted/40"
                data-testid={`empty-feature-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-md ${item.bg} flex-shrink-0`}>
                  <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold block leading-tight">{item.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight block mt-0.5">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
