import type { ContextSummary as ContextSummaryType } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Car, Route, Timer, Store, Plane, Users, Navigation } from "lucide-react";

interface ContextSummaryProps {
  context: ContextSummaryType;
  overallStatus: "good" | "caution" | "danger";
}

export function ContextSummaryPanel({ context }: ContextSummaryProps) {
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeStr;
    }
  };

  const items = [
    {
      icon: MapPin,
      label: "Destination",
      value: context.destination,
      subvalue: context.fullAddress || context.eventName,
      color: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-500/10 dark:bg-rose-500/15",
    },
    {
      icon: Clock,
      label: "Departure",
      value: formatTime(context.departureTime),
      color: "text-blue-500 dark:text-blue-400",
      bg: "bg-blue-500/10 dark:bg-blue-500/15",
    },
    {
      icon: Route,
      label: "Distance",
      value: `${context.distanceKm} km / ${context.distanceMiles} mi`,
      subvalue: `via ${context.transportMode}`,
      color: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    },
    {
      icon: Timer,
      label: "Travel Time",
      value: `${context.estimatedTravelMinutes} min`,
      subvalue: `Arrive ~${formatTime(context.estimatedArrivalTime)}`,
      color: "text-violet-500 dark:text-violet-400",
      bg: "bg-violet-500/10 dark:bg-violet-500/15",
    },
    {
      icon: Store,
      label: "Venue Hours",
      value: context.venueHours,
      subvalue: `Closes ${context.venueClosingTime}`,
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
    },
    {
      icon: Car,
      label: "Transport",
      value: context.transportMode.charAt(0).toUpperCase() + context.transportMode.slice(1),
      color: "text-sky-500 dark:text-sky-400",
      bg: "bg-sky-500/10 dark:bg-sky-500/15",
    },
  ];

  if (context.flightMode === "catching") {
    items.push({
      icon: Plane,
      label: "Flight",
      value: context.flightNumber || "Catching flight",
      subvalue: context.flightDestinationCity
        ? `To ${context.flightDestinationCity}${context.flightDepartureTime ? ` at ${context.flightDepartureTime}` : ""}`
        : context.flightDepartureTime ? `Departs ${context.flightDepartureTime}` : undefined,
      color: "text-indigo-500 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
    });
  } else if (context.flightMode === "pickup") {
    items.push({
      icon: Users,
      label: "Pickup",
      value: context.pickupFlightNumber || "Airport pickup",
      subvalue: context.pickupArrivalTime ? `Arrives ${context.pickupArrivalTime}` : undefined,
      color: "text-teal-500 dark:text-teal-400",
      bg: "bg-teal-500/10 dark:bg-teal-500/15",
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center justify-center w-8 h-8 rounded-md gradient-bg-subtle border border-primary/15">
            <Navigation className="h-4 w-4 text-primary" />
          </div>
          <span>Your Trip at a Glance</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-1.5 p-3 rounded-md bg-muted/40"
              data-testid={`context-${item.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className="flex items-center gap-1.5">
                <div className={`flex items-center justify-center w-5 h-5 rounded ${item.bg}`}>
                  <item.icon className={`h-3 w-3 ${item.color}`} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-sm font-bold truncate leading-tight">{item.value}</span>
              {item.subvalue && (
                <span className="text-[11px] text-muted-foreground truncate leading-tight">
                  {item.subvalue}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
