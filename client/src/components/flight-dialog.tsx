import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Users, ArrowRight } from "lucide-react";

const KNOWN_IATA_CODES = new Set([
  "ATL", "PEK", "LAX", "DXB", "HND", "ORD", "LHR", "PVG", "CDG", "DFW",
  "AMS", "FRA", "IST", "CAN", "JFK", "SIN", "DEN", "ICN", "BKK", "SFO",
  "DEL", "CGK", "KUL", "MAD", "CTU", "LAS", "BCN", "MIA", "YYZ", "MUC",
  "SYD", "MEL", "FCO", "NRT", "EWR", "SEA", "MSP", "DTW", "PHL", "BOS",
  "CLT", "MCO", "IAH", "PHX", "SAN", "TPA", "BWI", "AUS", "BNA", "STL",
  "IND", "CMH", "SLC", "PDX", "MCI", "RDU", "SMF", "CLE", "MKE", "OAK",
  "SJC", "RSW", "SAT", "PIT", "BUF", "ABQ", "ONT", "TUS", "OMA", "RNO",
  "HNL", "OGG", "ANC", "GEG", "BOI", "LGA", "DCA", "IAD",
]);

const AIRPORT_KEYWORDS = [
  "airport", "airfield", "aerodrome", "terminal",
  "international airport", "intl airport", "intl",
  "logan", "jfk", "lax", "sfo", "ord", "heathrow",
  "dulles", "reagan", "midway", "ohare", "o'hare",
  "newark", "laguardia", "la guardia", "hartsfield",
  "sky harbor", "love field", "hobby", "pearson",
  "changi", "schiphol", "narita", "haneda", "incheon",
  "gatwick", "stansted", "charles de gaulle", "ben gurion",
];

export function detectAirport(destinationName: string): { isAirport: boolean; airportName: string } {
  const lower = destinationName.toLowerCase().trim();
  if (!lower || lower.length < 2) return { isAirport: false, airportName: "" };

  for (const keyword of AIRPORT_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { isAirport: true, airportName: destinationName.trim() };
    }
  }

  const tokens = destinationName.trim().split(/[\s,]+/);
  for (const token of tokens) {
    const upper = token.toUpperCase().replace(/[^A-Z]/g, "");
    if (upper.length === 3 && KNOWN_IATA_CODES.has(upper)) {
      return { isAirport: true, airportName: destinationName.trim() };
    }
  }

  return { isAirport: false, airportName: "" };
}

type FlightMode = "none" | "catching" | "pickup";
type DialogStep = "ask_intent" | "catching_details" | "pickup_details";

interface FlightData {
  flightMode: FlightMode;
  flightNumber?: string;
  flightAirline?: string;
  flightDestinationCity?: string;
  flightDepartureTime?: string;
  pickupFlightNumber?: string;
  pickupArrivalTime?: string;
}

interface FlightDialogProps {
  open: boolean;
  airportName: string;
  onClose: () => void;
  onConfirm: (data: FlightData) => void;
}

