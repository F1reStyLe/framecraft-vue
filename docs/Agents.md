# FrameCraft frontend — agent context

## Project purpose

This repository contains a minimal Vue 3 + TypeScript MVP frontend for manually trying the local FrameCraft backend API.

It is not a production frontend and not a marketing landing page. The current goal is a simple user-facing MVP screen where someone can paste a JWT token, create a workspace, refresh the workspace list, and inspect the selected workspace.

FrameCraft product context:

- backend for beauty professionals and small studios;
- long-term workflow: idea -> text -> image -> editing -> publication preparation -> publication -> autoposting;
- target users include manicure, pedicure, lashes, brows, cosmetology, epilation, hair, makeup, massage specialists, and small beauty studios.

## Current backend assumptions

Local backend base URL:

```text
http://localhost:8180
```

Swagger UI:

```text
http://localhost:8180/swagger
```

OpenAPI YAML:

```text
http://localhost:8180/swagger/openapi.yaml
```

The implementation was aligned with the OpenAPI contract provided at:

```text
C:/Users/iwgw/Downloads/openapi.yaml
```

## Implemented frontend stack

- Vue 3
- Vite
- TypeScript
- Composition API
- Native `fetch`
- No Vue Router
- No Pinia

The code is intentionally compact and direct. Most UI behavior lives in:

```text
src/App.vue
```

Small shared pieces:

```text
src/api.ts
src/config.ts
src/types.ts
src/styles.css
```

## Current UI direction

The interface was originally implemented as a raw API testing dashboard, then revised toward a more product-like MVP flow.

The first viewport should feel like a small FrameCraft workspace product surface, not like a Swagger replacement.

Primary flow:

1. Paste and save JWT token.
2. Create a workspace.
3. Refresh/list workspaces.
4. Select a workspace card and view details.

Technical/debug details are still available, but they are intentionally hidden behind a collapsible "technical response" drawer.

## Implemented sections

The current screen includes:

1. API Status
   - `GET /health/live`
   - `GET /health/ready`
   - automatically checked on mount
   - displayed as a compact backend readiness state

2. JWT Token
   - manual access-token textarea
   - Save Token
   - Clear Token
   - token is stored in `localStorage`

3. Create Workspace
   - `POST /v1/workspaces`
   - request body:

```json
{
  "name": "My Beauty Studio",
  "type": "personal",
  "timezone": "Europe/Moscow",
  "locale": "ru-RU"
}
```

4. Workspace List
   - `GET /v1/workspaces`
   - expects response shape:

```json
{
  "workspaces": []
}
```

5. Workspace Detail
   - currently driven by selecting a workspace from the loaded list
   - no separate manual detail request in the MVP UI

6. Last Response / Debug
   - latest request method
   - URL
   - status code
   - response JSON
   - error JSON
   - hidden in a collapsible drawer

## Auth notes

Protected requests send:

```text
Authorization: Bearer <saved-token>
```

Auth service, registration, login, refresh token, and user management are intentionally not implemented.

Important identity detail:

- user id comes from JWT `sub`;
- `sub` is a string, for example `"3"`;
- frontend must not treat user id as UUID;
- `workspaceID` is a UUID.

## Workspace contract notes

`Workspace` fields expected by the frontend:

- `id`
- `name`
- `type`
- `timezone`
- `locale`
- `role`
- `created_by`
- `created_at`
- `updated_at`

`created_by` is treated as a string because the OpenAPI contract describes it as a stable external JWT subject.

## Configuration

API base URL is configured in:

```text
src/config.ts
```

Default behavior:

```text
development: /api
production: http://localhost:8180
```

Environment variable:

```text
VITE_API_BASE_URL
```

Example file:

```text
.env.example
```

In local dev, prefer the Vite proxy to avoid browser CORS issues:

```env
VITE_API_BASE_URL=/api
```

The proxy is configured in:

```text
vite.config.ts
```

and maps:

```text
/api -> http://localhost:8180
```

## Local commands

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

Build check:

```bash
npm run build
```

The build was verified successfully after implementation.

## Current repository state notes

This project was created in an initially empty git repository except for `.git`.

Files added include:

- `.env.example`
- `.gitignore`
- `README.md`
- `env.d.ts`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig*.json`
- `vite.config.ts`
- `src/*`
- `docs/Agents.md`

Generated folders such as `node_modules` and `dist` exist locally after install/build and are ignored by git.

## Deliberately not implemented

- registration/login UI
- refresh token flow
- user management
- mocked backend responses
- routing
- global state store
- media API UI
- explicit manual `GET /v1/workspaces/{workspaceID}` panel

Media endpoints exist in the provided OpenAPI contract, but detailed request/response schemas were not defined, so the minimal test panel currently focuses on health and workspace endpoints only.
