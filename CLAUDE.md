# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CHUYI Calibration System — a web-based calibration order management system for tracking equipment calibration orders, customers, technicians, and inventory. Built as a React SPA with Supabase as the backend.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript check + production build (output: dist/)
npm run preview   # Preview production build locally
```

No test runner is configured. TypeScript type checking runs as part of `npm run build`.

## Architecture

### Stack
- **React 18 + TypeScript** — UI with hooks-based state management
- **Vite 5** — Dev server and bundler (single-file output via `vite-plugin-singlefile`)
- **Tailwind CSS 3** — Utility-first styling with custom teal brand palette
- **Supabase (PostgreSQL)** — Backend database with direct client-side access
- **Recharts** — Dashboard charts

### Routing
No React Router. Navigation is handled by a `currentView` state in `App.tsx` using the `ViewState` union type: `'dashboard' | 'create-order' | 'order-list' | 'inventory' | 'settings' | 'tools'`.

### State Management
Local React state only (`useState`, `useEffect`, `useMemo`). No Redux or Context API. `App.tsx` owns most shared state and passes it down as props.

### Data Layer
All database access goes through `services/mockGasService.ts` (the `SupabaseService` class). It uses the Supabase JS client and automatically falls back to an in-memory store if the connection fails. Fetch operations are batched at 1000 records.

### Authentication
Custom auth — not Supabase Auth. Two roles: `admin` and `engineer`. Passwords are stored in the `ali_settings` and `cali_settings` Supabase tables. The `Login.tsx` component handles credential verification.

### Key Components
- `App.tsx` — Root: holds shared state, renders Sidebar + active view
- `components/OrderForm.tsx` — Create/edit orders with shopping cart, product/customer search, technician assignment
- `components/OrderList.tsx` — Order table with filtering, status management, archive/restore, copy
- `components/Dashboard.tsx` — Analytics with bar, pie, and area charts
- `components/Settings.tsx` — Admin password management and engineer account creation
- `components/Tools.tsx` — Data import/export utilities

### Database Tables (Supabase)
Defined in `database_schema.sql`. Table names are mapped in `config.ts`:
- `cali_orders` — Main orders table (includes `technicians TEXT[]`)
- `cali_products` — Product/instrument catalog with pricing
- `cali_customers` — Customer records
- `cali_technicians` — Technician staff
- `ali_settings` — Admin settings (key/value)
- `cali_settings` — User/engineer settings (key/value)

RLS is enabled with permissive anonymous-access policies (internal trusted use).

### Environment Variables
Stored in `.env.local` (not committed). Vite exposes variables prefixed with `VITE_`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Python Data Import Tools
Separate scripts for batch importing historical data — not part of the web app build:
- `pdf_quote_parser.py` — Parse PDF quotes into structured data
- `smart_excel_import.py` — Batch import Excel files with product matching
- `import_csv_quotes.py` — CSV import utility
- `import_quotes_to_supabase.py` — Push parsed data to Supabase
