<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/21300dad-de87-4d82-82cb-d401da87c516

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Frontend/backend API wiring

By default the React app calls the Express API on the same origin (`/api/...`). If
`nexus-backend` is deployed as a separate Render Web Service, set
`VITE_NEXUS_API_BASE_URL` to that service URL before building the frontend, for
example:

```bash
VITE_NEXUS_API_BASE_URL="https://nexus-backend.onrender.com" npm run build
```

The server exposes `GET /api/stats`, which the UI polls every 30 seconds for the
live Investigations, Files, and Data Points counters. If the backend is not
reachable, the UI falls back to local workspace counts and labels the widget as
`Local` instead of `API`.
