import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Quote } from "lucide-react";

interface ReasoningCardProps {
  reasoning: string;
  statusMessage: string;
  overallStatus: "good" | "caution" | "danger";
}

export function ReasoningCard({ reasoning, statusMessage, overallStatus }: ReasoningCardProps) {
  const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
    good: { bg: "bg-emerald-500/10 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/20" },
    caution: { bg: "bg-amber-500/10 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/20" },
    danger: { bg: "bg-red-500/10 dark:bg-red-500/15", text: "text-red-700 dark:text-red-400", border: "border-red-500/20" },
  };

  const style = statusStyles[overallStatus] || statusStyles.caution;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-violet-500/10 dark:bg-violet-500/15">
            <Brain className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          </div>
          <span>What I Considered</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`p-3.5 rounded-md border text-sm font-semibold ${style.bg} ${style.text} ${style.border}`}
          data-testid="text-status-message"
        >
          {statusMessage}
        </div>
        <div className="flex gap-2.5 p-3.5 rounded-md bg-muted/40">
          <Quote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-reasoning">
            {reasoning}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
