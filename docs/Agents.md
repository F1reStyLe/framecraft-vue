# FrameCraft frontend — agent context

## Project purpose

This repository contains a minimal Vue 3 + TypeScript MVP frontend for manually trying the local FrameCraft backend API.

It is not a production frontend and not a marketing landing page. The current goal is a simple user-facing MVP screen where someone can register or log in through Auth Service, create a workspace, refresh the workspace list, and inspect the selected workspace.

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

The backend OpenAPI contracts are the source of truth for frontend API work. Always check them before implementing or changing an endpoint integration:

```text
C:/Users/ulian/Desktop/Git/FrameCraft/openapi/openapi.yaml
C:/Users/ulian/Desktop/Git/authserver/internal/transport/http/swagger/openapi.yaml
```

FrameCraft API runs locally at `http://localhost:8180`. Auth Service API runs locally at `http://localhost:8080` and is proxied by Vite from `/auth-api`.

Do not duplicate Auth Service password-validity rules in the frontend. Send the password to Auth Service and display its validation error response to the user.

## Implemented frontend stack

- Vue 3
- Vite
- TypeScript
- Composition API
- Native `fetch`
- No Vue Router
- No Pinia

`App.vue` coordinates feature state. UI areas are isolated into components:

```text
src/components/AppHeader.vue
src/components/HomeHero.vue
src/components/WorkspaceCreateForm.vue
src/components/WorkspaceList.vue
src/components/TextChat.vue
src/components/MediaLibrary.vue
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

1. Register or log in through the toolbar.
2. Create a workspace.
3. Refresh/list workspaces.
4. Select a workspace card and view details.


## Implemented sections

The current screen includes:

1. API Status
   - `GET /health/live`
   - `GET /health/ready`
   - automatically checked on mount
   - displayed as a compact backend readiness state

2. Authentication toolbar
   - registration with username, email, and password
   - login by email or username and password
   - logout revokes the refresh session
   - access and refresh tokens are stored in browser cookies; protected requests attach the bearer header automatically
   - password validity is checked only by Auth Service

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

Registration, login, and logout are implemented through Auth Service. Access and refresh tokens are stored in browser cookies; protected FrameCraft requests use the saved access token automatically.

Frontend-created cookies use `SameSite=Lax` and `Secure` on HTTPS. They cannot be `HttpOnly` while Auth Service returns tokens in a response body; that final hardening requires Auth Service to issue the cookie itself.

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

- user management
- mocked backend responses
- routing
- global state store
- explicit manual `GET /v1/workspaces/{workspaceID}` panel

## Content and media API coverage

The MVP UI now covers content project creation/listing, status updates, deletion, text generation,
and text-version listing. Structured generation input is validated as JSON and against the 16 KiB
contract limit.

Media UI supports image-only upload, cursor pagination, workspace summary, original/thumbnail
presigned links, and soft deletion. The browser input follows the backend `image/*` MIME restriction.

## Quality checks

- `npm test` verifies API-response parsing used by both API clients.
- `npm run verify:contract` reads the live FrameCraft OpenAPI endpoint and validates the paths and media fields used by the frontend.
