import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;                           // e.g. "+12.5%" or "-4.2%"
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  description?: string;
}

function KPICard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  description,
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
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardContent className="px-6">
        <div className="flex items-start gap-2">
          
          <div className="space-y-1">
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
        </div>
      </CardContent>
    </Card>
  );
}

export { KPICard };
export default KPICard;
