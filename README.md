# Core 3.0 Compliance

Admin dashboard for Aurora Robotics training enrollments. It talks only to the shop API under `/api/v1` through a server session. There is no local sample data.

## Run

```bash
bun install
bun run dev
```

The dev server listens on port 4317.

Copy `.env.example` to `.env`.

| Variable | Purpose |
| --- | --- |
| `BACKEND_URL` | API origin, no trailing slash. Every request goes to `${BACKEND_URL}/api/v1`. Swagger JSON is `${BACKEND_URL}/docs/swagger/json`. |
| `SESSION_SECRET` | At least 32 characters. Signs the httpOnly session cookie. |

Sign in with a real staff email and password. The form posts to `/auth/login`. Access and refresh tokens stay in the `aurora_session` cookie. The browser calls server functions, and file or CSV downloads go through `/api/bff`. `/auth/login` and `/auth/refresh` are not proxied to the browser.

If the API is down, pages show that the server could not be reached. Empty lists say so, for example "No enrollments yet".

The viewer role reads enrollments with PII masked. The manager can re-verify, refund, send email, and handle data requests. Course prices and organization settings stay with super admin.

## Courses

Drafts and closed courses may exist with no price. The catalogue shows **No price set** when `price` is null. A free course is `price` 0 and `isFree` true. Opening a paid course sends `status: open`. If it is still unpriced, the API responds 400 and the drawer shows that message.

## Regenerate the API types

```bash
BACKEND_URL=http://localhost:3000 bun run openapi
```

That writes `src/services/api/_generated/schema.ts` from `${BACKEND_URL}/docs/swagger/json`.

## Deploy on Netlify

`netlify.toml` sets the build command (`bun run build`) and publish directory (`dist/client`). The `@netlify/vite-plugin-tanstack-start` plugin writes the SSR server function to `.netlify/v1/functions`. Set `BACKEND_URL` and `SESSION_SECRET` in the Netlify environment variables; they are read at runtime by the server.

## Checks

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```
