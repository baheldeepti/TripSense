import type { Suggestion } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Clock, MapPin, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SuggestionsCardProps {
  suggestions: Suggestion[];
}

export function SuggestionsCard({ suggestions }: SuggestionsCardProps) {
  if (suggestions.length === 0) return null;

  const iconMap: Record<string, typeof Clock> = {
    timing: Clock,
    alternative: MapPin,
    tip: Zap,
  };

  const colorMap: Record<string, { iconColor: string; bg: string }> = {
    timing: { iconColor: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10 dark:bg-blue-500/15" },
    alternative: { iconColor: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-500/15" },
    tip: { iconColor: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/10 dark:bg-violet-500/15" },
  };

  const defaultColor = colorMap.tip;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-500/10 dark:bg-amber-500/15">
            <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </div>
          <span>Tips for You</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">{suggestions.length} tips</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {suggestions.map((suggestion, index) => {
          const Icon = iconMap[suggestion.type] || Zap;
          const colors = colorMap[suggestion.type] || defaultColor;
          return (
            <div
              key={index}
              className="flex gap-3 p-3.5 rounded-md bg-muted/40 hover-elevate"
              data-testid={`suggestion-item-${index}`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${colors.bg}`}>
                <Icon className={`h-4 w-4 ${colors.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold mb-0.5">
                  {suggestion.title}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {suggestion.description}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
