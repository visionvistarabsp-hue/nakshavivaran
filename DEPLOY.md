# Deployment

## Runtime

- Node 20 (`.nvmrc`, and `engines.node` in `package.json`).
- `npm run build` is `rimraf .next && next build`. The `rimraf` matters: building
  over a stale `.next` on a OneDrive-synced folder fails with
  `EINVAL ... functions-config-manifest.json`.

## Environment variables

Both are **publishable** (client-safe) keys. There is deliberately no
`SUPABASE_SERVICE_ROLE_KEY` anywhere in the app - it must never be present, and
nothing should be prefixed `NEXT_PUBLIC_` except these two.

| Name | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Read on both server and client. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key. Public RLS is the only thing standing between a visitor and the data, which is why the RLS setup below matters. |

Set them in **Vercel → Project → Settings → Environment Variables** for all three
environments (Production, Preview, Development). Copy the same two values from
`.env.local` for local development.

No `vercel.json` is needed. The GitHub–Vercel integration builds on push; the
project's framework preset should already be Next.js with `npm run build` and
output `.next`.

## Data layer

The live database is already migrated. `supabase/schema.sql` is the source of
truth for the same state, and is written to be re-runnable from scratch on a new
project. To apply it to a fresh Supabase project, run it once in the SQL editor
**before** the app is deployed, otherwise the app has no `maps` table.

### Who can write

Reads are public. Writes are not - this is enforced in the database, not in the
app, so it holds even for someone calling the REST API directly with the
publishable key:

- `public.plots` allows `SELECT` to everyone.
- `INSERT` / `UPDATE` / `DELETE` require `public.is_admin()`.
- `public.is_admin()` is `SECURITY DEFINER` with a pinned `search_path`, returns
  whether `lower(auth.jwt() ->> 'email')` appears in `public.admins`, and is
  executable only by the `authenticated` role - not by `anon`.
- `public.admins` has row-level security enabled and **no** client policy at
  all. Nothing reads it directly; the `SECURITY DEFINER` function does, with
  elevated privileges. There is no way to add or remove an admin through the API.

Because the allowlist is a table rather than a code constant, adding an admin is
a single row insert and revoking one is a single row delete. Both are done in the
Supabase SQL editor or dashboard - never from the client.

### Adding an admin

1. Create the user under **Authentication → Users → Add user**. Confirm the email
   so `auth.jwt() ->> 'email'` is populated, and set a password.
2. Add the address to the allowlist:

```sql
INSERT INTO public.admins (email) VALUES ('you@example.com');
```

The comparison lowercases the JWT claim, so casing on insert does not matter.

> Adding the Auth user alone is not enough, and the failure is silent by design:
> the user can sign in successfully but every write returns
> `Unauthorized: admin sign-in required`. That is the allowlist doing its job.

### Removing an admin

```sql
DELETE FROM public.admins WHERE email = 'you@example.com';
```

## Post-deploy check

Open the deployed site and confirm the map renders (the JALI background image
loads), then in the browser console:

```js
// must succeed
await fetch('/api/plots?map=map-2').then(r => r.status) // 200

// must fail
await fetch('/api/plots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ map: 'map-2', label: 'probe', polygon: [[0,0],[1,0],[1,1]] }),
}).then(r => r.status) // 401
```

If the background image 404s, `public/map_2.png` did not get committed - it is a
binary asset and has to be in the repository, not just present locally.
