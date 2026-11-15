# SANAD AI — سند

Accessible Arabic-first web app built with React, TypeScript and Vite.

## Local development
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`.

## Deploy to Vercel
- Import this GitHub repository in Vercel.
- Framework preset: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.
- Add `OPENAI_API_KEY` in Vercel Project Settings → Environment Variables.
- Redeploy after adding the variable.

The API key must remain server-side. Never add it to `src/`, `index.html`, or a committed `.env` file.

## Live camera
The browser asks permission to use the rear camera. While running, the app sends a reduced JPEG frame to `/api/describe` about every 4.5 seconds. Frames are not stored by this app; they are sent to the configured vision provider for analysis. Stop the camera to end capture and speech.

This is an experimental accessibility aid. AI descriptions can be wrong or miss hazards. Do not rely on it as the sole means of navigation or safety.
