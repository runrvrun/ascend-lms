# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ascend LMS — a Next.js 16 (App Router) learning management system for structured employee development. Staff self-enroll or get assigned to learning pathways made of courses; admins manage content, users, cohorts, and offices. See README.md for the full feature list per role.

## Commands

```bash
npm run dev              # start dev server
npm run build            # prisma generate && next build
npm run start             # production server
npm run lint              # ESLint (flat config, eslint-config-next)
npm run seed              # tsx --env-file=.env prisma/seed.ts (idempotent upserts)
npx prisma db push        # push schema.prisma changes to the DB (no migrations dir workflow in use)
npx prisma studio         # inspect data
```

There is no test runner configured in this repo. Don't invent test commands or assume Jest/Vitest exists.

## Architecture

### Stack
Next.js 16 App Router + TypeScript, Tailwind v4, NextAuth v4 (Azure AD + a Credentials fallback), Prisma v7 with `@prisma/adapter-pg` (driver adapter, not the classic Prisma engine), PostgreSQL.

### Auth & role-based routing
- `authOptions` lives in `app/api/auth/[...nextauth]/route.ts` (not a separate `lib/auth.ts` — import it from there). JWT session strategy; roles are embedded in the token and refreshed from the DB on every non-initial `jwt` callback call, so a role change takes effect on next session refresh, not instantly.
- Azure AD sign-in is gated on the user already existing (and not soft-deleted) in the DB — there is no self-service signup via SSO. The Credentials provider is a secondary path (e.g. activation-flow users) with bcrypt-hashed passwords.
- Roles: `ADMIN`, `MANAGER`, `TRAINER`, `SME` (enum `Role`, many-to-many via `UserRole`). A user can hold multiple roles. There is no plain "learner" role — anyone authenticated can access learner-facing routes (`/dashboard`, `/pathways`, etc.); the role-gated areas are `/admin`, `/manager`, `/trainer`, `/sme`.
- Each role area has its own `layout.tsx` (e.g. `app/admin/layout.tsx`) that calls `getServerSession(authOptions)`, redirects to `/` if unauthenticated, and redirects to `/dashboard` if the required role is missing. `TRAINER` and `SME` layouts also allow `ADMIN` through. Follow this exact pattern for any new role-gated section — there is no shared middleware doing this centrally.
- `MANAGER` here means a people-manager role tied to direct reports via `UserManager` (many-to-many junction, not the `User.title = MANAGER` job title — those are unrelated concepts that happen to share a name). Do not confuse `Role.MANAGER` (permission) with `JobTitle.MANAGER` (an org title enum value).

### Data layer
- `app/lib/prisma.ts` exports the singleton Prisma client (globalThis-cached in dev to survive HMR). Import `prisma` from there in server code; don't instantiate `PrismaClient` elsewhere except the standalone one inside the NextAuth route file (kept separate to avoid a circular import at auth-init time).
- Soft deletes: many models use `deletedAt` instead of hard deletes (`User`, `Cohort`, `Pathway`, `Course`, `Content`, `Test`, `Question`, `Assignment`). Always filter `where: { deletedAt: null }` when querying these — Prisma will not do this for you.
- Ordering matters and is enforced at the schema level: `PathwayCourse.order` (`@@unique([pathwayId, order])`), `Content.order` (`@@unique([courseId, order])`), `Question.order` (`@@unique([testId, order])`). When reordering, you generally need to shift/renumber siblings inside a transaction rather than just swapping one value.
- Progress/points are tracked at three granularities: `ContentProgress` (individual content item, drives the learning streak), `CourseProgress` (per user/course/pathway, holds test/assignment status), and pathway completion which is *derived*, not stored — computed by checking all `PathwayCourse` entries have a matching completed `CourseProgress`. `UserPoint` is an append-only ledger, not a running total column.
- No migrations directory is currently used day-to-day — schema changes are pushed with `prisma db push`. Be cautious about assuming a migration history exists.

### Server actions over API routes
Almost all writes go through colocated `actions.ts` files (`"use server"`) next to the pages that use them (e.g. `app/admin/course/actions.ts`, `app/discussions/actions.ts`, `app/settings/actions.ts`), not through `app/api/*`. `app/api/` is reserved for NextAuth and a handful of file-download/export endpoints (Excel templates, exports) that need raw `Response` control. When adding a new mutation, prefer a server action colocated with its feature over a new API route, and call `revalidatePath(...)` for every path whose data it affects (actions often revalidate 2-3 related paths, e.g. both `/admin/course` and `/sme/course` when course drafts affect SME-visible lists).

### Notifications
`NotificationType` enum drives a single `Notification` model covering comment replies, enrollment approve/reject, pathway/cohort assignment, assignment grading, and growth plan events. When adding a new notifiable event, extend that enum and the creation call at the point of the triggering action — there's no generic event bus.

### Directory map (non-obvious parts only)
- `app/lib/` — Prisma client, email helper, learning-progress helper. Not a general "utils" dump.
- `app/discussions/actions.ts` — server actions for the per-content-item comment/reply system (used by `ContentDiscussion.tsx`), plus the notification side-effects for replies.
- `app/components/` — shared UI only (sidebar, cards, leaderboard, discussion, searchable select). Feature-specific components live next to their page, not here.
- `app/admin/topic/`, `app/sme/`, `app/trainer/`, `app/growth-plan/` are newer areas not yet described in README.md — check these directly rather than trusting the README's project structure section for full coverage (it predates SME/Trainer/Topic/GrowthPlan/Assignment features visible in `prisma/schema.prisma`).

### Email
`app/lib/email.ts` sends via Resend when `RESEND_API_KEY` is set (production), otherwise falls back to a Mailtrap sandbox for local dev. Don't add a third code path — extend the existing `send()` helper.

### Points to double-check before assuming
- The README's feature list and project-structure diagram are a good orientation but are stale relative to the schema (missing Assignment, GrowthPlan, Topic/SME, CourseFeedback, CourseTrainer). Trust `prisma/schema.prisma` and the actual `app/` tree over the README for anything schema-adjacent.
