import type { ContextSummary as ContextSummaryType } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Car, Route, Timer, Store, Plane, Users, Navigation } from "lucide-react";

interface ContextSummaryProps {
  context: ContextSummaryType;
  overallStatus: "good" | "caution" | "danger";
}

export function ContextSummaryPanel({ context }: ContextSummaryProps) {
  const formatHHMM = (hhmm: string) => {
    if (!hhmm || !hhmm.includes(":")) return hhmm;
    const [h, m] = hhmm.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const tz = context.userTimezone && context.userTimezone !== "Local" ? context.userTimezone : "";
  const tzLabel = tz ? ` ${tz}` : "";

  const isFlightMode = context.flightMode && context.flightMode !== "none";
  const isCatching = context.flightMode === "catching";
  const isPickup = context.flightMode === "pickup";

  const title = isCatching
    ? "Catching Your Flight"
    : isPickup
    ? "Airport Pickup"
    : "Your Trip at a Glance";

  const items: Array<{
    icon: typeof MapPin;
    label: string;
    value: string;
    subvalue?: string;
    color: string;
    bg: string;
  }> = [
    {
      icon: MapPin,
      label: isFlightMode ? "Airport" : "Destination",
      value: context.destination,
      subvalue: context.fullAddress || context.eventName,
      color: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-500/10 dark:bg-rose-500/15",
    },
    {
      icon: Clock,
      label: "You Leave At",
      value: `${formatHHMM(context.userDepartureTime)}${tzLabel}`,
      subvalue: isFlightMode ? "When you head to the airport" : "When you head out",
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
      label: "Drive to Airport",
      value: `${context.estimatedTravelMinutes} min`,
      subvalue: `You reach airport ~${formatHHMM(context.userArrivalTime)}${tzLabel}`,
      color: "text-violet-500 dark:text-violet-400",
      bg: "bg-violet-500/10 dark:bg-violet-500/15",
    },
  ];

  if (!isFlightMode) {
    items[3].label = "Travel Time";
    items[3].subvalue = `Arrive ~${formatHHMM(context.userArrivalTime)}${tzLabel}`;

    items.push({
      icon: Store,
      label: "Venue Hours",
      value: context.venueHours,
      subvalue: `Closes ${context.venueClosingTime}`,
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
    });
  }

  items.push({
    icon: Car,
    label: "Transport",
    value: context.transportMode.charAt(0).toUpperCase() + context.transportMode.slice(1),
    subvalue: undefined,
    color: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10 dark:bg-sky-500/15",
  });

  if (isCatching) {
    const flightLabel = [context.flightAirline, context.flightNumber ? `Flight ${context.flightNumber}` : ""].filter(Boolean).join(" ") || "Your Flight";
    items.push({
      icon: Plane,
      label: "Your Flight",
      value: flightLabel,
      subvalue: context.flightDestinationCity
        ? `To ${context.flightDestinationCity}${context.flightDepartureTime ? ` at ${formatHHMM(context.flightDepartureTime)}${tzLabel}` : ""}`
        : context.flightDepartureTime
        ? `Departs ${formatHHMM(context.flightDepartureTime)}${tzLabel}`
        : undefined,
      color: "text-indigo-500 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
    });
  } else if (isPickup) {
    const pickupLabel = [context.flightAirline, context.pickupFlightNumber ? `Flight ${context.pickupFlightNumber}` : ""].filter(Boolean).join(" ") || "Their Flight";
    items.push({
      icon: Users,
      label: "Their Flight",
      value: pickupLabel,
      subvalue: context.pickupArrivalTime
        ? `Lands at ${formatHHMM(context.pickupArrivalTime)}${tzLabel}`
        : undefined,
      color: "text-teal-500 dark:text-teal-400",
      bg: "bg-teal-500/10 dark:bg-teal-500/15",
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center justify-center w-8 h-8 rounded-md gradient-bg-subtle border border-primary/15">
            {isPickup ? <Users className="h-4 w-4 text-primary" /> : isFlightMode ? <Plane className="h-4 w-4 text-primary" /> : <Navigation className="h-4 w-4 text-primary" />}
          </div>
          <span>{title}</span>
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
