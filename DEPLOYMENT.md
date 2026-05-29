# Deployment Guide

This application consists of a React Vite frontend and an Express Node.js backend (`server.ts`).

## Deploying to Netlify (Frontend)

Netlify is excellent for hosting the React SPA frontend. However, because Netlify does not natively support long-running Node.js processes or WebSocket connections for backend servers, you MUST deploy your backend separately.

### Step 1: Deploy the Backend
Deploy your codebase (specifically the Express server built from `server.ts`) to a platform that supports persistent Node.js instances and WebSockets.
Recommended providers:
- **Render** (Web Service)
- **Railway**
- **Heroku**
- **Fly.io**

Make sure your backend service runs the `npm start` command (which runs `node dist/server.cjs`).

### Step 2: Configure Netlify (Frontend)
1. Import your repository into Netlify.
2. In the site settings, configure the build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Add an Environment Variable in the Netlify dashboard:
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** The public URL of your deployed backend (e.g., `https://your-backend-app.onrender.com`).
   *Note: Ensure there is no trailing slash.*

The `netlify.toml` file in this repository is already pre-configured to handle SPA routing for your Netlify deployment.

## How it works

The frontend code uses the `VITE_BACKEND_URL` environment variable to locate your Express backend API and WebSocket server automatically. If `VITE_BACKEND_URL` is omitted (e.g. during local development), it automatically falls back to `window.location.origin`.

```javascript
const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
```
