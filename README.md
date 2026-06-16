# NexusAdmin — Backend

Node.js / Express / MongoDB API with Socket.IO and JWT auth.
This folder is **self-contained**: `package.json` is at the top level, so it
deploys with **no Root Directory setting**.

## Deploy to Render

1. Push this folder to its own GitHub repo (so `package.json` is at the repo root).
2. Render → **New → Web Service** → connect the repo.

| Setting | Value |
|---|---|
| Root Directory | *(leave blank)* |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | Free |

3. Add environment variables:

```
NODE_ENV=production
MONGODB_URI=<your MongoDB Atlas connection string>
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=<strong password>
FRONTEND_URL=<your Vercel URL, e.g. https://your-app.vercel.app>
CLOUDINARY_CLOUD_NAME=   # optional (media uploads)
CLOUDINARY_API_KEY=      # optional
CLOUDINARY_API_SECRET=   # optional
```

Do **not** set `PORT` — Render injects it; `server.js` reads `process.env.PORT`.

4. Deploy. Test `https://<your-service>.onrender.com/api/health` → `{"status":"ok"}`.
5. Seed the database once: open the **Shell** tab and run `npm run seed`.

> Note: `Dockerfile` / `.dockerignore` are only for self-hosted Docker. Render
> uses the Node build above and ignores them.

## Run locally

```bash
cp .env.example .env     # set MONGODB_URI, JWT_SECRET, etc.
npm install
npm run seed             # first run only
npm run dev              # nodemon on :5000
```

## Auth endpoints & seeded accounts

After `npm run seed`:

- **Super admin** — `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default `admin@nexusadmin.com` / `Admin@123456`)
- **Demo customers** — `ava@example.com`, `liam@example.com` (password `Customer@123`), visible under `GET /api/customers`

Auth flow:

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/setup` | One-time bootstrap of the first super_admin (only when no users exist) |
| `POST` | `/api/auth/login` | Returns `{ token, refreshToken, user }` |
| `POST` | `/api/auth/refresh` | Body `{ refreshToken }` → new `{ token, refreshToken }` |
| `GET`  | `/api/auth/me` | Current user (Bearer token) |
| `POST` | `/api/auth/register` | super_admin/admin create staff users |
| `POST` | `/api/auth/change-password` | Bearer token |

See `FIXES.md` for the full list of issues found and corrected.
