# Tibi Retail Platform

Retail management system for Tibi — concept store and café opening Q4 2026 in Cotonou, Bénin.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres, Auth, Realtime, RLS)
- **Resend** + **React Email** (transactional)
- **Tailwind CSS** with the Tibi design system
- **@zxing/browser** (camera barcode scanning)
- **react-pdf** + **bwip-js** (PDF labels + invoices)
- **Recharts** (dashboards)
- **Netlify** deployment

## Phase status

- ✅ **Phase 1 — Foundation** (this commit)  
  Project scaffold · design tokens · Supabase schema + RLS + brand-share RPCs · seed (23 brands + Tibi Editions + 2 employees + cycles + rates) · Supabase clients + auth + roles · Resend scaffold + invoice/onboarding templates · route shells for all 5 spaces · PWA manifest + icons · Netlify config
- ◻ Phase 2 — Brand onboarding flow + Admin Brands/Stock CRUD
- ◻ Phase 3 — POS (search, cart, sales, invoices)
- ◻ Phase 4 — Brand view (signed links, realtime, multi-currency)
- ◻ Phase 5 — Reports + Daily Close + Pre-orders + Returns
- ◻ Phase 6 — PWA service worker + offline POS queue + label/invoice PDF polish

## Setup (Phase 1)

### 1. Install dependencies

```bash
cd tibi-platform
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (region: `eu-west-3` Paris recommended for Cotonou).
2. From **Project Settings → API**, copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (server-side only)

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...           # add when ready, app boots without it
RESEND_FROM_EMAIL=Tibi <hello@ismathlauriano.com>
ADMIN_NOTIFY_EMAIL=hello@ismathlauriano.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Apply schema + seed

Two paths:

**A — Supabase CLI (recommended)**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies all migrations in supabase/migrations
psql "$(npx supabase db url)" < supabase/seed.sql
```

**B — SQL editor**

In Supabase Studio → SQL editor, run files in order:

1. `supabase/migrations/20260417000001_initial_schema.sql`
2. `supabase/migrations/20260417000002_rls_policies.sql`
3. `supabase/migrations/20260417000003_brand_share_rpcs.sql`
4. `supabase/seed.sql`

### 5. Create the admin user

In Supabase Studio → Authentication → Add user, create your account
(email + password). Then in SQL editor:

```sql
insert into user_profiles (user_id, role, display_name)
select id, 'admin', 'Ismath' from auth.users where email = 'you@example.com';
```

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000 — you'll be sent to `/login`.

## Project layout

```
tibi-platform/
├── public/                  # static + PWA assets
│   ├── manifest.json
│   └── icons/               # app icons (Tibi symbol)
├── src/
│   ├── app/
│   │   ├── (auth callbacks under /auth)
│   │   ├── login/           # sign-in
│   │   ├── admin/           # space 1 + 5 — full admin
│   │   ├── pos/             # space 2 — POS
│   │   ├── brand/[token]/   # space 3 — brand share view
│   │   └── onboarding/      # space 4 — brand onboarding
│   ├── components/
│   │   ├── ui/              # design-system primitives
│   │   └── admin/           # admin-only chrome
│   ├── emails/              # React Email templates
│   ├── lib/
│   │   ├── supabase/        # client + server + admin + types
│   │   ├── auth.ts
│   │   ├── format.ts
│   │   └── cn.ts
│   └── middleware.ts        # Supabase session refresh
├── supabase/
│   ├── config.toml
│   ├── migrations/          # SQL migrations
│   └── seed.sql             # brands + Tibi Editions + employees + cycles + rates
├── netlify.toml
└── tailwind.config.ts
```

## Brand seed

23 consignment brands seeded from the Cotonou 2026 dossier, plus **Tibi Editions** (own label, never delete).
Country, category, and commission percentage are **null** by default — Ismath confirms each in admin.

Pre-seeded employees: `Vendeuse 1`, `Vendeuse 2` — rename in Settings.

## Design system

DM Sans (Google Fonts), pill buttons, hairline borders, no shadows, no emojis.
All money in XOF. See `src/app/globals.css` and `tailwind.config.ts`.

## Deployment

Connect this repo to Netlify (the `netlify.toml` is in place). Set the same env
vars in Netlify → Site settings → Environment variables. The `@netlify/plugin-nextjs`
plugin is referenced in the toml; Netlify installs it automatically.
