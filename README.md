# FrameCraft API Test Panel

Vue 3 + TypeScript MVP frontend for testing the local FrameCraft backend: authentication,
workspaces, content projects, AI text generations and image media assets.

## Run locally

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173

Backend default: http://localhost:8180

The API base URL is configured with `VITE_API_BASE_URL`.

```bash
cp .env.example .env.local
```

In local dev, use the Vite proxy to avoid CORS:

```env
VITE_API_BASE_URL=/api
```

The Vite dev server proxies `/api` to `http://localhost:8180`.

If backend CORS is enabled, direct requests are also possible:

```env
VITE_API_BASE_URL=http://localhost:8180
```
