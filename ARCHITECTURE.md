# TripSense - Architecture Document

## Project Overview

**TripSense** is an AI-powered smart trip intelligence platform that helps users avoid wasted trips, missed events, and poor logistical decisions. Users enter a destination (via map or search), departure date/time, and transport mode, and the system analyzes timing risks, real-time flight status, venue hours, and travel context to provide actionable warnings, suggestions, and smart alternatives.

### Key Differentiators
- **Real-time flight tracking** — Detects airport destinations automatically, collects airline and flight details, and checks live flight status (delays, cancellations, gate changes) via TinyFish AI
- **Map-based location picker** — Uber-style OpenStreetMap integration with search autocomplete and click-to-pick
- **Context-aware AI analysis** — Uses web scraping AI to gather real-world data (venue hours, flight status) for accurate recommendations
- **Graceful fallback** — Fully functional demo mode when API keys are not configured

---

## System Architecture

```
+--------------------------------------------------+
|                    CLIENT                         |
|  React + TypeScript + Vite + Tailwind CSS         |
|                                                   |
|  +---------------------------------------------+ |
|  |              Home Page (/)                   | |
|  |  +----------------+  +--------------------+ | |
|  |  |   PlanForm     |  |   Results Panel    | | |
|  |  | - LocationPicker|  | - ContextSummary   | | |
|  |  | - FlightDialog |  | - RiskCards        | | |
|  |  | - Transport    |  | - SuggestionsCard  | | |
|  |  | - DateTime     |  | - ReasoningCard    | | |
|  |  +----------------+  +--------------------+ | |
|  +---------------------------------------------+ |
+---------------------------|-----------------------+
                            | POST /api/agent/analyze-plan
                            v
+--------------------------------------------------+
|                    SERVER                         |
|  Express 5 + TypeScript + Node.js                 |
|                                                   |
|  +---------------------------------------------+ |
|  |  Route Handler                               | |
|  |  1. Validate with Zod                        | |
|  |  2. Check Redis cache                        | |
|  |  3. Build context (ETA, distance, hours)     | |
|  |  4. Call TinyFish AI (or mock fallback)      | |
|  |  5. Cache result in Redis                    | |
|  |  6. Return AnalysisResult                    | |
|  +---------------------------------------------+ |
+------------|---------------------|----------------+
             |                     |
             v                     v
+------------------+    +-------------------+
|   TinyFish AI    |    |     Redis         |
|   (Web Scraping  |    |   (Cache Layer)   |
|    + AI Agent)   |    |                   |
|                  |    | - Analysis: 600s  |
| - Flight status  |    | - Sessions: 3600s |
| - Venue hours    |    | - Agent: 1800s    |
| - Real-time data |    |                   |
+------------------+    +-------------------+
```

---

## Directory Structure

```
TripSense/
├── client/                     # Frontend (React SPA)
│   ├── index.html              # Entry HTML with meta tags & social sharing
│   ├── public/
│   │   ├── images/             # Cover image, app icon
│   │   └── videos/             # Marketing video
│   └── src/
│       ├── main.tsx            # React entry point
│       ├── App.tsx             # Router & providers
│       ├── index.css           # Tailwind + custom theme (sunset-violet palette)
│       ├── pages/
│       │   ├── home.tsx        # Main page with form + results
│       │   └── not-found.tsx   # 404 page
│       ├── components/
│       │   ├── plan-form.tsx       # Trip planning form with validation
│       │   ├── location-picker.tsx # Map-based location picker (Leaflet)
│       │   ├── flight-dialog.tsx   # Airport detection + flight details modal
│       │   ├── context-summary.tsx # Analysis context display
│       │   ├── risk-card.tsx       # Risk assessment cards
│       │   ├── suggestions-card.tsx# Smart suggestions display
│       │   ├── reasoning-card.tsx  # AI reasoning explanation
│       │   ├── empty-state.tsx     # Initial state with feature showcase
│       │   ├── theme-provider.tsx  # Dark/light theme management
│       │   ├── theme-toggle.tsx    # Theme switch button
│       │   └── ui/                 # shadcn/ui component library
│       ├── hooks/
│       │   └── use-toast.ts    # Toast notification hook
│       └── lib/
│           ├── queryClient.ts  # TanStack Query configuration
│           └── utils.ts        # Utility functions
├── server/                     # Backend (Express API)
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # API routes + TinyFish integration
│   ├── redis.ts                # Redis cache layer
│   ├── storage.ts              # Storage interface (extensible)
│   ├── vite.ts                 # Vite dev server middleware
│   └── static.ts               # Static file serving (production)
├── shared/                     # Shared types & schemas
│   └── schema.ts               # Zod schemas + TypeScript types
├── migrations/                 # Database migrations (Drizzle)
├── script/
│   └── build.ts                # Production build script
├── tailwind.config.ts          # Tailwind CSS configuration
├── vite.config.ts              # Vite bundler configuration
├── drizzle.config.ts           # Drizzle ORM configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies & scripts
```