export function FlightDialog({ open, airportName, onClose, onConfirm }: FlightDialogProps) {
  const [step, setStep] = useState<DialogStep>("ask_intent");
  const [flightNumber, setFlightNumber] = useState("");
  const [airline, setAirline] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [flightTime, setFlightTime] = useState("");
  const [pickupFlight, setPickupFlight] = useState("");
  const [pickupAirline, setPickupAirline] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  useEffect(() => {
    if (open) {
      setStep("ask_intent");
      setFlightNumber("");
      setAirline("");
      setDestinationCity("");
      setFlightTime("");
      setPickupFlight("");
      setPickupAirline("");
      setPickupTime("");
    }
  }, [open]);

  const handleCatching = useCallback(() => setStep("catching_details"), []);
  const handlePickup = useCallback(() => setStep("pickup_details"), []);

  const handleCatchingSubmit = useCallback(() => {
    onConfirm({
      flightMode: "catching",
      flightNumber: flightNumber || undefined,
      flightAirline: airline || undefined,
      flightDestinationCity: destinationCity || undefined,
      flightDepartureTime: flightTime || undefined,
    });
  }, [flightNumber, airline, destinationCity, flightTime, onConfirm]);

  const handlePickupSubmit = useCallback(() => {
    onConfirm({
      flightMode: "pickup",
      pickupFlightNumber: pickupFlight || undefined,
      flightAirline: pickupAirline || undefined,
      pickupArrivalTime: pickupTime || undefined,
    });
  }, [pickupFlight, pickupAirline, pickupTime, onConfirm]);

  const handleSkip = useCallback(() => {
    onConfirm({ flightMode: "none" });
  }, [onConfirm]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-flight-detection">
        {step === "ask_intent" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <Plane className="h-5 w-5 text-primary" />
                Airport Detected
              </DialogTitle>
              <DialogDescription>
                I see you're heading to <span className="font-medium text-foreground">{airportName}</span>. Are you catching a flight or picking someone up?
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                className="justify-start gap-3"
                onClick={handleCatching}
                data-testid="button-flight-catching"
              >
                <Plane className="h-4 w-4" />
                I'm catching a flight
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-3"
                onClick={handlePickup}
                data-testid="button-flight-pickup"
              >
                <Users className="h-4 w-4" />
                I'm picking someone up
              </Button>
              <Button
                variant="ghost"
                className="justify-start gap-3 text-muted-foreground"
                onClick={handleSkip}
                data-testid="button-flight-skip"
              >
                Neither — just visiting the area
              </Button>
            </div>
          </>
        )}

        {step === "catching_details" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <Plane className="h-5 w-5 text-primary" />
                Your Flight Details
              </DialogTitle>
              <DialogDescription>
                Share your flight number or destination so I can optimize your departure timing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="flight-airline">Airline</Label>
                <Input
                  id="flight-airline"
                  placeholder="e.g. United, Delta, American, Southwest"
                  value={airline}
                  onChange={(e) => setAirline(e.target.value)}
                  data-testid="input-flight-airline"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flight-number">Flight Number</Label>
                <Input
                  id="flight-number"
                  placeholder="e.g. UA 1234, DL 405"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  data-testid="input-flight-number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flight-dest">Destination City</Label>
                <Input
                  id="flight-dest"
                  placeholder="e.g. San Francisco, Los Angeles"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  data-testid="input-flight-destination"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flight-time">Flight Departure Time</Label>
                <Input
                  id="flight-time"
                  type="time"
                  value={flightTime}
                  onChange={(e) => setFlightTime(e.target.value)}
                  data-testid="input-flight-time"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep("ask_intent")} data-testid="button-flight-back">
                Back
              </Button>
              <Button
                onClick={handleCatchingSubmit}
                disabled={!flightNumber && !destinationCity}
                data-testid="button-flight-confirm"
              >
                Confirm
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pickup_details" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <Users className="h-5 w-5 text-primary" />
                Pickup Details
              </DialogTitle>
              <DialogDescription>
                Share the arriving flight details so I can help you time the pickup perfectly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="pickup-airline">Airline</Label>
                <Input
                  id="pickup-airline"
                  placeholder="e.g. United, Delta, American, Southwest"
                  value={pickupAirline}
                  onChange={(e) => setPickupAirline(e.target.value)}
                  data-testid="input-pickup-airline"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup-flight">Their Flight Number</Label>
                <Input
                  id="pickup-flight"
                  placeholder="e.g. AA 789, UA 302"
                  value={pickupFlight}
                  onChange={(e) => setPickupFlight(e.target.value)}
                  data-testid="input-pickup-flight"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup-time">Expected Arrival Time</Label>
                <Input
                  id="pickup-time"
                  type="time"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  data-testid="input-pickup-time"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep("ask_intent")} data-testid="button-pickup-back">
                Back
              </Button>
              <Button
                onClick={handlePickupSubmit}
                disabled={!pickupFlight && !pickupTime}
                data-testid="button-pickup-confirm"
              >
                Confirm
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
