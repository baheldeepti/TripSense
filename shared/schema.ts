import { z } from "zod";

export const planRequestSchema = z.object({
  destinationName: z.string().trim().min(1, "Destination name is required").max(200, "Destination name is too long"),
  destinationAddress: z.string().max(300, "Address is too long").optional().transform(s => s?.trim()),
  destinationCity: z.string().max(100, "City name is too long").optional().transform(s => s?.trim()),
  destinationState: z.string().max(100, "State name is too long").optional().transform(s => s?.trim()),
  destinationPincode: z.string().optional().transform(s => s?.trim()).refine(
    (val) => !val || /^[A-Za-z0-9\s\-]{3,10}$/.test(val),
    { message: "Enter a valid postal/zip code (3-10 characters)" }
  ),
  eventName: z.string().max(200, "Event name is too long").optional().transform(s => s?.trim()),
  departureDate: z.string().min(1, "Departure date is required").refine(
    (val) => /^\d{4}-\d{2}-\d{2}$/.test(val),
    { message: "Enter a valid date" }
  ),
  departureTime: z.string().min(1, "Departure time is required").refine(
    (val) => /^\d{2}:\d{2}$/.test(val),
    { message: "Enter a valid time" }
  ),
  currentLocation: z.string().max(300, "Location is too long").optional().default("Current Location").transform(s => s?.trim()),
  destinationCoords: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  currentCoords: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  transportMode: z.enum(["driving", "transit", "walking", "cycling"]).default("driving"),
  notes: z.string().max(500, "Notes are too long (max 500 characters)").optional().transform(s => s?.trim()),
  flightMode: z.enum(["none", "catching", "pickup"]).optional().default("none"),
  flightNumber: z.string().max(20).optional().transform(s => s?.trim()),
  flightAirline: z.string().max(50).optional().transform(s => s?.trim()),
  flightDestinationCity: z.string().max(100).optional().transform(s => s?.trim()),
  flightDepartureTime: z.string().optional(),
  pickupFlightNumber: z.string().max(20).optional().transform(s => s?.trim()),
  pickupArrivalTime: z.string().optional(),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;

export interface ContextSummary {
  destination: string;
  fullAddress?: string;
  eventName?: string;
  departureTime: string;
  currentTime: string;
  estimatedTravelMinutes: number;
  estimatedArrivalTime: string;
  venueHours: string;
  venueClosingTime: string;
  transportMode: string;
  distanceKm: number;
  distanceMiles: number;
  flightMode?: "none" | "catching" | "pickup";
  flightNumber?: string;
  flightAirline?: string;
  flightDestinationCity?: string;
  flightDepartureTime?: string;
  pickupFlightNumber?: string;
  pickupArrivalTime?: string;
}

export interface Risk {
  type: "warning" | "danger" | "info";
  title: string;
  description: string;
}

export interface Suggestion {
  type: "timing" | "alternative" | "tip";
  title: string;
  description: string;
}

export interface AnalysisResult {
  context: ContextSummary;
  risks: Risk[];
  suggestions: Suggestion[];
  reasoning: string;
  overallStatus: "good" | "caution" | "danger";
  statusMessage: string;
}

export type InsertUser = { username: string; password: string };
export type User = { id: string; username: string; password: string };
