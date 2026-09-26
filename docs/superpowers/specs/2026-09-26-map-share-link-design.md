# Single-map read-only share link

Date: 2026-09-26
Status: approved, awaiting implementation

## Problem

Both maps live on one platform. A map needs to be sent to a specific person
(buyer, agent, colleague) without exposing the other map, and the recipient must
not be able to edit anything.

Today the public page at `/` accepts `?map=<slug>` and falls back to the default
map, but a recipient of a shared link also gets three ways to leave that map:

- the map switcher in the sidebar (`components/MapWithSidebar.tsx:69`), which
  lists every map and lets them navigate to the other one
- the header nav, which hardcodes links to "JALI Map", "Map 2" *and* "Admin
  Panel" (`components/Header.tsx:17-21`) on both desktop (`:47-59`) and mobile
  (`:87-98`)
- an "Edit in Admin" link (`components/MapWithSidebar.tsx:189`)

None of these is a security problem. All three are wrong for a share link, where
the whole point is "here is one map, look at it". The header nav is the most
damaging of the three, because it is the first thing a recipient sees and it
offers both the other map and the admin surface one click away.

## Decision

An **unlisted** share link: a dedicated route that renders exactly one map with
no way to navigate to another.

The link is not secret. Anyone who receives it can view that map. This is a
deliberate choice, not an oversight - see *Security posture*.

## Non-goals

- **Real confidentiality.** The map data is already readable by anyone on the
  internet (see *Security posture*). Making it genuinely private is a separate,
  much larger piece of work and is explicitly deferred.
- **Any schema, RLS, or auth change.** This feature adds no table, no policy, no
  token, no cookie, and no credential.
- **Changing the existing public site.** `/` keeps its current behaviour
  (switcher visible, `?map=` supported, unknown slug falls back to default).
- **A per-user or per-map edit-permission system.** Not what was asked for, and
  not needed to satisfy the request.

## Approaches considered

### Chosen: dedicated route `/m/[slug]`

A new route `app/m/[slug]/page.tsx` renders one map, with the header nav, the
switcher and the "Edit in Admin" link suppressed. Share URL becomes `/m/map-2`.

- Explicit and self-documenting: the URL says what it is.
- Cannot degrade into a two-map page, because the route has no switcher at all.
- Independent of the main site, so the two cannot interfere.

### Rejected: `?map=map-2&share=1` on the existing page

Cheaper, but the flag is cosmetic. The recipient can drop `&share=1` and get the
switcher back, and the header brand links to `/` where the default map renders.
It would look like it worked while not actually sharing only one map.

### Rejected: token-gated link

A secret in the URL. Gives the *appearance* of access control while the data
stays directly queryable (see below), so it is security theatre. Rejected.

## Design

### Route: `app/m/[slug]/page.tsx`

1. Read the `maps` row whose `slug` equals the route param.
2. **Unknown slug returns 404.** No fallback to the default map. On a share link
   a typo must fail loudly: silently rendering a different map would let a
   recipient accept the wrong map as the one they were sent. This is a
   deliberate difference from `/`, where the fallback is a convenience for
   normal browsing.
3. Load that map's plots, same query as `app/page.tsx` (`.eq("map_id", …)`).
4. Render the same `Header` and `MapWithSidebar` the public page uses, passing
   `minimal` to `Header` and `showMapSwitcher={false}` to `MapWithSidebar`.
5. Plot selection, the detail panel and the Plot Area Statement keep working
   unchanged - that is the reason the map is being shared.

The route is map-agnostic: it renders whatever slug is requested, so a future
`/m/map-3` needs no code change.

### Change: `showMapSwitcher` prop on `MapWithSidebar`

Add an optional prop, defaulting to the current behaviour, so the share route can
suppress the switcher.

The switcher is already guarded by `maps.length > 1`
(`components/MapWithSidebar.tsx:69`), so passing an empty `maps` array would
suppress it today with no change to that component. That is not used, because the
share route's correctness would then depend on an unrelated guard. If that guard
is ever relaxed, the share link would silently start showing every map. An
explicit prop states the intent at the call site and fails loudly instead.

The "Edit in Admin" link is suppressed on the same flag. It is harmless for a
non-admin (it leads to the login page), but on a share link it is noise, and it
advertises that an editing surface exists.

### Change: `minimal` prop on `Header`

Add an optional `minimal` flag, defaulting to the current behaviour, so the share
route can render a header with no navigation. When set it:

- keeps the brand block, so the page does not look broken or unbranded
- drops the desktop nav, the "Contact" link and the divider
- drops the mobile hamburger, since the mobile menu renders the same `nav` array
  (`components/Header.tsx:87-98`) and would otherwise open onto an empty panel
- renders the brand as plain text rather than a `Link` to `/`

That last point is a change from the first draft of this spec, which left the
brand link in place. Once the rest of the nav is hidden, leaving a working link
to `/` in the top-left would be a half-measure: everything else on the page
deliberately keeps the recipient on one map, and the logo would be the one
control that undoes it.

## Security posture

Stated plainly so nobody is misled:

- **The share link is unlisted, not secret.** Whoever has the URL can view that
  map. Do not treat it as confidential, and do not post it publicly.
- **The recipient cannot edit.** They are not in `public.admins`, so RLS denies
  every write on `plots` (`supabase/schema.sql:151-158`). Hiding the controls is
  cosmetic; the actual boundary is RLS. The verification below therefore tests
  the server path, not the absence of a button.
- **The data is already reachable without this link.** The `plots` SELECT policy
  is `USING (true)` and the anon publishable key ships in the client bundle
  (`NEXT_PUBLIC_*` is public by definition), so anyone can query the database
  directly, bypassing this app entirely. That is why an in-URL token would add no
  real protection. If the data ever needs to be genuinely private, the SELECT
  policies must change and `anon` database access must be revoked - which would
  also affect the public site, and is the deferred work noted under
  *Non-goals*.

## Verification

1. Share URL loads logged out, renders the requested map, and shows no switcher,
   no "Edit in Admin" link, and no header nav on desktop or mobile (the mobile
   hamburger is absent too, so the menu cannot be opened onto the hidden nav).
2. The brand is not a link on the share page, so the recipient has no control that
   returns them to the multi-map site.
3. Plot selection and the detail panel work on the share URL.
4. `/m/not-a-map` returns 404.
5. `/` is unchanged: header nav and switcher present, `?map=map-2` still works,
   unknown slug still falls back to the default map.
6. **Negative write test:** with a non-admin viewer session, `PATCH
   /api/plots/<id>` is rejected (401/403) and the row in the database is
   unchanged. Confirmed at the API/RLS layer, not inferred from the UI.
7. `/m/jali` renders JALI, confirming the route is not hardcoded to Map 2.

## Rollback

Delete `app/m/[slug]/page.tsx` and revert the two props. No migration, no data
change, no state to unwind. The public site is untouched the whole time, so
nothing else needs to be undone.
