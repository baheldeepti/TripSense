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
    ? `|${plan.flightMode}|${plan.flightNumber || ""}|${plan.flightDestinationCity || ""}|${plan.flightDepartureTime || ""}|${plan.pickupFlightNumber || ""}|${plan.pickupArrivalTime || ""}`
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

  const locationSeed = (plan.destinationName.length + (plan.currentLocation || "").length + (plan.destinationPincode || "").length) % 20;
  const distanceKm = Math.round(5 + locationSeed * 1.5);
  const speed = speedKmH[plan.transportMode] || 45;
  const travelMinutes = Math.round((distanceKm / speed) * 60);
  const arrival = new Date(departure.getTime() + travelMinutes * 60000);

  const dest = plan.destinationName.toLowerCase();
  const venueOpenHour = 9;
  const venueCloseHour = dest.includes("restaurant") ? 22 :
    dest.includes("bar") || dest.includes("club") ? 2 :
    dest.includes("gym") || dest.includes("fitness") ? 21 :
    dest.includes("park") ? 20 : 18;

  const venueHours = `${venueOpenHour}:00 AM - ${venueCloseHour > 12 ? venueCloseHour - 12 : venueCloseHour}:00 ${venueCloseHour >= 12 ? "PM" : "AM"}`;
  const closingTime = `${venueCloseHour > 12 ? venueCloseHour - 12 : venueCloseHour}:00 ${venueCloseHour >= 12 ? "PM" : "AM"}`;

  const contextResult: ContextSummary = {
    destination: plan.destinationName,
    fullAddress: fullAddress || undefined,
    eventName: plan.eventName || undefined,
    departureTime: departure.toISOString(),
    currentTime: now.toISOString(),
    estimatedTravelMinutes: travelMinutes,
    estimatedArrivalTime: arrival.toISOString(),
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
    flightContext = `\n\nFLIGHT CONTEXT (User is catching a flight):
- Airline: ${airlineName || "Not specified"}
- Flight number: ${flightId || "Not specified"}
- Destination city: ${plan.flightDestinationCity || "Not specified"}
- Scheduled departure time: ${plan.flightDepartureTime || "Not specified"}
- CRITICAL: You MUST look up the REAL-TIME flight status from the page. Check if this flight is on time, delayed, cancelled, or has a gate change. Report the actual current status, any delay duration, updated departure time, terminal, and gate information. This is the most important part of the analysis.
- Also factor in recommended airport arrival times (2-3 hours before domestic, 3 hours before international). Consider check-in, security, and boarding time.`;
    if (flightId) {
      flightSearchQuery = `${airlineName ? airlineName + " " : ""}flight ${flightId} status today`;
    } else if (airlineName && plan.flightDestinationCity) {
      flightSearchQuery = `${airlineName} flights to ${plan.flightDestinationCity} today status`;
    }
  } else if (plan.flightMode === "pickup") {
    const pickupId = plan.pickupFlightNumber || "";
    const airlineName = plan.flightAirline || "";
    flightContext = `\n\nPICKUP CONTEXT (User is picking someone up at the airport):
- Airline: ${airlineName || "Not specified"}
- Arriving flight number: ${pickupId || "Not specified"}
- Expected arrival time: ${plan.pickupArrivalTime || "Not specified"}
- CRITICAL: You MUST look up the REAL-TIME flight status from the page. Check if this arriving flight is on time, delayed, cancelled, or diverted. Report the actual current arrival status, any delay duration, updated arrival time, terminal, and baggage claim information. This is the most important part of the analysis.
- Also factor in taxiing, baggage claim time (typically 20-40 minutes after landing). Suggest optimal departure time for pickup. Consider airport parking/cell phone lot options.`;
    if (pickupId) {
      flightSearchQuery = `${airlineName ? airlineName + " " : ""}flight ${pickupId} status today`;
    } else if (airlineName) {
      flightSearchQuery = `${airlineName} flight arrival ${plan.destinationName} today status`;
    }
  }

  const goal = `You are TripSense, a smart trip intelligence AI. Analyze this trip plan and return a JSON object with risk assessment and recommendations.

${flightSearchQuery ? `IMPORTANT: The page you are viewing contains REAL-TIME flight status information. Extract the actual flight status (on-time, delayed, cancelled, gate info, terminal, updated times) from the page content. This real flight data is CRITICAL for your analysis. If you find delay information, adjust all your timing recommendations accordingly.` : ""}

Plan details:
- Destination: ${plan.destinationName}
${fullAddress ? `- Full Address: ${fullAddress}` : ""}
- Starting from: ${plan.currentLocation || "Current Location"}
- Event: ${plan.eventName || "General visit"}
- Departure Date: ${plan.departureDate}
- Departure Time: ${plan.departureTime}
- Transport: ${plan.transportMode}
- Estimated travel: ${context.estimatedTravelMinutes} minutes
- Estimated arrival: ${context.estimatedArrivalTime}
- Venue hours: ${context.venueHours}
- Distance: ${context.distanceKm} km (${context.distanceMiles} miles)
${plan.notes ? `- Notes: ${plan.notes}` : ""}${flightContext}${previousContext}

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "risks": [{"type": "warning|danger|info", "title": "short title", "description": "explanation"}],
  "suggestions": [{"type": "timing|alternative|tip", "title": "short title", "description": "explanation"}],
  "reasoning": "2-3 sentence analysis of the overall plan including real-time flight status if available",
  "overallStatus": "good|caution|danger",
  "statusMessage": "one-line summary including flight status (e.g. on-time, delayed by X min)"
}

Consider: real-time flight status, arrival vs closing time, travel duration, traffic patterns, weather, schedule conflicts, and practical tips. Be specific and helpful. If flight status data is available from the page, include it prominently in your response.`;

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
  const closingMatch = context.venueClosingTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
  let closingHour24 = 18;
  if (closingMatch) {
    closingHour24 = parseInt(closingMatch[1]);
    if (closingMatch[3].toUpperCase() === "PM" && closingHour24 !== 12) closingHour24 += 12;
    if (closingMatch[3].toUpperCase() === "AM" && closingHour24 === 12) closingHour24 = 0;
  }

  const minutesBeforeClose = (closingHour24 * 60) - (arrival.getHours() * 60 + arrival.getMinutes());
  const risks: Risk[] = [];
  const suggestions: Suggestion[] = [];
  let overallStatus: "good" | "caution" | "danger" = "good";
  let statusMessage = "Your plan looks solid! You should arrive with plenty of time.";

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

  if (context.estimatedTravelMinutes > 45) {
    risks.push({
      type: "warning",
      title: "Long Travel Time",
      description: `The ${context.distanceKm} km (${context.distanceMiles} mi) trip will take approximately ${context.estimatedTravelMinutes} minutes by ${plan.transportMode}. Traffic or delays could extend this.`,
    });
    if (plan.transportMode === "driving") {
      suggestions.push({
        type: "alternative",
        title: "Consider Public Transit",
        description: "For longer trips, public transit can be more predictable and lets you use travel time productively.",
      });
    }
  }

  if (arrivalHour >= 17 && arrivalHour <= 19 && plan.transportMode === "driving") {
    risks.push({
      type: "warning",
      title: "Rush Hour Traffic",
      description: "Your estimated arrival falls during peak rush hour (5-7 PM). Expect potential delays of 15-30 minutes.",
    });
    suggestions.push({
      type: "timing",
      title: "Avoid Rush Hour",
      description: "Consider departing before 4 PM or after 7 PM to avoid the worst traffic congestion.",
    });
  }

  if (plan.flightMode === "catching") {
    const flightLabel = plan.flightNumber || `flight to ${plan.flightDestinationCity || "destination"}`;
    const arrivalAtAirport = new Date(context.estimatedArrivalTime);

    if (plan.flightDepartureTime) {
      const flightDateTime = new Date(`${plan.departureDate}T${plan.flightDepartureTime}`);
      const bufferMinutes = Math.round((flightDateTime.getTime() - arrivalAtAirport.getTime()) / 60000);

      if (bufferMinutes < 60) {
        overallStatus = "danger";
        statusMessage = "You may miss your flight! You won't have enough time for check-in and security.";
        risks.push({
          type: "danger",
          title: "High Risk of Missing Flight",
          description: `You'd arrive at the airport only ${Math.max(0, bufferMinutes)} minutes before your ${flightLabel} departure. Airlines recommend arriving 2-3 hours early for security, check-in, and boarding.`,
        });
      } else if (bufferMinutes < 120) {
        overallStatus = overallStatus === "danger" ? "danger" : "caution";
        statusMessage = "Tight timing for your flight — consider leaving earlier.";
        risks.push({
          type: "warning",
          title: "Tight Airport Buffer",
          description: `You'd have about ${bufferMinutes} minutes at the airport before ${flightLabel} departs. For domestic flights, 2 hours is recommended; international flights need 3 hours.`,
        });
      } else {
        risks.push({
          type: "info",
          title: "Good Airport Timing",
          description: `You'll arrive about ${bufferMinutes} minutes before your ${flightLabel} — plenty of time for check-in and security.`,
        });
      }
    }

    suggestions.push({
      type: "tip",
      title: "Pre-Flight Checklist",
      description: `For ${flightLabel}: Check in online 24 hours before departure, have your boarding pass ready, and arrive at the gate 30 minutes before boarding.`,
    });
    suggestions.push({
      type: "tip",
      title: "Airport Parking",
      description: `Consider airport parking options: long-term lots are cheaper, ride-sharing drop-off is fastest, and some airports have cell phone lots for quick access.`,
    });
  } else if (plan.flightMode === "pickup") {
    const pickupLabel = plan.pickupFlightNumber || "the arriving flight";

    if (plan.pickupArrivalTime) {
      const pickupLandingTime = new Date(`${plan.departureDate}T${plan.pickupArrivalTime}`);
      const pickupReadyTime = new Date(pickupLandingTime.getTime() + 30 * 60000);
      const arrivalAtAirport = new Date(context.estimatedArrivalTime);
      const waitMinutes = Math.round((pickupReadyTime.getTime() - arrivalAtAirport.getTime()) / 60000);

      if (arrivalAtAirport.getTime() > pickupReadyTime.getTime()) {
        overallStatus = overallStatus === "danger" ? "danger" : "caution";
        statusMessage = "You might arrive after your passenger is ready — they may have to wait.";
        risks.push({
          type: "warning",
          title: "Late for Pickup",
          description: `${pickupLabel} lands at ${plan.pickupArrivalTime}, and passengers typically reach the curb 20-40 minutes after landing. You'd arrive later than ideal.`,
        });
      } else if (waitMinutes > 45) {
        risks.push({
          type: "info",
          title: "Early Arrival for Pickup",
          description: `You'll arrive well before ${pickupLabel} passengers are ready. Consider using the cell phone lot to wait and save on parking.`,
        });
      } else {
        risks.push({
          type: "info",
          title: "Good Pickup Timing",
          description: `Your arrival aligns well with ${pickupLabel} — you should be at the curb right when passengers exit.`,
        });
      }
    }

    suggestions.push({
      type: "tip",
      title: "Pickup Strategy",
      description: `Use the airport's cell phone lot (free short-term waiting area) until ${pickupLabel} passenger texts that they have their bags. Then drive to arrivals for curbside pickup.`,
    });
    suggestions.push({
      type: "timing",
      title: "Baggage Claim Buffer",
      description: `After landing, passengers typically need 20-40 minutes for taxiing, deplaning, and baggage claim. Factor this into your timing.`,
    });
  } else {
    suggestions.push({
      type: "tip",
      title: "Check Before You Go",
      description: `Verify that ${plan.destinationName} hasn't changed their hours today. Holiday schedules and special events can affect operating times.`,
    });
  }

  if (plan.eventName && plan.flightMode !== "catching" && plan.flightMode !== "pickup") {
    suggestions.push({
      type: "tip",
      title: "Event Preparation",
      description: `For "${plan.eventName}", consider arriving 15-20 minutes early to find parking, get oriented, and settle in.`,
    });
  }

  let reasoning: string;
  if (plan.flightMode === "catching") {
    const flightLabel = plan.flightNumber || `your flight to ${plan.flightDestinationCity || "your destination"}`;
    reasoning = overallStatus === "danger"
      ? `Critical timing issue for ${flightLabel}. With a ${context.estimatedTravelMinutes}-minute drive to ${plan.destinationName}, you won't have enough buffer time for check-in, security, and boarding. Airlines recommend arriving 2-3 hours before departure. Consider leaving significantly earlier or arranging faster transport.`
      : overallStatus === "caution"
      ? `The timing for ${flightLabel} is tight. Your ${context.estimatedTravelMinutes}-minute trip to ${plan.destinationName} leaves a narrow window for airport procedures. Consider leaving earlier to build in a safety buffer for unexpected delays.`
      : `Good planning for ${flightLabel}. Your ${context.estimatedTravelMinutes}-minute trip to ${plan.destinationName} gives you comfortable time for check-in, security, and boarding. Remember to check in online and have your documents ready.`;
  } else if (plan.flightMode === "pickup") {
    const pickupLabel = plan.pickupFlightNumber || "the arriving flight";
    reasoning = overallStatus === "danger"
      ? `Timing concern for picking up from ${pickupLabel} at ${plan.destinationName}. With your ${context.estimatedTravelMinutes}-minute travel time, you may arrive too late. Consider leaving earlier or using the airport's cell phone lot.`
      : overallStatus === "caution"
      ? `The pickup timing for ${pickupLabel} could be tighter than ideal. Factor in 20-40 minutes for deplaning and baggage claim after landing, and use the cell phone lot to coordinate the pickup.`
      : `Your timing for picking up from ${pickupLabel} at ${plan.destinationName} looks good. The ${context.estimatedTravelMinutes}-minute trip should get you there in time. Use the cell phone lot to wait if you arrive early.`;
  } else {
    reasoning = overallStatus === "danger"
      ? `Based on the analysis, this plan has significant timing issues. With a ${context.estimatedTravelMinutes}-minute travel time via ${plan.transportMode} over ${context.distanceKm} km, you would arrive at ${plan.destinationName} after it closes. The AI recommends rescheduling to an earlier departure or choosing a different day.`
      : overallStatus === "caution"
      ? `This plan is feasible but tight. The ${context.estimatedTravelMinutes}-minute journey to ${plan.destinationName} would have you arriving close to closing time. Consider building in a buffer by leaving earlier, and watch for traffic or transit delays that could eat into your available time.`
      : `This plan looks well-timed. Your ${context.estimatedTravelMinutes}-minute trip to ${plan.destinationName} via ${plan.transportMode} should get you there with comfortable time to spare before closing. Just double-check venue hours and account for any unusual conditions.`;
  }

  return { risks, suggestions, reasoning, overallStatus, statusMessage };
}