---

## Frontend Architecture

### Tech Stack
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Bundler with HMR |
| Tailwind CSS | Utility-first styling |
| shadcn/ui + Radix UI | Component library |
| TanStack React Query | Server state management |
| React Hook Form + Zod | Form handling & validation |
| Wouter | Lightweight routing |
| Leaflet + react-leaflet | Interactive maps |
| Lucide React | Icon library |

### Component Architecture

```
App.tsx
├── ThemeProvider (dark/light mode)
├── QueryClientProvider (data fetching)
├── TooltipProvider
└── Router
    └── Home Page
        ├── Header (logo, theme toggle, AI badge)
        ├── PlanForm
        │   ├── LocationPicker (destination - map + search)
        │   ├── LocationPicker (starting location - map + search)
        │   ├── Transport Mode Selector (visual icon buttons)
        │   ├── Date/Time Inputs
        │   ├── Flight Context Banner (when airport detected)
        │   └── Notes Field
        ├── FlightDialog (modal - triggered on airport detection)
        │   ├── Intent Selection (catching / pickup / neither)
        │   ├── Catching Details (airline, flight #, destination, time)
        │   └── Pickup Details (airline, flight #, arrival time)
        └── Results Panel
            ├── Status Banner (good / caution / danger)
            ├── ContextSummary (travel time, distance, venue hours)
            ├── RiskCards (timing, traffic, flight risks)
            ├── SuggestionsCard (alternatives, tips)
            └── ReasoningCard (AI explanation)
```

### Location Picker Flow
1. User types in search box → Nominatim geocoding API returns suggestions
2. User clicks suggestion → Map centers on location, marker placed
3. OR user clicks directly on map → Reverse geocode fills address fields
4. Address details (street, city, state, pincode) auto-filled and collapsible
5. On form submit → If location was typed manually, validates via geocoding

### Flight Detection Flow
1. User enters destination → `detectAirport()` checks against IATA codes and airport keywords
2. If airport detected → FlightDialog modal opens automatically
3. User selects intent: "Catching a flight" or "Picking someone up"
4. User enters airline name, flight number, and times
5. Flight context stored in form state, shown in banner
6. On submit → Backend searches for real-time flight status via TinyFish AI

---

## Backend Architecture

### API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/agent/analyze-plan` | Main analysis endpoint |
| GET | `/api/redis-status` | Redis connection health check |
| GET | `/api/cache-test` | Cache functionality test |
| GET | `/api/agent-memory-test` | Session memory test |

### Request Processing Pipeline

```
Request → Zod Validation → Cache Check → Context Building → AI Analysis → Cache Store → Response
```

1. **Validation**: Request body validated against `planRequestSchema` (Zod)
2. **Cache Check**: MD5 hash of plan parameters checked against Redis
3. **Session Context**: Previous queries loaded from Redis for continuity
4. **Context Building**: Calculates ETA, distance, venue hours, travel estimates
5. **AI Analysis**: Calls TinyFish API with contextual search URL and structured prompt
6. **Mock Fallback**: If no API key, generates realistic analysis based on timing calculations
7. **Cache Storage**: Results cached in Redis (TTL: 600s)
8. **Response**: Returns `AnalysisResult` with risks, suggestions, reasoning, status

### TinyFish AI Integration

TinyFish is a web scraping AI agent. The backend sends it:
- **URL**: A Google search query relevant to the trip
  - For flights: `"{airline} flight {number} status today"` → Gets real-time flight status
  - For venues: `"{destination} hours today"` → Gets venue operating hours
- **Goal**: A structured prompt with trip details, requesting JSON analysis output

The AI agent browses the search results, extracts relevant data (flight delays, venue hours, etc.), and returns a structured analysis.

