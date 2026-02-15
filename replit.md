# TripGuard

## Overview

This is a full-stack web application called **TripGuard** — an AI-powered trip planner that helps users avoid wasted trips, missed events, and poor logistical decisions. Users enter a destination, departure time, and transport mode, and the backend analyzes timing risks, venue hours, and travel context to provide warnings, suggestions, and smart alternatives.

The app follows a monorepo structure with a React frontend (`client/`), an Express backend (`server/`), and shared types/schemas (`shared/`). It's designed to run fully on Replit with environment variable support for API keys.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Directory Structure
- `client/` — React SPA (Vite-based)
- `server/` — Express API server
- `shared/` — Shared TypeScript types and Zod schemas used by both client and server
- `migrations/` — Drizzle ORM migration files
- `script/` — Build tooling (esbuild for server, Vite for client)
- `attached_assets/` — Project requirements/specs

### Frontend Architecture
- **Framework**: React with TypeScript
- **Bundler**: Vite (with HMR via `server/vite.ts` in development)
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **Forms**: React Hook Form with Zod resolver for validation
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Key Pages**: Home page (`/`) with plan form and analysis results, 404 page
- **Component Structure**: Feature components (plan-form, context-summary, risk-card, suggestions-card, reasoning-card, empty-state, location-picker, flight-dialog) plus a full shadcn/ui component library in `components/ui/`
- **Map Picker**: Leaflet + OpenStreetMap map-based location picker (like Uber). Uses Nominatim for geocoding/search. No API key required. Auto-fills destination name, address, city, state, pincode from map selection. Address details are collapsible for manual editing.

### Backend Architecture
- **Framework**: Express 5 running on Node.js
- **Language**: TypeScript, executed via `tsx`
- **API Pattern**: RESTful, all routes prefixed with `/api/`
- **Primary Endpoint**: `POST /api/agent/analyze-plan` — accepts plan details, validates with Zod, calls TinyFish API (or falls back to mock data), returns analysis result
- **Request Validation**: Zod schemas defined in `shared/schema.ts`, shared between frontend and backend
- **Development**: Vite dev server middleware is attached to the Express server for HMR
- **Production**: Client is built to `dist/public/`, server is bundled with esbuild to `dist/index.cjs`

### Data Flow
1. User fills out the plan form (destination, departure time, transport mode, etc.)
2. Frontend POSTs to `/api/agent/analyze-plan`
3. Backend validates the request with Zod
4. Backend generates context data (ETA, venue hours, distance — currently simulated/mock)
5. If `TINYFISH_API_KEY` is set, calls TinyFish API for AI analysis; otherwise uses mock analysis
6. Returns `AnalysisResult` with context summary, risks, suggestions, reasoning, and overall status
7. Frontend renders results in card-based layout

### Database
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Defined in `shared/schema.ts` — currently minimal (User types defined but storage uses in-memory `MemStorage`)
- **Migrations**: Managed via `drizzle-kit push` command
- **Connection**: Requires `DATABASE_URL` environment variable
- **Note**: The database is configured but not heavily used yet. The current storage layer (`server/storage.ts`) is an empty in-memory implementation. The database infrastructure is in place for future expansion.

### Build System
- **Development**: `npm run dev` — runs tsx with Vite middleware for HMR
- **Production Build**: `npm run build` — Vite builds client to `dist/public/`, esbuild bundles server to `dist/index.cjs`
- **Type Checking**: `npm run check` — runs tsc with noEmit
- **Database**: `npm run db:push` — pushes schema to database

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets` → `attached_assets/`

## External Dependencies

### TinyFish API
- **Purpose**: AI agent backend for plan analysis
- **Endpoint**: `https://agent.tinyfish.ai/v1/automation/run-sse`
- **Auth**: API key via `TINYFISH_API_KEY` environment variable
- **Fallback**: When no API key is set, the server generates realistic mock analysis data so the app is fully functional as a demo
- **Integration Point**: `server/routes.ts` — `callTinyFish()` function

### PostgreSQL Database
- **Connection**: Via `DATABASE_URL` environment variable
- **Session Store**: `connect-pg-simple` is included as a dependency for session storage
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration

### Redis Cache Layer
- **Purpose**: Performance optimization — caches TinyFish API results, session context, and agent state
- **Connection**: Via `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` environment variables (secrets)
- **Module**: `server/redis.ts` — provides `cacheGet/Set`, `sessionGet/Set`, `agentStateGet/Set` helpers
- **TTLs**: Analysis cache 600s, sessions 3600s, agent state 1800s
- **Fallback**: Gracefully degrades if Redis unavailable — app works without caching
- **Cache Key**: MD5 hash of plan parameters for deterministic cache hits
- **Session ID**: IP + User-Agent hash (server-side only, no cookies)
- **Test Endpoints**: `/api/cache-test`, `/api/agent-memory-test`, `/api/redis-status`

### Environment Variables
| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TINYFISH_API_KEY` | No | TinyFish AI API key (falls back to mock data if not set) |
| `REDIS_HOST` | No | Redis server hostname |
| `REDIS_PORT` | No | Redis server port |
| `REDIS_PASSWORD` | No | Redis authentication password |
| `SESSION_SECRET` | No | Session signing secret |

### Key NPM Dependencies
- **Frontend**: React, Vite, TanStack React Query, Wouter, React Hook Form, Radix UI, Tailwind CSS, Lucide icons, Recharts, Leaflet + react-leaflet (map picker)
- **Backend**: Express 5, Drizzle ORM, Zod, pg (node-postgres), ioredis (Redis client)
- **Shared**: Zod for schema validation across client/server boundary