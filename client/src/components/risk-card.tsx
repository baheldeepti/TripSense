import type { Risk } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertOctagon, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RiskCardProps {
  risks: Risk[];
}

const iconMap: Record<string, typeof AlertTriangle> = {
  warning: AlertTriangle,
  danger: AlertOctagon,
  info: Info,
};

const styleMap: Record<string, { bg: string; iconColor: string; titleColor: string; badgeVariant: string; label: string }> = {
  warning: {
    bg: "bg-amber-500/8 dark:bg-amber-500/10",
    iconColor: "text-amber-500 dark:text-amber-400",
    titleColor: "text-amber-800 dark:text-amber-300",
    badgeVariant: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    label: "Warning",
  },
  danger: {
    bg: "bg-red-500/8 dark:bg-red-500/10",
    iconColor: "text-red-500 dark:text-red-400",
    titleColor: "text-red-800 dark:text-red-300",
    badgeVariant: "bg-red-500/15 text-red-700 dark:text-red-300",
    label: "High Risk",
  },
  info: {
    bg: "bg-blue-500/8 dark:bg-blue-500/10",
    iconColor: "text-blue-500 dark:text-blue-400",
    titleColor: "text-blue-800 dark:text-blue-300",
    badgeVariant: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    label: "Info",
  },
};

const defaultStyle = styleMap.info;

export function RiskCard({ risks }: RiskCardProps) {
  if (risks.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-red-500/10 dark:bg-red-500/15">
            <ShieldAlert className="h-4 w-4 text-red-500 dark:text-red-400" />
          </div>
          <span>Risk Assessment</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">{risks.length} {risks.length === 1 ? "issue" : "issues"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {risks.map((risk, index) => {
          const Icon = iconMap[risk.type] || Info;
          const style = styleMap[risk.type] || defaultStyle;
          return (
            <div
              key={index}
              className={`flex gap-3 p-3.5 rounded-md ${style.bg}`}
              data-testid={`risk-item-${index}`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${
                risk.type === "danger" ? "bg-red-500/15 dark:bg-red-500/20" :
                risk.type === "warning" ? "bg-amber-500/15 dark:bg-amber-500/20" :
                "bg-blue-500/15 dark:bg-blue-500/20"
              }`}>
                <Icon className={`h-4 w-4 ${style.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className={`text-sm font-bold ${style.titleColor}`}>
                    {risk.title}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {risk.description}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
