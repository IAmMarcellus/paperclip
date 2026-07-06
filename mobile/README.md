# Paperclip Mobile (Aurora)

A React Native (Expo SDK 56) client for the Paperclip governance plane. Watch and
steer your agent org from a phone: live agents, agent detail, org map, streamed run
transcripts, and approvals — in Paperclip's dark **Aurora** look.

> Workspace package of the Paperclip monorepo (`@paperclipai/mobile`). It consumes
> `@paperclipai/shared` types directly. Build it here in the fork on a branch; never
> edit it from the parent `mergatriod` repo's `vendor/` tree.

## Stack

- **Expo SDK 56** (React Native 0.85, React 19.2, New Architecture).
- **Expo Router** file-based routing with **NativeTabs** — iOS 26 renders a real
  Liquid Glass tab bar.
- **expo-glass-effect** (`GlassView`, gated by `isLiquidGlassAvailable()`) for liquid
  glass surfaces, with an **expo-blur** `BlurView` fallback for Android / iOS < 26.
  See `components/ui/GlassSurface.tsx`.
- Typed Aurora theme (`theme/`) + RN `StyleSheet` — mirrors the web's CSS tokens.
- **TanStack Query** over a typed fetch client (`lib/api/`); run transcripts stream
  via incremental polling.
- Connection config (server URL + optional bearer token) in **expo-secure-store**.

## Layout

```
app/                     Expo Router routes
  (tabs)/                NativeTabs: Home · Agents · Org · Activity · Settings
  agents/[agentId].tsx   Agent detail (Pause/Resume)
  runs/[runId].tsx       Streamed run transcript
  connect.tsx            First-run server connection
components/ui/           Primitives (GlassSurface, Button, Badge, …)
components/aurora/       Signature components (AgentCapsule, ObjectiveCard, …)
theme/                   Tokens, typography, fonts, status + agent colours
lib/                     api client + endpoints, config, query, connection
hooks/                   TanStack Query data hooks
```

## Run

From the monorepo root (`vendor/paperclip`): `pnpm install`. Then:

```bash
cd mobile
npx expo start            # Metro; open in a dev build (see below)
```

Start the backend first (`make paperclip`, default `:3100`). In the app's **Connect**
screen enter the server URL — `http://localhost:3100` on the same machine, or the
host's LAN IP from a physical device — plus a bearer token if the server requires auth.

### Liquid Glass

`NativeTabs` + `expo-glass-effect` need a **custom dev build** on **iOS 26 (Xcode 26)**:

```bash
npx expo run:ios          # dev build with native modules
```

In Expo Go, on iOS < 26, or on Android you automatically get the `expo-blur`
fallback (`GlassSurface`), so the UI is fully functional — just not true Liquid Glass.

## Checks

```bash
pnpm typecheck            # tsc --noEmit
npx expo export -p ios    # validate the Metro bundle resolves
```
