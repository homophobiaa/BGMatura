# Managed hosting decision

Decision for #5, checked **2026-11-03**: use **Vercel** for the Next.js application
and **Neon PostgreSQL** for the database. This selects providers and operating
boundaries; no account, subscription, database, deployment, or paid resource is
provisioned by this change.

Vercel fits the existing App Router/Node.js deployment without a second backend.
Neon provides managed PostgreSQL and isolated database branches. Keep the current
Prisma 7/`@prisma/adapter-pg` stack and ordinary PostgreSQL connections; selecting
Neon does not introduce its auth, storage, or other backend products. A single
managed VM would add server operations; a larger backend platform is unnecessary
for this app's existing data/auth boundaries.

## Connections and placement

- Run the app in a Node.js 24 runtime, with the agreed npm lockfile workflow.
  Confirm provider support and matching PostgreSQL 18 before provisioning.
- Choose nearby European app/database regions; verify actual region availability
  in both accounts and record the selected region at deployment time.
- App functions use a **pooled**, TLS-required Neon URL as server-only
  `DATABASE_URL`. Keep the existing small Prisma/pg connection pool; monitor
  total concurrent connections across function instances before raising it.
- Migration jobs use the **direct** TLS-required URL. The current Prisma config
  reads `DATABASE_URL`, so supply the direct URL as that variable only in the
  migration process; no new public variable or committed credential is needed.
  Neon's [Prisma connection guidance](https://neon.com/docs/guides/prisma)
  distinguishes pooled app connections and direct CLI connections.
- Build with `npm ci` and `npm run build`. Never add schema migrations or demo
  seeds to the ordinary Vercel build command. A successful static build does not
  demonstrate database connectivity or a complete production release.

## Environments

| Environment | App | Database and permitted data |
| --- | --- | --- |
| Local development | Existing `npm run dev` | Existing loopback PostgreSQL dev cluster; synthetic/editor-created drafts only |
| Automated tests | GitHub Actions/local test runner | Throwaway guarded test database; no production credentials |
| PR preview | Vercel preview deployment | Dedicated disposable Neon branch from a **sanitized non-production baseline**; separate role/URL |
| Production | Vercel production deployment | Separate Neon production project and credentials; reviewed educational content and live attempts |

Do not branch production student data into public previews. Fork PRs and
untrusted branches receive no hosting/database secrets. A preview may remain
static or disabled until a maintainer creates its isolated database. Protect
preview access/indexing before exposing editor screens or non-public content.
Never point tests, previews, seeds, or local helpers at the production URL.

## Cost assumptions

Prices are planning inputs in USD, not spending authorization or a fixed quote.
Re-check plans, team-seat charges, taxes, regions, quotas, and usage at purchase.

- [Vercel pricing](https://vercel.com/pricing) lists Hobby at $0 and Pro starting
  at $20/month. The [Hobby policy](https://vercel.com/docs/plans/hobby) limits that
  tier to eligible personal/non-commercial use. Use it only if the account owner
  confirms eligibility; budget Pro for a shared production team otherwise.
- [Neon pricing](https://neon.com/pricing) currently lists Free at $0 with 100
  CU-hours/month and 1 GB per project. Treat this as a prototype option whose
  quotas and recovery limits must be checked, not a production availability
  promise. Launch is metered: $0.106/CU-hour and $0.35/GB-month, with other charges
  such as history, extra branches, and network usage where applicable.
- Illustrative paid baseline: 100 CU-hours + 1 GB storage is $10.95 for those
  two Neon meters; adding Vercel's $20 starting price gives **$30.95/month before
  taxes, seats, and other usage**. Traffic is unknown, so this is not a forecast.
  The hosting-account owner sets an approved monthly budget and available spend
  limits/alerts before enabling paid resources; review usage during the pilot.

## Deployment and migration responsibility

The repository maintainers designate one **release operator** who owns access
to the hosting accounts and production secrets. That role is responsible for:

1. Recording account ownership, region, plan/budget, recovery requirements, and
   environment-specific secrets before provisioning or granting team access.
2. Checking CI and reviewing migrations; testing them on an isolated preview
   first. Run only committed migrations with `npm run db:deploy`.
3. Backing up/checking recovery before a production schema change, then running
   the direct-connection migration **once in a serialized release job**. Do not
   let multiple preview/build jobs race production migrations.
4. Promoting the compatible app revision only after migration success, then
   verifying app/database/auth health. A failed migration blocks promotion.
   App rollback does not undo a database migration; use a reviewed forward fix
   or an explicit restore plan instead of an automatic destructive rollback.
5. Removing expired preview branches and credentials and reviewing usage.

Provisioning/preview implementation belongs to #25, backup/recovery to #147,
and production deployment automation to #148. This decision does not assert
those operational checks have been performed.
