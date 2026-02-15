import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { planRequestSchema, type PlanRequest } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MapPin, Calendar, Navigation, Loader2, Sparkles, LocateFixed, Clock, Plane, Users, X, ChevronDown, ChevronUp, Car, Train, Footprints, Bike, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FlightDialog, detectAirport } from "@/components/flight-dialog";
import { LocationPicker, type LocationResult } from "@/components/location-picker";

interface PlanFormProps {
  onSubmit: (data: PlanRequest) => void;
  isLoading: boolean;
}

export function PlanForm({ onSubmit, isLoading }: PlanFormProps) {
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [flightDialogOpen, setFlightDialogOpen] = useState(false);
  const [flightEditData, setFlightEditData] = useState<{flightMode: string; flightNumber?: string; flightAirline?: string; flightDestinationCity?: string; flightDepartureTime?: string; pickupFlightNumber?: string; pickupArrivalTime?: string} | undefined>(undefined);
  const [detectedAirport, setDetectedAirport] = useState("");
  const [showAddressDetails, setShowAddressDetails] = useState(false);
  const [validatingDestination, setValidatingDestination] = useState(false);
  const [destinationError, setDestinationError] = useState("");
  const [startLocationExternalValue, setStartLocationExternalValue] = useState("");
  const locationSelectedFromPicker = useRef(false);
  const lastCheckedDestination = useRef("");
  const { toast } = useToast();

  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const form = useForm<PlanRequest>({
    resolver: zodResolver(planRequestSchema),
    defaultValues: {
      destinationName: "",
      destinationAddress: "",
      destinationCity: "",
      destinationState: "",
      destinationPincode: "",
      eventName: "",
      departureDate: defaultDate,
      departureTime: defaultTime,
      currentLocation: "",
      transportMode: "driving",
      notes: "",
      flightMode: "none",
      flightNumber: "",
      flightAirline: "",
      flightDestinationCity: "",
      flightDepartureTime: "",
      pickupFlightNumber: "",
      pickupArrivalTime: "",
    },
  });

  const flightMode = form.watch("flightMode");
  const flightNumber = form.watch("flightNumber");
  const flightAirline = form.watch("flightAirline");
  const flightDestCity = form.watch("flightDestinationCity");
  const pickupFlightNum = form.watch("pickupFlightNumber");
  const notesValue = form.watch("notes");

  const handleDestinationBlur = useCallback((value: string) => {
    if (!value || value === lastCheckedDestination.current) return;
    lastCheckedDestination.current = value;

    const { isAirport, airportName } = detectAirport(value);
    if (isAirport && form.getValues("flightMode") === "none") {
      setDetectedAirport(airportName);
      setFlightEditData(undefined);
      setFlightDialogOpen(true);
    }
  }, [form]);

  const handleLocationSelect = useCallback((location: LocationResult) => {
    form.setValue("destinationName", location.name, { shouldValidate: true });
    form.setValue("destinationAddress", location.address);
    form.setValue("destinationCity", location.city);
    form.setValue("destinationState", location.state);
    form.setValue("destinationPincode", location.pincode);
    form.setValue("destinationCoords", { lat: location.lat, lng: location.lng });
    locationSelectedFromPicker.current = true;
    setDestinationError("");

    handleDestinationBlur(location.name);
  }, [form, handleDestinationBlur]);

  const handleLocationInputChange = useCallback((value: string) => {
    form.setValue("destinationName", value, { shouldValidate: false });
    locationSelectedFromPicker.current = false;
    setDestinationError("");
  }, [form]);

  const handleLocationClear = useCallback(() => {
    form.setValue("destinationName", "");
    form.setValue("destinationAddress", "");
    form.setValue("destinationCity", "");
    form.setValue("destinationState", "");
    form.setValue("destinationPincode", "");
    form.setValue("destinationCoords", undefined);
    locationSelectedFromPicker.current = false;
    lastCheckedDestination.current = "";
    setDestinationError("");
  }, [form]);

  const handleStartLocationSelect = useCallback((location: LocationResult) => {
    form.setValue("currentLocation", location.displayName || location.name);
    form.setValue("currentCoords", { lat: location.lat, lng: location.lng });
  }, [form]);

  const handleStartLocationInputChange = useCallback((value: string) => {
    form.setValue("currentLocation", value);
    form.setValue("currentCoords", undefined);
    setStartLocationExternalValue("");
  }, [form]);

  const handleStartLocationClear = useCallback(() => {
    form.setValue("currentLocation", "");
    form.setValue("currentCoords", undefined);
    setStartLocationExternalValue("");
  }, [form]);

  const handleFlightConfirm = useCallback((data: {
    flightMode: "none" | "catching" | "pickup";
    flightNumber?: string;
    flightAirline?: string;
    flightDestinationCity?: string;
    flightDepartureTime?: string;
    pickupFlightNumber?: string;
    pickupArrivalTime?: string;
  }) => {
    form.setValue("flightMode", data.flightMode);
    if (data.flightMode === "catching") {
      form.setValue("flightNumber", data.flightNumber || "");
      form.setValue("flightAirline", data.flightAirline || "");
      form.setValue("flightDestinationCity", data.flightDestinationCity || "");
      form.setValue("flightDepartureTime", data.flightDepartureTime || "");
    } else if (data.flightMode === "pickup") {
      form.setValue("pickupFlightNumber", data.pickupFlightNumber || "");
      form.setValue("pickupArrivalTime", data.pickupArrivalTime || "");
    }
    setFlightDialogOpen(false);

    if (data.flightMode === "catching") {
      toast({
        title: "Flight tracking on",
        description: `I'll check ${data.flightNumber || data.flightDestinationCity || "your flight"} status and make sure you get there on time.`,
      });
    } else if (data.flightMode === "pickup") {
      toast({
        title: "Pickup mode on",
        description: `I'll track ${data.pickupFlightNumber || "their flight"} and help you time the pickup perfectly.`,
      });
    }
  }, [form, toast]);

  const clearFlightData = useCallback(() => {
    form.setValue("flightMode", "none");
    form.setValue("flightNumber", "");
    form.setValue("flightAirline", "");
    form.setValue("flightDestinationCity", "");
    form.setValue("flightDepartureTime", "");
    form.setValue("pickupFlightNumber", "");
    form.setValue("pickupArrivalTime", "");
    lastCheckedDestination.current = "";
  }, [form]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Not Supported",
        description: "Location detection is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        form.setValue("currentCoords", { lat: latitude, lng: longitude });

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "TripGuard/1.0" } }
          );
          const data = await response.json();
          if (data.display_name) {
            const parts = data.display_name.split(",").slice(0, 3).map((s: string) => s.trim());
            const locationStr = parts.join(", ");
            form.setValue("currentLocation", locationStr);
            setStartLocationExternalValue("");
            setTimeout(() => setStartLocationExternalValue(locationStr), 0);
          } else {
            const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            form.setValue("currentLocation", fallback);
            setStartLocationExternalValue("");
            setTimeout(() => setStartLocationExternalValue(fallback), 0);
          }
        } catch {
          const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          form.setValue("currentLocation", fallback);
          setStartLocationExternalValue("");
          setTimeout(() => setStartLocationExternalValue(fallback), 0);
        }

        setDetectingLocation(false);
        toast({
          title: "Location Detected",
          description: "Your current location has been set.",
        });
      },
      (error) => {
        setDetectingLocation(false);
        let msg = "Could not detect your location.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location access was denied. Please allow it in your browser settings.";
        }
        toast({
          title: "Location Error",
          description: msg,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validateAndSubmit = useCallback(async (data: PlanRequest) => {
    const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
      .formatToParts(new Date())
      .find(p => p.type === "timeZoneName")?.value || "";
    data.userTimezone = tzAbbr;

    if (locationSelectedFromPicker.current) {
      onSubmit(data);
      return;
    }

    const name = data.destinationName?.trim();
    if (!name) return;

    setValidatingDestination(true);
    setDestinationError("");

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&addressdetails=1&limit=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "TripGuard/1.0" } }
      );
      const results = await res.json();

      if (results.length > 0) {
        const addr = results[0].address || {};
        const road = [addr.house_number, addr.road].filter(Boolean).join(" ");
        form.setValue("destinationAddress", road || data.destinationAddress || "");
        form.setValue("destinationCity", addr.city || addr.town || addr.village || data.destinationCity || "");
        form.setValue("destinationState", addr.state || data.destinationState || "");
        form.setValue("destinationPincode", addr.postcode || data.destinationPincode || "");
        form.setValue("destinationCoords", {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
        });
        locationSelectedFromPicker.current = true;
        handleDestinationBlur(name);
        const vals = form.getValues();
        vals.userTimezone = tzAbbr;
        onSubmit(vals);
      } else {
        setDestinationError("I couldn't find that place. Please pick a location from the search suggestions or the map.");
      }
    } catch {
      setDestinationError("Couldn't verify this location. Please pick one from the search suggestions or the map.");
    } finally {
      setValidatingDestination(false);
    }
  }, [form, onSubmit, handleDestinationBlur]);

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2.5 flex-wrap text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-md gradient-bg-header">
              <Navigation className="h-4 w-4 text-white" />
            </div>
            <span>Plan Your Trip</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tell me where you're going and I'll make sure you get there smoothly.
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(validateAndSubmit)} className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Where you are</p>
              </div>

              <FormField
                control={form.control}
                name="currentLocation"
                render={() => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <FormLabel className="flex items-center gap-1.5">
                        <LocateFixed className="h-3.5 w-3.5 text-muted-foreground" />
                        Starting From
                      </FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDetectLocation}
                        disabled={detectingLocation}
                        data-testid="button-detect-location"
                      >
                        {detectingLocation ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <LocateFixed className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {detectingLocation ? "Detecting..." : "Use my location"}
                      </Button>
                    </div>
                    <FormControl>
                      <LocationPicker
                        onLocationSelect={handleStartLocationSelect}
                        onInputChange={handleStartLocationInputChange}
                        onClear={handleStartLocationClear}
                        initialValue={form.getValues("currentLocation")}
                        externalValue={startLocationExternalValue}
                        placeholder="Search for your starting location..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Where you're going</p>
              </div>

              <FormField
                control={form.control}
                name="destinationName"
                render={() => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      Pick a Place
                    </FormLabel>
                    <FormControl>
                      <LocationPicker
                        onLocationSelect={handleLocationSelect}
                        onInputChange={handleLocationInputChange}
                        onClear={handleLocationClear}
                        initialValue={form.getValues("destinationName")}
                      />
                    </FormControl>
                    <FormMessage />
                    {destinationError && (
                      <p className="text-sm text-destructive mt-1" data-testid="text-destination-error">{destinationError}</p>
                    )}
                  </FormItem>
                )}
              />

              {flightMode && flightMode !== "none" && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2" data-testid="flight-context-banner">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {flightMode === "catching" ? (
                        <Plane className="h-4 w-4 text-primary" />
                      ) : (
                        <Users className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-sm font-medium">
                        {flightMode === "catching" ? "Catching a Flight" : "Picking Someone Up"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const current = form.getValues();
                          setFlightEditData({
                            flightMode: current.flightMode || "none",
                            flightNumber: current.flightNumber || undefined,
                            flightAirline: current.flightAirline || undefined,
                            flightDestinationCity: current.flightDestinationCity || undefined,
                            flightDepartureTime: current.flightDepartureTime || undefined,
                            pickupFlightNumber: current.pickupFlightNumber || undefined,
                            pickupArrivalTime: current.pickupArrivalTime || undefined,
                          });
                          setFlightDialogOpen(true);
                        }}
                        data-testid="button-edit-flight"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearFlightData}
                        data-testid="button-clear-flight"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {flightMode === "catching" && (
                      <>
                        {flightAirline && <span><span className="font-medium text-foreground">{flightAirline}</span></span>}
                        {flightAirline && flightNumber && <span> </span>}
                        {flightNumber && <span>Flight <span className="font-medium text-foreground">{flightNumber}</span></span>}
                        {(flightAirline || flightNumber) && flightDestCity && <span> · </span>}
                        {flightDestCity && <span>To <span className="font-medium text-foreground">{flightDestCity}</span></span>}
                        {form.watch("flightDepartureTime") && (
                          <span> · Departs <span className="font-medium text-foreground">{form.watch("flightDepartureTime")}</span></span>
                        )}
                        {!flightNumber && !flightDestCity && !flightAirline && <span>I'll check your flight status and timing</span>}
                      </>
                    )}
                    {flightMode === "pickup" && (
                      <>
                        {flightAirline && <span><span className="font-medium text-foreground">{flightAirline}</span> </span>}
                        {pickupFlightNum && <span>Flight <span className="font-medium text-foreground">{pickupFlightNum}</span></span>}
                        {form.watch("pickupArrivalTime") && (
                          <span> · Lands <span className="font-medium text-foreground">{form.watch("pickupArrivalTime")}</span></span>
                        )}
                        {!pickupFlightNum && !flightAirline && <span>I'll help you time the pickup perfectly</span>}
                      </>
                    )}
                  </p>
                </div>
              )}

              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAddressDetails(!showAddressDetails)}
                data-testid="button-toggle-address"
              >
                {showAddressDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showAddressDetails ? "Hide address details" : "Edit address details"}
              </button>

              {showAddressDetails && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="destinationAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 123 Main Street"
                            data-testid="input-destination-address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="destinationCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="City"
                              data-testid="input-destination-city"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destinationState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="State"
                              data-testid="input-destination-state"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destinationPincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pincode</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. 110001"
                              data-testid="input-destination-pincode"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="eventName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Event / Purpose (optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Book signing, Gallery opening..."
                        data-testid="input-event-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">When you're leaving</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="departureDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        Departure Date
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-departure-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departureTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Departure Time
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          data-testid="input-departure-time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="transportMode"
                render={({ field }) => {
                  const modes = [
                    { value: "driving", label: "Drive", icon: Car },
                    { value: "transit", label: "Transit", icon: Train },
                    { value: "walking", label: "Walk", icon: Footprints },
                    { value: "cycling", label: "Cycle", icon: Bike },
                  ];
                  return (
                    <FormItem>
                      <FormLabel>How are you getting there?</FormLabel>
                      <div className="grid grid-cols-4 gap-2">
                        {modes.map((mode) => {
                          const isSelected = field.value === mode.value;
                          return (
                            <Button
                              key={mode.value}
                              type="button"
                              variant="outline"
                              onClick={() => field.onChange(mode.value)}
                              className={`flex flex-col items-center gap-1 toggle-elevate ${
                                isSelected
                                  ? "toggle-elevated border-primary bg-primary/8 dark:bg-primary/12"
                                  : ""
                              }`}
                              data-testid={`transport-${mode.value}`}
                            >
                              <mode.icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                                {mode.label}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel>Additional Notes (optional)</FormLabel>
                      <span className={`text-xs ${(notesValue?.length || 0) > 450 ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-notes-counter">
                        {notesValue?.length || 0}/500
                      </span>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Any special requirements or preferences..."
                        className="resize-none"
                        rows={2}
                        maxLength={500}
                        data-testid="input-notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full gradient-bg-header border-0 text-white font-semibold"
                disabled={isLoading || validatingDestination}
                data-testid="button-analyze"
              >
                {validatingDestination ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying Location...
                  </>
                ) : isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing Your Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze My Plan
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <FlightDialog
        open={flightDialogOpen}
        airportName={detectedAirport}
        onClose={() => { setFlightDialogOpen(false); setFlightEditData(undefined); }}
        onConfirm={handleFlightConfirm}
        initialData={flightEditData as any}
      />
    </>
  );
}
