# Project Guidelines

## Purpose

This repo is a Vite + React + TypeScript application for Ethiopian Fayda ID OCR, printable ID generation, authentication, wallet-based downloads, and a small admin/payment management surface powered by a local Express API and MySQL.

This file is meant to capture the codebase's real structure and patterns so future work stays consistent and avoids repeating current weak spots.

## Current Structure

- `src/pages`
  Route-level screens such as `Index`, `Login`, `Register`, `Dashboard`, `Admin`, and `ForgotPassword`.
- `src/components`
  Feature components such as `IDUploader`, `ResultsPanel`, `PrintableID`, payment flows, and admin tables.
- `src/components/ui`
  shadcn/Radix-style reusable UI primitives. Treat these as shared foundation components, not feature modules.
- `src/contexts`
  Cross-app state, currently `AuthContext`.
- `src/lib`
  Shared logic and utilities. `ocr.ts` is the main domain-heavy module.
- `server`
  Express API, auth middleware, MySQL access, and database bootstrap SQL.
- `server/sql/niddb_1.sql`
  Canonical schema/bootstrap script for the MySQL database.
- `src/test`
  Test setup and the current minimal test placeholder.

## Existing Conventions To Keep

- Use the `@/` alias for internal imports.
- Keep route composition in `src/App.tsx` and page components in `src/pages`.
- Prefer shadcn UI primitives plus Tailwind utility classes over custom one-off base components.
- Keep auth session state centralized in `AuthContext`.
- Keep shared API request logic centralized in `src/lib/api.ts`.
- Keep OCR-specific logic in `src/lib/ocr.ts` rather than spreading it through React components.
- Keep admin-specific UI under `src/components/admin`.

## Patterns Seen In The Repo

- Pages currently own a lot of data fetching and redirect logic.
- API reads/writes are mostly coordinated through `src/lib/api.ts`.
- Feature components often mix UI, async orchestration, and business rules in one file.
- The app already includes React Query, but most data flows do not use it yet.
- UI is built with Tailwind, Cards, Dialogs, Tables, Buttons, and Lucide icons consistently.
- Some files are long and domain-dense, especially `src/lib/ocr.ts` and `src/components/PrintableID.tsx`.

## Guidelines For Future Work

### 1. File ownership

- Keep pages thin: routing, guards, and page composition only.
- Move reusable data access into `src/lib` helpers or feature-local modules when a page/component starts making multiple API calls.
- Keep `src/components/ui` for reusable primitives only.
- Do not create backup files like `copy`, `v1`, or ad hoc duplicates in `src/lib`.

### 2. API and MySQL usage

- Prefer typed queries over `as any`.
- When a flow updates money, credits, roles, or other business-critical data, keep that logic inside the server/API layer or a database transaction.
- Do not rely on multiple client-side read-then-write calls for wallet balances, approvals, or consumption tracking.
- Keep auth checks server-side for privileged actions even if the UI also hides those actions.

### 3. React patterns

- Prefer extracting custom hooks or helper functions once a component starts combining fetching, mutation, and presentation.
- Keep local component state for short-lived UI concerns.
- Use callbacks only where they meaningfully stabilize props or event handlers.
- If React Query stays in the app, new async resource flows should prefer it for caching, loading state, and invalidation rather than hand-rolled `useEffect` fetch chains.

### 4. TypeScript standards

- New code should avoid `any`, even if the repo currently tolerates it.
- Prefer explicit interfaces/types for domain objects and mutation payloads.
- Treat the loose `tsconfig.json` settings as technical debt, not a model to expand.
- Add types to helper functions that currently rely on implicit `any`, especially canvas/OCR utilities.

### 5. UI and accessibility

- Continue using the current card/dialog/table language so new screens match existing ones.
- Keep buttons, labels, and form fields composed from shared UI primitives.
- Maintain valid HTML structure inside JSX.
- Keep icon usage lightweight and functional, usually paired with labels.

### 6. Testing and verification

- Add real tests around OCR parsing helpers, auth flows, wallet flows, and admin business logic.
- Prefer testing pure extraction/parsing helpers directly before testing full OCR flows.
- Keep `src/test/setup.ts` as shared test bootstrap.
- Do not leave placeholder tests as the only coverage for a feature area.

### 7. Security-sensitive flows

- Never expose OTPs, secrets, service responses, or privileged tokens to the browser in production paths.
- Password reset, wallet crediting, wallet deduction, and admin actions should be auditable and atomic.
- Prefer idempotent server-side mutations for approve/reverse/download/print flows.

## Known Risks In The Current Codebase

- `server/app.js` and `src/pages/ForgotPassword.tsx` currently return and display the OTP in the client flow. Future work should treat this as a local/dev-only shortcut, not a production pattern.
- `src/components/PaymentRequests.tsx` has been moved to a server-backed action flow, but the route should still be treated as a critical financial mutation area and covered with tests.
- `src/components/PrintableID.tsx` now uses a server-backed consume endpoint, but print/download still deserves integration coverage because it affects credits and download history.
- `vitest.config.ts` expects `@vitejs/plugin-react-swc`, but `package.json` only includes `@vitejs/plugin-react`. Keep tooling configs aligned with installed packages.
- `src/test/example.test.ts` is only a placeholder, so the project effectively has no meaningful automated coverage yet.
- `tsconfig.json` is intentionally permissive today. Avoid using that permissiveness as justification for weaker new code.
- `src/lib/ocr-v1.ts` and `src/lib/ocr-v1 copy.ts` look like historical backups and should not become part of the active architecture.

## Suggested Direction For Refactors

- Introduce feature-local service modules or hooks for payments, admin users, and dashboard/profile loading.
- Consolidate wallet and payment mutations into smaller API service modules if the current single `server/app.js` file keeps growing.
- Break `ocr.ts` into smaller pure helpers for preprocessing, date parsing, field extraction, and image region extraction.
- Break `PrintableID.tsx` into rendering helpers plus a single download/print transaction action.
- Tighten TypeScript settings gradually once `any` usage and null-safety hot spots are reduced.

## Practical Rules For Contributors

- Before adding a new dependency, check whether the repo already has a suitable primitive.
- Before adding a new feature component, decide whether it belongs in `pages`, `components`, or `lib`.
- Before writing a privileged mutation in the client, stop and move it to the API/server layer.
- Before copying an existing loose pattern, prefer the stronger rule described in this file.