### Redis Cache Layer

```
server/redis.ts
├── cacheGet/Set     → Analysis results (TTL: 600s)
├── sessionGet/Set   → User session context (TTL: 3600s)
└── agentStateGet/Set → Agent memory state (TTL: 1800s)
```

- **Cache Key**: MD5 hash of plan parameters for deterministic hits
- **Session ID**: MD5 of IP + User-Agent (server-side, no cookies)
- **Graceful Degradation**: App works fully without Redis

---

## Shared Schema (`shared/schema.ts`)

### Core Types

```typescript
PlanRequest {
  destinationName: string        // Required, trimmed
  destinationAddress?: string    // Auto-filled from map
  destinationCity?: string
  destinationState?: string
  destinationPincode?: string    // Regex validated
  departureDate: string          // ISO date
  departureTime: string          // HH:MM
  transportMode: string          // driving | transit | walking | cycling | rideshare
  currentLocation?: string       // Starting point
  eventName?: string
  notes?: string                 // Max 500 chars
  flightMode?: "none" | "catching" | "pickup"
  flightNumber?: string
  flightAirline?: string         // Airline name for flight tracking
  flightDestinationCity?: string
  flightDepartureTime?: string
  pickupFlightNumber?: string
}

AnalysisResult {
  contextSummary: ContextSummary
  risks: Risk[]
  suggestions: Suggestion[]
  reasoning: string
  overallStatus: "good" | "caution" | "danger"
  statusMessage: string
}
```

---

## Design System

### Color Palette — "Sunset Journey"
The brand uses a warm sunset-to-violet gradient symbolizing the journey from departure to destination.

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| Primary | `262 83% 58%` (violet) | `262 80% 65%` | Buttons, links, accents |
| Background | `252 20% 98%` (warm white) | `252 25% 7%` (deep navy) | Page background |
| Card | `252 15% 99%` | `252 20% 10%` | Card surfaces |
| Gradient | Orange → Coral → Violet | Muted version | Logo, headings, decorative |

### Gradient Utilities
- `.gradient-text` — Orange-to-violet text gradient for headings
- `.gradient-bg-header` — Full gradient background for logo/accents
- `.gradient-bg-subtle` — Very light gradient tint for backgrounds
- `.gradient-border` — Gradient border effect

### Logo
Custom SVG featuring a gradient location pin (orange to violet) with concentric radar circles, representing "sensing" — the intelligence that surrounds each trip.

### Typography
- **Primary**: Inter (sans-serif)
- **Monospace**: JetBrains Mono

### Animations
- `fade-in-up` — Cards entering from below (staggered)
- `scale-in` — Status banner scaling in
- `pulse-soft` — Loading skeleton pulse
- `shimmer` — Loading shimmer effect

---

## Build & Deployment

### Development
```bash
npm run dev          # Starts Express + Vite HMR on port 5000
```

### Production Build
```bash
npm run build        # Vite builds client → dist/public/
                     # esbuild bundles server → dist/index.cjs
```

### Environment Variables
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TINYFISH_API_KEY` | No | TinyFish AI API key (mock fallback if absent) |
| `REDIS_HOST` | No | Redis hostname |
| `REDIS_PORT` | No | Redis port |
| `REDIS_PASSWORD` | No | Redis password |
| `SESSION_SECRET` | No | Session signing secret |

### Deployment
- Hosted on Replit with automatic HTTPS
- Frontend served as static files from Express in production
- Redis and PostgreSQL configured via environment secrets

---

## Innovation Highlights

1. **Smart Airport Detection** — Automatically detects when a destination is an airport using IATA code matching and keyword recognition, then prompts for flight details
2. **Real-Time Flight Intelligence** — Uses TinyFish AI to scrape live flight status from the web, providing actual delay/cancellation info rather than generic advice
3. **Dual Location Mapping** — Both destination and starting location support full OpenStreetMap-based picking with search, click-to-select, and reverse geocoding
4. **Contextual AI Prompting** — Dynamically adjusts the AI search URL and prompt based on trip type (flight vs. venue visit) for more relevant analysis
5. **Progressive Enhancement** — Fully functional without any API keys using intelligent mock analysis; progressively better with Redis caching and TinyFish AI
6. **Session Continuity** — Remembers user's previous queries via Redis session storage, providing context-aware follow-up analysis
