# Fixes applied

Deep analysis of the original code found the backend **parsed and booted**, but
contained one feature-breaking logic bug, one auth bug that only bites without a
configured `.env`, a missing endpoint implied by the config, and a few
correctness/robustness gaps. All are fixed below. Every `.js` file passes
`node --check`, the full server boots with all **52 endpoints** mounting cleanly,
all local `require`s resolve, and every external package used is declared in
`package.json`.

## 1. Customers & customer analytics were always empty (critical)
The `User` role enum was `['super_admin','admin','manager','editor','support']`
— there was **no `customer` role**. Yet `routes/customers.js` and
`routes/analytics.js` selected customers with
`role: { $nin: [...all five staff roles...] }`, which excludes every valid role,
so the query could never match anyone. The seeder even created demo "customers"
with `role: 'support'` (with a comment admitting the mismatch) — and `support`
is one of the excluded roles.

Result: the Customers page returned `[]` forever and `analytics/overview`
reported `0` customers.

Fixes:
- `models/User.js` — added `'customer'` to the role enum.
- `routes/customers.js` — list now filters `{ role: 'customer' }` (and the
  pagination payload now includes `limit`, matching the other list endpoints).
- `routes/analytics.js` — `totalCustomers` counts `role: 'customer'`;
  `newCustomers` is now scoped to customers (it previously counted *all* new
  users, including staff/admins).
- `config/seed.js` — demo customers are created with `role: 'customer'`.

## 2. Auth broke in dev when `JWT_SECRET` was unset
`routes/auth.js` signs tokens with a fallback secret (`'dev_secret_change_me'`),
but `middleware/auth.js` verified with `process.env.JWT_SECRET` directly (no
fallback). Without a configured `.env`, login succeeded but **every** protected
request then failed verification with 401. The middleware now uses the same
fallback, so signing and verifying always agree. (In production both sides read
the real `JWT_SECRET`, so behavior there is unchanged.)

## 3. Missing refresh-token endpoint (implied by config)
`.env.example` and the README define `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRE`,
but no refresh flow existed. Added (backward-compatible):
- `POST /api/auth/login` and `POST /api/auth/setup` now also return
  `refreshToken`.
- New `POST /api/auth/refresh` — verifies a refresh token, checks the user is
  still active, and issues a fresh access token (with a rotated refresh token).

## 4. Homepage `Mixed`/nested edits could silently not persist
Section edits mutate subdocument fields in place, and `section.config` is a
`Mixed` type. Mongoose does not reliably detect in-place changes to `Mixed`/
nested paths, so edits could be dropped on `save()`. Added
`hp.markModified('sections')` before save in the update-section, toggle-section,
and edit-slide handlers.

## 5. Category rename didn't update the slug; duplicates threw raw 500s
`PUT /api/categories/:id` used `findByIdAndUpdate`, which bypasses the
`pre('save')` slug hook — so renaming a category left a stale slug. The handler
now regenerates the slug when `name` is provided, returns 404 when the id is not
found, and maps duplicate-key errors (code 11000) to a clean 400 on both create
and update.

## 6. Cleanup
Removed the deprecated `useNewUrlParser` / `useUnifiedTopology` options from both
`mongoose.connect()` calls (no-ops that only produce warnings on Mongoose 8).

## Notes (not bugs)
- `express-validator` and `multer-storage-cloudinary` are declared in
  `package.json` but not used anywhere. They are harmless; left in place.
- `routes/products.js` registers `GET /:id` before `GET /export/csv`. This is
  safe — `:id` only matches a single path segment, so the two-segment
  `/export/csv` is never shadowed (verified in the route table).
