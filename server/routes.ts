import type { Express } from "express";
import { createServer, type Server } from "http";
import { planRequestSchema } from "@shared/schema";
import type { AnalysisResult, ContextSummary, Risk, Suggestion, PlanRequest } from "@shared/schema";
import { log } from "./index";
import { cacheGet, cacheSet, sessionGet, sessionSet, agentStateGet, agentStateSet, isRedisAvailable } from "./redis";
import crypto from "crypto";

const TINYFISH_API_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

function buildFullAddress(plan: PlanRequest): string {
  const parts = [plan.destinationAddress, plan.destinationCity, plan.destinationState, plan.destinationPincode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
}

function buildDepartureISO(plan: PlanRequest): string {
  return new Date(`${plan.departureDate}T${plan.departureTime}`).toISOString();
}

function buildCacheKey(plan: PlanRequest): string {
  const flightPart = plan.flightMode && plan.flightMode !== "none"
    ? `|${plan.flightMode}|${plan.flightAirline || ""}|${plan.flightNumber || ""}|${plan.flightDestinationCity || ""}|${plan.flightDepartureTime || ""}|${plan.pickupFlightNumber || ""}|${plan.pickupArrivalTime || ""}`
    : "";
  const raw = `${plan.destinationName}|${plan.destinationAddress || ""}|${plan.destinationCity || ""}|${plan.destinationPincode || ""}|${plan.departureDate}|${plan.departureTime}|${plan.transportMode}|${plan.currentLocation || ""}${flightPart}`;
  const hash = crypto.createHash("md5").update(raw).digest("hex");
  return `analysis:${hash}`;
}

function getSessionId(req: any): string {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const ua = req.headers["user-agent"] || "unknown";
  return crypto.createHash("md5").update(`${ip}:${ua}`).digest("hex").slice(0, 16);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/agent/analyze-plan", async (req, res) => {
    try {
      const parsed = planRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid request",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const plan = parsed.data;
      const cacheKey = buildCacheKey(plan);

      const cached = await cacheGet(cacheKey);
      if (cached) {
        log("Returning cached analysis result", "cache");
        const cachedResult = JSON.parse(cached) as AnalysisResult;

        const sessionId = getSessionId(req);
        await updateSessionContext(sessionId, plan, cachedResult);

        return res.json(cachedResult);
      }

      const context = generateContext(plan);

      const apiKey = process.env.TINYFISH_API_KEY;
      let aiAnalysis: { risks: Risk[]; suggestions: Suggestion[]; reasoning: string; overallStatus: "good" | "caution" | "danger"; statusMessage: string } | null = null;

      const sessionId2 = getSessionId(req);
      const previousState = await agentStateGet(sessionId2);

      if (apiKey && apiKey.length > 0) {
        try {
          aiAnalysis = await callTinyFish(apiKey, plan, context, previousState);
          log("TinyFish API call successful (fresh)", "tinyfish");
        } catch (err: any) {
          log(`TinyFish API error: ${err.message}`, "tinyfish");
        }
      } else {
        log("No TINYFISH_API_KEY set, using mock analysis", "tinyfish");
      }

      if (!aiAnalysis) {
        aiAnalysis = generateMockAnalysis(plan, context);
      }

      const result: AnalysisResult = {
        context,
        ...aiAnalysis,
      };

      await cacheSet(cacheKey, JSON.stringify(result), 600);

      const sessionId = getSessionId(req);
      await updateSessionContext(sessionId, plan, result);

      await agentStateSet(sessionId2, {
        lastDestination: plan.destinationName,
        lastAnalysis: result.overallStatus,
        lastQuery: new Date().toISOString(),
        queryCount: (previousState?.queryCount || 0) + 1,
        recentDestinations: [
          plan.destinationName,
          ...(previousState?.recentDestinations || []).slice(0, 4),
        ],
      }, 1800);

      return res.json(result);
    } catch (err: any) {
      log(`Error in analyze-plan: ${err.message}`, "error");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/cache-test", async (_req, res) => {
    try {
      if (!isRedisAvailable()) {
        return res.json({
          status: "Redis not available",
          message: "Redis credentials are not configured or connection failed. The app works without cache.",
        });
      }

      const testKey = "test:cache-demo";
      const testValue = { message: "Hello from Redis!", timestamp: new Date().toISOString() };

      await cacheSet(testKey, JSON.stringify(testValue), 60);
      const retrieved = await cacheGet(testKey);

      return res.json({
        status: "success",
        redisAvailable: true,
        stored: testValue,
        retrieved: retrieved ? JSON.parse(retrieved) : null,
        match: retrieved ? JSON.stringify(testValue) === retrieved : false,
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.get("/api/agent-memory-test", async (req, res) => {
    try {
      if (!isRedisAvailable()) {
        return res.json({
          status: "Redis not available",
          message: "Redis credentials are not configured or connection failed.",
        });
      }

      const sessionId = getSessionId(req);
      const session = await sessionGet(sessionId);
      const agentState = await agentStateGet(sessionId);

      return res.json({
        status: "success",
        redisAvailable: true,
        sessionId,
        sessionContext: session || { message: "No session data yet. Analyze a plan first to populate session context." },
        agentState: agentState || { message: "No agent state yet. Analyze a plan first to create agent workflow state." },
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.get("/api/redis-status", async (_req, res) => {
    return res.json({
      available: isRedisAvailable(),
      host: process.env.REDIS_HOST ? "configured" : "not configured",
      port: process.env.REDIS_PORT ? "configured" : "not configured",
      password: process.env.REDIS_PASSWORD ? "configured" : "not configured",
    });
  });

  return httpServer;
}

async function updateSessionContext(sessionId: string, plan: PlanRequest, result: AnalysisResult): Promise<void> {
  const existing = await sessionGet(sessionId) || { recentSearches: [], preferences: {} };

  const recentSearches = [
    {
      destination: plan.destinationName,
      fullAddress: buildFullAddress(plan),
      status: result.overallStatus,
      timestamp: new Date().toISOString(),
    },
    ...(existing.recentSearches || []).slice(0, 9),
  ];

  await sessionSet(sessionId, {
    ...existing,
    recentSearches,
    lastTransportMode: plan.transportMode,
    lastLocation: plan.currentLocation,
    updatedAt: new Date().toISOString(),
  }, 3600);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatTimeFromHHMM(hhmm: string): string {
  if (!hhmm || !hhmm.includes(":")) return hhmm;
  const [h, m] = hhmm.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function addMinutesToHHMM(hhmm: string, minutes: number): string {
  if (!hhmm || !hhmm.includes(":")) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function generateContext(plan: PlanRequest): ContextSummary {
  const departureISO = buildDepartureISO(plan);
  const departure = new Date(departureISO);
  const now = new Date();
  const fullAddress = buildFullAddress(plan);

  const speedKmH: Record<string, number> = {
    driving: 45,
    transit: 30,
    walking: 5,
    cycling: 15,
  };

  let distanceKm: number;
  if (plan.currentCoords && plan.destinationCoords) {
    const straightLine = haversineDistance(
      plan.currentCoords.lat, plan.currentCoords.lng,
      plan.destinationCoords.lat, plan.destinationCoords.lng
    );
    distanceKm = Math.round(straightLine * 1.3);
  } else {
    const locationSeed = (plan.destinationName.length + (plan.currentLocation || "").length + (plan.destinationPincode || "").length) % 20;
    distanceKm = Math.round(5 + locationSeed * 1.5);
  }

  const speed = speedKmH[plan.transportMode] || 45;
  const travelMinutes = Math.round((distanceKm / speed) * 60);

  const arrivalHHMM = addMinutesToHHMM(plan.departureTime, travelMinutes);
  const arrival = new Date(departure.getTime() + travelMinutes * 60000);

  const isFlightMode = plan.flightMode && plan.flightMode !== "none";

  let venueHours = "";
  let closingTime = "";

  if (!isFlightMode) {
    const dest = plan.destinationName.toLowerCase();
    const venueOpenHour = 9;
    const venueCloseHour = dest.includes("restaurant") ? 22 :
      dest.includes("bar") || dest.includes("club") ? 2 :
      dest.includes("gym") || dest.includes("fitness") ? 21 :
      dest.includes("park") ? 20 : 18;

    venueHours = `${venueOpenHour}:00 AM - ${venueCloseHour > 12 ? venueCloseHour - 12 : venueCloseHour}:00 ${venueCloseHour >= 12 ? "PM" : "AM"}`;
    closingTime = `${venueCloseHour > 12 ? venueCloseHour - 12 : venueCloseHour}:00 ${venueCloseHour >= 12 ? "PM" : "AM"}`;
  } else {
    venueHours = "Airport - 24/7";
    closingTime = "N/A";
  }

  const userTimezone = plan.userTimezone || "Local";

  const contextResult: ContextSummary = {
    destination: plan.destinationName,
    fullAddress: fullAddress || undefined,
    eventName: plan.eventName || undefined,
    departureTime: departure.toISOString(),
    userDepartureTime: plan.departureTime,
    userTimezone,
    currentTime: now.toISOString(),
    estimatedTravelMinutes: travelMinutes,
    estimatedArrivalTime: arrival.toISOString(),
    userArrivalTime: arrivalHHMM,
    venueHours,
    venueClosingTime: closingTime,
    transportMode: plan.transportMode,
    distanceKm,
    distanceMiles: Math.round(distanceKm * 0.621371 * 10) / 10,
  };

  if (plan.flightMode && plan.flightMode !== "none") {
    contextResult.flightMode = plan.flightMode;
    if (plan.flightMode === "catching") {
      contextResult.flightNumber = plan.flightNumber || undefined;
      contextResult.flightAirline = plan.flightAirline || undefined;
      contextResult.flightDestinationCity = plan.flightDestinationCity || undefined;
      contextResult.flightDepartureTime = plan.flightDepartureTime || undefined;
    } else if (plan.flightMode === "pickup") {
      contextResult.flightAirline = plan.flightAirline || undefined;
      contextResult.pickupFlightNumber = plan.pickupFlightNumber || undefined;
      contextResult.pickupArrivalTime = plan.pickupArrivalTime || undefined;
    }
  }

  return contextResult;
}

async function callTinyFish(
  apiKey: string,
  plan: PlanRequest,
  context: ContextSummary,
  previousState: Record<string, any> | null
): Promise<{ risks: Risk[]; suggestions: Suggestion[]; reasoning: string; overallStatus: "good" | "caution" | "danger"; statusMessage: string }> {
  const fullAddress = buildFullAddress(plan);
  const previousContext = previousState
    ? `\nPrevious context: User has made ${previousState.queryCount || 0} queries. Last destination: ${previousState.lastDestination || "none"}. Recent destinations: ${(previousState.recentDestinations || []).join(", ") || "none"}.`
    : "";

  let flightContext = "";
  let flightSearchQuery = "";
  if (plan.flightMode === "catching") {
    const flightId = plan.flightNumber || "";
    const airlineName = plan.flightAirline || "";
    const userScheduledTime = plan.flightDepartureTime || "Not specified";
    flightContext = `\n\nFLIGHT MODE — CATCHING A FLIGHT (THIS IS THE PRIMARY FOCUS OF THE ANALYSIS):
- Airline: ${airlineName || "Not specified"}
- Flight number: ${flightId || "Not specified"}
- Destination city: ${plan.flightDestinationCity || "Not specified"}
- User's expected departure time: ${userScheduledTime}
- User is departing from home at: ${formatTimeFromHHMM(plan.departureTime)} ${context.userTimezone || ""} and will arrive at airport in ~${context.estimatedTravelMinutes} minutes (around ${formatTimeFromHHMM(context.userArrivalTime)} ${context.userTimezone || ""})

CRITICAL INSTRUCTIONS:
1. Find the ACTUAL LIVE flight status from the page content. Is this flight on-time, delayed, or cancelled?
2. COMPARE the user's expected departure time (${userScheduledTime}) with the ACTUAL live departure time from the page.
3. If there is a DISCREPANCY (delay, time change, cancellation), this is the #1 risk to report. Tell the user exactly how much the flight is delayed and what the new departure time is.
4. Calculate if the user has enough buffer: they arrive at airport at ~${formatTimeFromHHMM(context.userArrivalTime)} ${context.userTimezone || ""}, and need 2-3 hours before the ACTUAL (not scheduled) departure for check-in, security, boarding.
5. Extract gate, terminal, and any gate change information from the page.
6. DO NOT analyze venue hours — this is a flight trip. Focus entirely on flight status, timing buffer, and airport logistics.
7. If the flight is delayed, suggest the user can leave later. If cancelled, warn them immediately.`;
    if (flightId) {
      flightSearchQuery = `${airlineName ? airlineName + " " : ""}flight ${flightId} status today`;
    } else if (airlineName && plan.flightDestinationCity) {
      flightSearchQuery = `${airlineName} flights to ${plan.flightDestinationCity} today status`;
    }
  } else if (plan.flightMode === "pickup") {
    const pickupId = plan.pickupFlightNumber || "";
    const airlineName = plan.flightAirline || "";
    const userExpectedArrival = plan.pickupArrivalTime || "Not specified";
    flightContext = `\n\nFLIGHT MODE — PICKING SOMEONE UP (THIS IS THE PRIMARY FOCUS OF THE ANALYSIS):
- Airline: ${airlineName || "Not specified"}
- Arriving flight number: ${pickupId || "Not specified"}
- User's expected arrival time: ${userExpectedArrival}
- User is departing from home at: ${formatTimeFromHHMM(plan.departureTime)} ${context.userTimezone || ""} and will arrive at airport in ~${context.estimatedTravelMinutes} minutes (around ${formatTimeFromHHMM(context.userArrivalTime)} ${context.userTimezone || ""})

CRITICAL INSTRUCTIONS:
1. Find the ACTUAL LIVE arrival status from the page content. Is this flight on-time, delayed, diverted, or cancelled?
2. COMPARE the user's expected arrival time (${userExpectedArrival}) with the ACTUAL live arrival time from the page.
3. If there is a DISCREPANCY (delay, time change, diversion), this is the #1 risk to report. Tell the user exactly how much the flight is delayed and what the new arrival time is.
4. Factor in 20-40 minutes after landing for taxiing, deplaning, and baggage claim.
5. Calculate optimal departure time: user should arrive at airport around when the passenger reaches the curb (landing + 30 min).
6. Extract terminal, baggage claim, and any gate change information from the page.
7. DO NOT analyze venue hours — this is a flight pickup. Focus entirely on flight arrival status, pickup timing, and airport logistics.
8. If the flight is delayed, tell the user they can leave later. If cancelled or diverted, warn them immediately.`;
    if (pickupId) {
      flightSearchQuery = `${airlineName ? airlineName + " " : ""}flight ${pickupId} status today`;
    } else if (airlineName) {
      flightSearchQuery = `${airlineName} flight arrival ${plan.destinationName} today status`;
    }
  }

  const isFlightTrip = plan.flightMode === "catching" || plan.flightMode === "pickup";

  const goal = `You are TripGuard, a smart trip intelligence AI. Analyze this trip plan and return a JSON object with risk assessment and recommendations.

${flightSearchQuery ? `IMPORTANT: The page you are viewing contains REAL-TIME flight status information. Extract the ACTUAL flight status (on-time, delayed, cancelled, gate info, terminal, updated times) from the page content. COMPARE the actual status with what the user expects. This comparison is the MOST CRITICAL part of your analysis. Report any discrepancy prominently.` : ""}

Plan details:
- Destination: ${plan.destinationName}
${fullAddress ? `- Full Address: ${fullAddress}` : ""}
- Starting from: ${plan.currentLocation || "Current Location"}
${!isFlightTrip ? `- Event: ${plan.eventName || "General visit"}` : ""}
- Departure Date: ${plan.departureDate}
- Departure Time (leaving home): ${formatTimeFromHHMM(plan.departureTime)} ${context.userTimezone || ""}
- Transport to ${isFlightTrip ? "airport" : "destination"}: ${plan.transportMode}
- Estimated travel time: ${context.estimatedTravelMinutes} minutes
- Estimated arrival at ${isFlightTrip ? "airport" : "destination"}: ${formatTimeFromHHMM(context.userArrivalTime)} ${context.userTimezone || ""}
${!isFlightTrip ? `- Venue hours: ${context.venueHours}` : ""}
- Distance: ${context.distanceKm} km (${context.distanceMiles} miles)
${plan.notes ? `- Notes: ${plan.notes}` : ""}${flightContext}${previousContext}

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "risks": [{"type": "warning|danger|info", "title": "short title", "description": "explanation"}],
  "suggestions": [{"type": "timing|alternative|tip", "title": "short title", "description": "explanation"}],
  "reasoning": "2-3 sentence analysis of the overall plan${isFlightTrip ? " focusing on flight status comparison (expected vs actual)" : ""}",
  "overallStatus": "good|caution|danger",
  "statusMessage": "one-line summary${isFlightTrip ? " including live flight status (on-time, delayed by X min, cancelled, gate info)" : ""}"
}

${isFlightTrip
  ? "FOCUS AREAS: Live flight status vs user's expected time, timing buffer at airport, check-in/security/boarding time, gate/terminal info, and whether user should adjust departure time. DO NOT mention venue hours."
  : "Consider: arrival vs closing time, travel duration, traffic patterns, weather, schedule conflicts, and practical tips."}
Be specific and helpful.${flightSearchQuery ? " If flight status data is available from the page, include it prominently in your response." : ""}`;


  const searchUrl = flightSearchQuery
    ? `https://www.google.com/search?q=${encodeURIComponent(flightSearchQuery)}`
    : `https://www.google.com/search?q=${encodeURIComponent(plan.destinationName + " " + (fullAddress || "") + " hours today")}`;

  const response = await fetch(TINYFISH_API_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: searchUrl,
      goal,
      proxy_config: { enabled: false },
    }),
  });

  if (!response.ok) {
    throw new Error(`TinyFish API returned ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    try {
      let cleanLine = line;
      if (cleanLine.startsWith("data:")) {
        cleanLine = cleanLine.slice(5).trim();
      }
      const parsed = JSON.parse(cleanLine);

      if (parsed.type === "COMPLETE" && parsed.resultJson) {
        const result = typeof parsed.resultJson === "string"
          ? JSON.parse(parsed.resultJson)
          : parsed.resultJson;

        if (result.risks && result.suggestions && result.reasoning) {
          return result;
        }
      }

      if (parsed.resultJson) {
        const result = typeof parsed.resultJson === "string"
          ? JSON.parse(parsed.resultJson)
          : parsed.resultJson;
        if (result.risks && result.suggestions && result.reasoning) {
          return result;
        }
      }

      if (parsed.risks && parsed.suggestions && parsed.reasoning) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Could not parse TinyFish response");
}

function generateMockAnalysis(
  plan: PlanRequest,
  context: ContextSummary
): { risks: Risk[]; suggestions: Suggestion[]; reasoning: string; overallStatus: "good" | "caution" | "danger"; statusMessage: string } {
  const arrival = new Date(context.estimatedArrivalTime);
  const arrivalHour = arrival.getHours();
  const isFlightMode = plan.flightMode === "catching" || plan.flightMode === "pickup";

  const risks: Risk[] = [];
  const suggestions: Suggestion[] = [];
  let overallStatus: "good" | "caution" | "danger" = "good";
  let statusMessage = "Your plan looks solid! You should arrive with plenty of time.";

  if (!isFlightMode) {
    const closingMatch = context.venueClosingTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let closingHour24 = 18;
    if (closingMatch) {
      closingHour24 = parseInt(closingMatch[1]);
      if (closingMatch[3].toUpperCase() === "PM" && closingHour24 !== 12) closingHour24 += 12;
      if (closingMatch[3].toUpperCase() === "AM" && closingHour24 === 12) closingHour24 = 0;
    }

    const minutesBeforeClose = (closingHour24 * 60) - (arrival.getHours() * 60 + arrival.getMinutes());

    if (minutesBeforeClose < 0) {
      overallStatus = "danger";
      statusMessage = "You'll arrive after the venue closes. Consider going earlier or another day.";
      risks.push({
        type: "danger",
        title: "Arriving After Closing Time",
        description: `Based on your departure time and estimated ${context.estimatedTravelMinutes}-minute travel, you'd arrive around ${arrival.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — after the venue closes at ${context.venueClosingTime}.`,
      });
      suggestions.push({
        type: "timing",
        title: "Leave Earlier",
        description: `To arrive before closing, you'd need to depart at least ${Math.abs(minutesBeforeClose) + 30} minutes earlier than planned.`,
      });
    } else if (minutesBeforeClose < 60) {
      overallStatus = "caution";
      statusMessage = "Tight timing — you'll arrive close to closing time. Consider adjusting.";
      risks.push({
        type: "warning",
        title: "Cutting It Close",
        description: `You'll arrive only ${minutesBeforeClose} minutes before closing at ${context.venueClosingTime}. That may not be enough time for your visit.`,
      });
      suggestions.push({
        type: "timing",
        title: "Consider Leaving Sooner",
        description: "Departing 30-45 minutes earlier would give you a more comfortable buffer.",
      });
    } else {
      risks.push({
        type: "info",
        title: "Good Timing",
        description: `You'll arrive about ${minutesBeforeClose} minutes before closing — plenty of time for your visit.`,
      });
    }
  }

  if (context.estimatedTravelMinutes > 45) {
    risks.push({
      type: "warning",
      title: "Long Travel Time",
      description: `The ${context.distanceKm} km (${context.distanceMiles} mi) trip to the ${isFlightMode ? "airport" : "destination"} will take approximately ${context.estimatedTravelMinutes} minutes by ${plan.transportMode}. Traffic or delays could extend this.`,
    });
    if (plan.transportMode === "driving") {
      suggestions.push({
        type: "alternative",
        title: isFlightMode ? "Consider Rideshare" : "Consider Public Transit",
        description: isFlightMode
          ? "Rideshare services like Uber/Lyft avoid airport parking hassles and drop you right at the terminal."
          : "For longer trips, public transit can be more predictable and lets you use travel time productively.",
      });
    }
  }

  if (arrivalHour >= 17 && arrivalHour <= 19 && plan.transportMode === "driving") {
    risks.push({
      type: "warning",
      title: "Rush Hour Traffic",
      description: `Your estimated arrival at the ${isFlightMode ? "airport" : "destination"} falls during peak rush hour (5-7 PM). Expect potential delays of 15-30 minutes.`,
    });
    suggestions.push({
      type: "timing",
      title: "Avoid Rush Hour",
      description: "Consider departing before 4 PM or after 7 PM to avoid the worst traffic congestion.",
    });
  }

  const arrivalTimeFormatted = formatTimeFromHHMM(context.userArrivalTime);
  const tzSuffix = context.userTimezone && context.userTimezone !== "Local" ? ` ${context.userTimezone}` : "";

  if (plan.flightMode === "catching") {
    const flightName = plan.flightAirline
      ? `${plan.flightAirline}${plan.flightNumber ? ` ${plan.flightNumber}` : ""}`
      : plan.flightNumber || `your flight to ${plan.flightDestinationCity || "your destination"}`;

    if (plan.flightDepartureTime) {
      const flightDateTime = new Date(`${plan.departureDate}T${plan.flightDepartureTime}`);
      const arrivalAtAirport = new Date(context.estimatedArrivalTime);
      const bufferMinutes = Math.round((flightDateTime.getTime() - arrivalAtAirport.getTime()) / 60000);

      if (bufferMinutes < 60) {
        overallStatus = "danger";
        statusMessage = `Cutting it too close — only ${Math.max(0, bufferMinutes)} min before your flight.`;
        risks.push({
          type: "danger",
          title: "Not Enough Time at Airport",
          description: `You'd reach the airport around ${arrivalTimeFormatted}${tzSuffix}, just ${Math.max(0, bufferMinutes)} minutes before ${flightName} departs. You need at least 2 hours for check-in and security.`,
        });
      } else if (bufferMinutes < 120) {
        overallStatus = overallStatus === "danger" ? "danger" : "caution";
        statusMessage = `Tight — ${bufferMinutes} min buffer at the airport. Consider leaving earlier.`;
        risks.push({
          type: "warning",
          title: "Tight Buffer",
          description: `You'd have about ${bufferMinutes} minutes at the airport before ${flightName} departs. That's enough if everything goes smoothly, but any delay could be a problem.`,
        });
      } else {
        statusMessage = `Looking good — ${bufferMinutes} min buffer at the airport before your flight.`;
        risks.push({
          type: "info",
          title: "Plenty of Time",
          description: `You'll reach the airport around ${arrivalTimeFormatted}${tzSuffix}, giving you ${bufferMinutes} minutes before ${flightName}. That's a comfortable buffer.`,
        });
      }
    }

    suggestions.push({
      type: "tip",
      title: "Before You Leave",
      description: `Check in online, download your boarding pass, and have your ID ready. Aim to be at the gate 30 minutes before boarding.`,
    });
  } else if (plan.flightMode === "pickup") {
    const theirFlight = plan.flightAirline
      ? `${plan.flightAirline}${plan.pickupFlightNumber ? ` ${plan.pickupFlightNumber}` : ""}`
      : plan.pickupFlightNumber || "their flight";

    if (plan.pickupArrivalTime) {
      const pickupLandingTime = new Date(`${plan.departureDate}T${plan.pickupArrivalTime}`);
      const curbReadyTime = new Date(pickupLandingTime.getTime() + 30 * 60000);
      const arrivalAtAirport = new Date(context.estimatedArrivalTime);
      const curbReadyFormatted = formatTimeFromHHMM(addMinutesToHHMM(plan.pickupArrivalTime, 30));

      if (arrivalAtAirport.getTime() > curbReadyTime.getTime()) {
        overallStatus = overallStatus === "danger" ? "danger" : "caution";
        statusMessage = `You may arrive after your passenger is ready. Leave a bit earlier.`;
        risks.push({
          type: "warning",
          title: "They Might Wait for You",
          description: `${theirFlight} lands at ${formatTimeFromHHMM(plan.pickupArrivalTime)}${tzSuffix}. They'll likely be at the curb by ${curbReadyFormatted}${tzSuffix}, but you won't arrive until ${arrivalTimeFormatted}${tzSuffix}.`,
        });
      } else {
        const waitMin = Math.round((curbReadyTime.getTime() - arrivalAtAirport.getTime()) / 60000);
        if (waitMin > 45) {
          statusMessage = `You'll arrive early — use the cell phone lot to wait.`;
          risks.push({
            type: "info",
            title: "You'll Be Early",
            description: `You'll reach the airport around ${arrivalTimeFormatted}${tzSuffix}, but they won't be out until around ${curbReadyFormatted}${tzSuffix}. Wait at the cell phone lot to avoid circling arrivals.`,
          });
        } else {
          statusMessage = `Good timing — you'll arrive right when they walk out.`;
          risks.push({
            type: "info",
            title: "Great Timing",
            description: `You'll reach the airport around ${arrivalTimeFormatted}${tzSuffix}. ${theirFlight} lands at ${formatTimeFromHHMM(plan.pickupArrivalTime)}${tzSuffix} and they'll be at the curb by about ${curbReadyFormatted}${tzSuffix}.`,
          });
        }
      }
    }

    suggestions.push({
      type: "tip",
      title: "Pickup Tip",
      description: `Wait at the cell phone lot (free) until they text you they have their bags. Then drive to arrivals — you'll avoid circling and parking fees.`,
    });
    suggestions.push({
      type: "timing",
      title: "After Landing",
      description: `It usually takes 20-40 minutes after landing to get off the plane, walk to baggage claim, and grab bags.`,
    });
  } else {
    suggestions.push({
      type: "tip",
      title: "Double-Check Hours",
      description: `Make sure ${plan.destinationName} is open when you plan to arrive. Holiday hours can change without notice.`,
    });
  }

  if (plan.eventName && !isFlightMode) {
    suggestions.push({
      type: "tip",
      title: "Arrive Early",
      description: `For "${plan.eventName}", getting there 15-20 minutes early gives you time to park and settle in.`,
    });
  }

  let reasoning: string;
  if (plan.flightMode === "catching") {
    const flightName = plan.flightAirline
      ? `${plan.flightAirline}${plan.flightNumber ? ` ${plan.flightNumber}` : ""}`
      : plan.flightNumber || `your flight to ${plan.flightDestinationCity || "your destination"}`;
    reasoning = overallStatus === "danger"
      ? `You don't have enough time to make ${flightName}. The ${context.estimatedTravelMinutes}-minute drive means you'd arrive too late for check-in and security. Leave earlier or arrange faster transport.`
      : overallStatus === "caution"
      ? `The timing for ${flightName} is tight. You'd have a narrow window at the airport. Leaving a bit earlier would give you a safety cushion.`
      : `Your timing for ${flightName} looks solid. You'll have plenty of time at the airport for check-in and security. Check in online before you leave.`;
  } else if (plan.flightMode === "pickup") {
    const theirFlight = plan.pickupFlightNumber || "their flight";
    reasoning = overallStatus === "caution"
      ? `You might get to the airport a little late for ${theirFlight}. Consider leaving earlier so they're not standing around waiting.`
      : `Your timing to pick up from ${theirFlight} looks good. The ${context.estimatedTravelMinutes}-minute drive gets you there right around when they'll have their bags. Use the cell phone lot if you're early.`;
  } else {
    reasoning = overallStatus === "danger"
      ? `You'd arrive at ${plan.destinationName} after it closes. You'll need to leave earlier or go on a different day.`
      : overallStatus === "caution"
      ? `You'd arrive close to closing time at ${plan.destinationName}. Leaving a bit earlier gives you more breathing room.`
      : `Your trip to ${plan.destinationName} looks well-timed. You'll arrive with plenty of time. Just double-check hours before heading out.`;
  }

  return { risks, suggestions, reasoning, overallStatus, statusMessage };
}
