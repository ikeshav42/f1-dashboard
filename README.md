# F1 Live Dashboard

A Formula 1 live timing dashboard I built to learn FastAPI and Next.js. Uses the free [OpenF1 API](https://openf1.org) — no auth needed.

## What it does

- **Live leaderboard** — driver positions, gaps, intervals, sector times, tyre compound, pit status, updated every 4 seconds
- **Race schedule** — current/upcoming race weekend sessions with live countdown
- **History tab** — browse past grands prix, pick any session, see final results
- **Lap time charts** — line chart of every driver's lap times across a race, with Safety Car / VSC periods highlighted as shaded bands

## Stack

- **Backend**: Python, FastAPI, httpx, uvicorn
- **Frontend**: Next.js, React, Tailwind CSS, Recharts
- **Data**: OpenF1 public API (free, no key required)

## Running locally

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# frontend (separate terminal)
cd nextjs
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if needed
npm run dev
```

Open `http://localhost:3000`

## Deploying

### Frontend → Vercel

1. Import this repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `nextjs`
3. Add environment variable: `NEXT_PUBLIC_API_URL` = your deployed backend URL
4. Deploy — Vercel handles the Next.js build automatically

### Backend

The backend is a long-running FastAPI server (background polling loop) so it needs a platform that supports persistent processes — Railway, Render, Fly.io, etc.

```bash
# Render / Railway start command
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Make sure to set CORS to allow your Vercel domain, or leave `allow_origins=["*"]` for now.

## Architecture

```
OpenF1 API  →  FastAPI backend (polls every 15s)  →  Next.js frontend (polls every 4s)
```

The backend keeps state in memory and serves it to the frontend. Historical session data is cached after the first fetch since past race data never changes.

## Things I learned

- How to build a polling architecture without websockets
- asyncio locks to serialise requests to an external rate-limited API
- Recharts for data viz — filtering pit laps using per-driver median, detecting SC/VSC from race control messages
- Next.js custom hooks to keep components clean
- OpenF1's quirks (non-standard country codes, null lap durations on the final lap, etc.)
