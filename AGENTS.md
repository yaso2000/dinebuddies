# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
DineBuddies is a React 18 + Vite SPA (social dining platform) backed entirely by Firebase (Auth, Firestore, Storage, Cloud Functions) and Stripe for payments. There is no custom backend server — all server logic lives in `functions/` as Firebase Cloud Functions.

### Running the dev server
- `npm run dev` starts Vite on port **5176** (configured in `vite.config.js`, binds `0.0.0.0`).
- The app requires Firebase credentials in a `.env` file (copy from `.env.example`). Without real credentials the app still starts and renders the UI, but Firebase-dependent features (auth, data) will not work.

### Dependencies
- **Root**: `npm install` — the React/Vite frontend.
- **functions/**: `cd functions && npm install` — Firebase Cloud Functions (Node 20 engine specified, but installs fine on Node 22).
- Lockfile is `package-lock.json` → use **npm**, not yarn/pnpm.

### Lint
- The `npm run lint` script references ESLint 8, but **no `.eslintrc` config file exists** in the repo (never committed). Running `npm run lint` will fail with "ESLint couldn't find a configuration file." This is a pre-existing issue.

### Build
- `npm run build` runs `vite build` and produces output in `dist/`. Build succeeds with warnings about large chunks but no errors.

### Firebase services
- The app connects to a live Firebase project (`dinebuddies`) by default. There is no Firebase Emulator configuration committed.
- To test locally with full functionality, real Firebase credentials are needed in `.env`.

### Key environment variables
See `.env.example` for the full list. Required for Firebase connectivity:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
Optional: `VITE_GOOGLE_MAPS_API_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`.
