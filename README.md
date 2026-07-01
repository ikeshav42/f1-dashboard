# F1 Live Dashboard

A Formula 1 live timing dashboard built to learn Next.js and Python serverless functions. Uses the free [OpenF1 API](https://openf1.org) — no auth needed.

## What it does

- **Live leaderboard** — driver positions, gaps, intervals, sector times, tyre compound, pit status, updated every 4 seconds
- **Race schedule** — current/upcoming race weekend sessions with live countdown
- **History tab** — browse past grands prix, pick any session, see final results
- **Lap time charts** — line chart of every driver's lap times with Safety Car / VSC periods highlighted

## Stack

- **Frontend**: Next.js, React, Tailwind CSS, Recharts
- **API**: Python serverless functions (Vercel), httpx
- **Data**: OpenF1 public API (free, no key required)

## Running locally

```bash
# Install and start the frontend
npm install
npm run dev
```

The frontend will call `/api/*` which Vercel routes to the Python functions in `api/`. For local development you can also run a separate FastAPI backend and point `NEXT_PUBLIC_API_URL` at it.

Open `http://localhost:3000`

## Deploying

Import this repo on [vercel.com](https://vercel.com) and click Deploy — that's it.

- Next.js frontend is auto-detected at the repo root
- Python files in `api/` become serverless functions automatically
- No environment variables needed

## Architecture

```
OpenF1 API  ←—— Python serverless functions (api/)  ←—— Next.js frontend (polls every 4s)
```

Each `api/*.py` file is a Vercel serverless function. Vercel CDN caches responses (15s for live data, 1h+ for historical) so the OpenF1 rate limit is never an issue.

## Things I learned

- Vercel Python serverless functions alongside a Next.js app
- CDN caching with `Cache-Control: s-maxage` to avoid hitting rate limits
- Recharts for data viz — filtering pit laps, detecting SC/VSC from race control messages
- Next.js custom hooks to keep page components clean
- OpenF1 quirks (null lap durations on the final lap, session_key=latest behaviour across endpoints)
