# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, build-less single-page web app to plan a Carretera Austral road trip. Three source files do everything: `index.html` (markup + the `#cardTemplate` `<template>`), `style.css`, and `app.js` (all logic). There is no package.json, no bundler, no test runner, and no framework — the only runtime dependency is the Supabase JS client loaded from a CDN `<script>` in `index.html`.

## Running / developing

Open `index.html` directly in a browser, or serve the folder to avoid file-URL quirks:

```powershell
python -m http.server 8000   # then open http://localhost:8000
```

There is no lint, build, or test step. Verification is manual in the browser.

## Architecture

`app.js` is a single module-less script driving the DOM imperatively. Key invariants to preserve when editing:

- **`state` is the one source of truth** — `{ schemaVersion, days[], items[] }`. Items reference a day via `item.dayId` (or `null` = "Sin asignar") and carry an `order` integer for intra-day sorting. Nearly every mutation funnels through **`markUnsaved()`**, which normalizes, bumps `changeSerial`, persists locally, and schedules autosave. After mutating `state`, call `markUnsaved()` then `render()` — don't write to the DOM as the source of truth.
- **`render()` is full re-render** — it wipes `#itinerary`/`#unassigned` and rebuilds every day column and card from `state`. There is no diffing; per-card event handlers are re-attached on each render inside `buildCard`. Which cards have their edit panel open survives a re-render via the module-level `expandedItems` Set (`buildCard` reads it; the ✎ button toggles membership). Inline edit fields use `change` events (fire on blur) so a full render won't interrupt typing.
- **`normalizeState()` and `sanitizeState()` are the validation gates.** `sanitizeState` runs on *every* untrusted boundary (localStorage read, Supabase load, JSON import) and clamps/repairs fields, dedupes ids, and enforces the place/trip shape. Any new field on an item or day must be threaded through both functions or it will be silently dropped.
- **Items have a `kind`: `'place'` or `'trip'`.** Trips (Traslado/Ferry) store `start`/`end` and derive `location` as `"start -> end"`; places leave those empty. `normalizeType`/`normalizeKind` map legacy/loose type strings onto the canonical set in `typeStyles`. Items also carry `cost` (CLP integer ≥ 0, via `sanitizeCost`/`formatCLP`), summed per-day in `getDaySummary` and per-plan in `updateStats`.
- **Destructive actions are undoable, not confirmed.** Deleting an item/day, "Reiniciar demo", and JSON import go through `runUndoableAction(mutate, {message})`, which snapshots `state` into `undoSnapshot` and shows an undo toast (`showToast`) instead of a `window.confirm`. Single-level undo only.

### Multi-plan model

The app manages several named plans (`PLAN_OPTIONS`: general, molina, inaki, nef, ross). Two storage layers:

- **localStorage** holds a *store* `{ selectedPlanKey, plans: { <key>: state } }` under `STORAGE_KEY`. `parseLocalStore` also migrates a legacy single-state blob into this shape.
- **Supabase** stores one row *per plan* in table `planner_state`, keyed by `id = SUPABASE_PLAN_PREFIX + planKey` (e.g. `carretera-austral-molina`), with the whole state in `state_json`. `switchToPlan` loads a plan (remote first, local fallback); `saveCurrentState` writes it back.

If you add or rename a plan key, you must update **three places**: `PLAN_OPTIONS` in `app.js`, the hard-coded id allowlists in the RLS policies in `supabase/schema.sql`, and (if seeding) `supabase/seed.sql`.

### Sync & conflict handling

Persistence is local-first; remote is best-effort. Autosave is debounced (`AUTO_SAVE_DELAY_MS`) via `scheduleAutoSave`. Concurrent-edit safety uses optimistic concurrency: `saveRemoteState` does a conditional `UPDATE ... WHERE updated_at = expectedUpdatedAt`; a zero-row result becomes a `REMOTE_CONFLICT` error, surfaced through `handleRemoteConflict` (which prompts the user to load remote or keep local). `lastRemoteUpdatedAt` tracks the expected version. Without configured Supabase credentials the app runs fully on localStorage — keep that fallback path working. Because iOS Safari rarely fires `beforeunload`, a `pagehide`/`visibilitychange(hidden)` listener flushes an immediate save (`flushPendingSave`).

**Live sync (Realtime).** `subscribeRealtime(planKey)` listens to `postgres_changes` UPDATEs on the current plan row; `switchToPlan` unsubscribes then re-subscribes when the plan changes. `handleRealtimeChange` ignores the echo of our own write (matching `payload.new.updated_at === lastRemoteUpdatedAt`); for a genuine external change it either applies the remote state live (no local edits) or raises `pendingConflict` (local edits present). Realtime requires running **`supabase/migration.sql`** once (adds `planner_state` to the `supabase_realtime` publication + `replica identity full`); it respects the existing SELECT RLS.

### Supabase config

Credentials are hard-coded constants at the top of `app.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — there is no env file. `canUseSupabase()` checks for `PEGA_AQUI` placeholders and the presence of the CDN client. The schema grants the **anon** role read/insert/update, scoped by the RLS id allowlist; this is intentionally an open, no-auth shared planner.

### Responsive behavior

Below 900px (`mobileViewportQuery`) the itinerary shows one day at a time via `applyMobileDayNavigation` + the prev/next buttons (`mobileDayIndex`). On coarse-pointer (touch) devices native drag-and-drop is disabled in `buildCard`, so reordering on iOS goes through the per-card ▲/▼ buttons (`moveItemWithinDay`, disabled while a filter is active) and the "Mover a día" select.

### Theme & print

`data-theme` on `<html>` (`applyTheme`/`toggleTheme`, persisted under `THEME_KEY`, default from `prefers-color-scheme`) drives the light/dark palette — `style.css` is built on semantic CSS variables (`--surface`, `--text`, `--brand`, status `--*-bg/border/text`, etc.); add colors as variables in both `:root` and `[data-theme="dark"]`, not as hardcoded hex. The "Imprimir / PDF" button calls `window.print()`; the `@media print` block hides the form/controls, expands all days, and shows only non-empty notes (`.notes:placeholder-shown { display:none }`).

## Conventions

- All user-facing strings are Spanish (es-CL). Match that when adding UI text.
- Use `crypto.randomUUID()` for new item/day ids (existing seed data uses `item-N`/`day-N` literals).
- `limitText`/`sanitizeUrl` enforce length caps and http(s)-only links — route new free-text/URL fields through them.
