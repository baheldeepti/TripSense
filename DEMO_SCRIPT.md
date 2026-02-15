# TripGuard - 3 Minute Hackathon Demo Script

## [0:00 - 0:20] Opening Hook

"Have you ever driven 45 minutes to a restaurant only to find out it's closed? Or rushed to the airport only to learn your flight was delayed by 2 hours? We've all been there. That's why we built **TripGuard** — an AI-powered trip intelligence platform that tells you what's going to go wrong *before* you leave."

---

## [0:20 - 0:50] The Problem

"Every day, millions of people waste time on poorly planned trips. They don't check venue hours. They don't account for traffic. They don't know their flight is delayed until they're already at the gate. The information exists out there — but nobody pulls it all together in one place, in real time, to tell you: *should you actually leave right now?*"

"TripGuard solves this."

---

## [0:50 - 1:20] Live Demo — Setting Up a Trip

*Open the app, show the home page with the sunset gradient branding*

"Let me show you. Say I need to get to JFK Airport to catch a 6 PM Delta flight."

*Click on the destination map — search for 'JFK Airport' and select it*

"I pick my destination right on the map — just like Uber. TripGuard auto-fills the address, city, state, and zip code using reverse geocoding from OpenStreetMap."

*Show the auto-filled address fields*

"Notice what just happened — TripGuard **detected** that I'm going to an airport. It's now asking me: *Heading to the airport? Are you catching a flight, or picking someone up?*"

*Click 'Catching a flight', enter airline 'Delta', flight number '1842', destination 'Los Angeles'*

"I tell it I'm catching Delta flight 1842 to LA. The banner now shows 'Catching a Flight' with all my details. And if I need to change anything — I just tap the pencil icon to edit."

*Show the edit pencil icon on the flight banner*

---

## [1:20 - 1:50] Live Demo — Starting Location & Details

*Click on the starting location map — search for your location and select it*

"I set my starting point the same way — full map support for both locations. TripGuard calculates the real distance using my actual coordinates."

*Select transport mode 'Driving', set departure date and time*

"Driving, leaving today at 2:30 PM. Let me hit **Analyze My Plan**."

*Click the analyze button, show loading state*

---

## [1:50 - 2:30] Live Demo — Results

*Results appear with status, risks, suggestions*

"Here's what TripGuard found — and this is the magic."

*Point to the context summary card titled 'Catching Your Flight'*

"The summary shows my departure time, drive time, and arrival at the airport — all in my local timezone. It shows my flight details and how much buffer time I have."

*Point to risk cards*

"It found **real-time flight data** — Delta 1842 is delayed by 35 minutes, now departing at 6:35 PM. It checked this *live* by scraping flight status sites using our TinyFish AI agent. That's not a database — that's real-time web intelligence."

*Point to suggestions*

"Smart suggestions in plain English: since my flight is delayed, it says I can leave 30 minutes later. It even reminds me to check in online and have my boarding pass ready."

*Point to reasoning card*

"Full transparency — you can see exactly how the AI reasoned through this. No black box."

---

## [2:10 - 2:30] Bonus — Pickup Mode

*Go back, change the airport to pickup mode*

"Now let me show you pickup mode. Say my friend is flying in on United 302, landing at 5:15 PM."

*Click edit on flight banner, switch to 'Picking someone up', enter details*

"TripGuard calculates that they'll be at the curb around 5:45 PM — 30 minutes after landing for deplaning and baggage. It tells me exactly when to leave and suggests I wait at the cell phone lot until they text me. No more circling arrivals."

---

## [2:30 - 2:50] Technical Highlights

"Under the hood:"

"**React and TypeScript** frontend with a custom sunset-to-violet design system. **Express** backend. **Leaflet and OpenStreetMap** for zero-cost mapping with no API key required. **Haversine formula** for real distance calculation from map coordinates. **TinyFish AI** as our web scraping agent — it browses the real web to get live flight status, venue hours, and conditions. **Redis** for caching so repeat queries are instant. Full **timezone detection** so times always display in your local zone. And the entire app works in **demo mode** without any API keys — progressive enhancement built in."

---

## [2:50 - 3:00] Closing

"TripGuard turns your phone into a trip advisor that actually knows what's happening *right now*. No more wasted trips. No more surprises at the gate. Just smarter decisions before you walk out the door."

"This is **TripGuard**. Thank you."

---

## Presenter Tips

- **Keep the map interactions smooth** — practice the search and click flow beforehand
- **Have a real flight number ready** — look up an active flight before the demo for dramatic effect
- **Show the edit button** — demonstrate editing flight details from the banner (pencil icon)
- **Show pickup mode** — the curb-time calculation and cell phone lot tip are crowd-pleasers
- **If TinyFish is slow** — talk through the loading state: "It's browsing the web right now, checking live flight data..."
- **Highlight the airport auto-detection** — this is an "aha" moment for the audience
- **Show dark mode** — toggle it quickly at the end if you have a spare second, it looks impressive
- **Backup plan** — the app works fully without API keys using mock data, so even if the API is down, the demo still flows
