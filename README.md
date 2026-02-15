# TripGuard

**AI-Powered Smart Trip Intelligence**

TripGuard helps you avoid wasted trips, missed flights, and poor logistical decisions. Enter your destination, departure time, and transport mode — and get real-time risk analysis, flight status tracking, and smart alternatives powered by AI.

![TripGuard Cover](client/public/images/tripguard-cover.png)

---

## Features

- **Map-Based Location Picker** — Uber-style interactive map powered by OpenStreetMap and Leaflet. Search for places, click to select, and auto-fill address details via reverse geocoding. Works for both destination and starting location.

- **Real-Time Flight Tracking** — Automatically detects airport destinations, prompts for flight details (catching a flight or picking someone up), and checks live flight status (delays, cancellations, gate changes) using AI-powered web scraping.

- **Airport Pickup Mode** — Calculates when your passenger will reach the curb (landing + 30 min), tells you if you'll be early or late, and suggests waiting at the cell phone lot.

- **Editable Flight Details** — Change your flight or pickup info anytime with the edit button — no need to start over.

- **AI Risk Assessment** — Analyzes timing risks, traffic conditions, venue hours, and weather context to flag potential problems before you leave.

- **Smart Suggestions** — Recommends optimal departure times, alternative routes, and backup plans in plain, friendly English.

- **Real Distance Calculation** — Uses Haversine formula from actual map coordinates with a 1.3x road factor for accurate travel estimates.

- **Timezone Awareness** — Detects your local timezone and displays all times accordingly (EST, PST, etc.).

- **AI Reasoning** — Shows transparent reasoning behind every recommendation so you understand why.

- **Dark/Light Mode** — Full theme support with a sunset-to-violet branded gradient.

- **Works Without API Keys** — Fully functional demo mode with intelligent mock analysis when no external services are configured.

---

## Demo Video

A marketing video is available at [`client/public/videos/tripguard-marketing.mp4`](client/public/videos/tripguard-marketing.mp4).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Maps | Leaflet + react-leaflet, OpenStreetMap, Nominatim geocoding |
| State | TanStack React Query, React Hook Form + Zod |
| Backend | Express 5, TypeScript, Node.js |
| AI | TinyFish AI (web scraping agent for real-time data) |
| Cache | Redis (analysis results, sessions, agent state) |
| Database | PostgreSQL + Drizzle ORM |
| Routing | Wouter |

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Redis (optional — app works without it)

### Installation

```bash
# Clone the repository
git clone https://github.com/baheldeepti/TripGuard.git
cd TripGuard

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file or set the following environment variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TINYFISH_API_KEY` | No | TinyFish AI API key (falls back to mock analysis) |
| `REDIS_HOST` | No | Redis server hostname |
| `REDIS_PORT` | No | Redis server port |
| `REDIS_PASSWORD` | No | Redis authentication password |
| `SESSION_SECRET` | No | Session signing secret |

### Run

```bash
# Development (with hot module replacement)
npm run dev

# Production build
npm run build
```

The app runs on **http://localhost:5000**.

---

## How It Works

1. **Pick your destination** — Use the map to search and select where you're going
2. **Set your starting point** — Optionally pick where you're coming from
3. **Choose transport mode** — Driving, transit, walking, cycling, or rideshare
4. **Enter departure date and time** — When you plan to leave
5. **Add flight details** (if applicable) — TripGuard detects airports automatically and asks if you're catching a flight or picking someone up
6. **Edit anytime** — Tap the pencil icon on the flight banner to update details
7. **Get your analysis** — AI evaluates your plan and returns:
   - Overall status (Good / Caution / Danger)
   - Context summary with mode-specific title ("Catching Your Flight" / "Airport Pickup" / "Your Trip at a Glance")
   - Risk cards with severity levels
   - Actionable suggestions in plain English
   - Transparent AI reasoning

---

## Project Structure

```
TripGuard/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Feature + UI components
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # Custom hooks
│   │   └── lib/             # Utilities
│   └── public/              # Static assets (images, videos)
├── server/                  # Express backend
│   ├── routes.ts            # API endpoints + TinyFish integration
│   ├── redis.ts             # Redis cache layer
│   └── storage.ts           # Storage interface
├── shared/                  # Shared types & Zod schemas
│   └── schema.ts
├── ARCHITECTURE.md          # Detailed architecture documentation
├── DEMO_SCRIPT.md           # 3-minute hackathon demo script
└── package.json
```

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## License

This project was built for hackathon demonstration purposes.
