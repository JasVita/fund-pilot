import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: ReactNode;
  change?: string;                           // e.g. "+12.5%" or "-4.2%"
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  description?: string;
  dimmed?: boolean;
  right?: ReactNode; 
}

function KPICard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  description,
  dimmed = false,
  right,  
}: KPICardProps) {
  /* ─ colour logic (unchanged) ─ */
  const inferred =
    changeType ??
    (change?.trim().startsWith("-")
      ? "negative"
      : change?.trim().startsWith("+")
      ? "positive"
      : "neutral");

  const colour =
    inferred === "positive"
      ? "text-green-600"
      : inferred === "negative"
      ? "text-red-600"
      : "text-muted-foreground";

  /* -------------------------------------------------------- */
  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${dimmed ? "bg-muted/100" : ""}`}>
      <CardContent className="px-6">
        {/* <div className="flex items-start justify-between gap-4"> */}
        <div className="w-full flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4 flex-nowrap">
          
          <div className="space-y-1 w-full min-w-0">
            {/* title */}
            {/* <p className="text-sm font-medium text-muted-foreground">{title}</p> */}
            <div className="flex items-start gap-2">
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
            </div>

            {/* value */}
            <p className="text-2xl font-bold tracking-tight">{value}</p>

            {/* change */}
            {change && <p className={`text-sm font-medium ${colour}`}>{change}</p>}

            {/* description */}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {right && <div className="shrink-0 -mt-1 -mr-1">{right}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export { KPICard };
export default KPICard;
