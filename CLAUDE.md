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
npx prisma db push        # push schema.prisma changes to the DB (prisma/migrations/ exists but is stale — stopped in March 2026; don't use migrate)
npx prisma studio         # inspect data
```

Cron jobs (run on the production server via crontab from `~/ascend-lms`, each a `tsx --env-file=.env` script in `scripts/`; most accept `--dry-run`):

```bash
npm run sync-m365-users              # create Users for new licensed Entra ID members; soft-delete @ycp.com users with no E3/E5/Business license (--dry-run, --force past the 10% cap)
npm run send-pathway-reminders       # weekly (Wed) digest for incomplete pathways; skips past-deadline enrollments
npm run send-custom-pathway-reminders # hourly; processes admin-scheduled PathwayReminder rows once (sets sentAt)
npm run send-deadline-reminders      # must run exactly once/day — no sent-tracking, matches by date
npm run purge-assignment-files       # monthly; deletes uploaded files >6 months old, keeps the submission row (fileDeletedAt)
```

Scripts build their own `PrismaClient` + `PrismaPg` adapter and can't import the `app/lib/prisma.ts` singleton, so lib modules they share (`app/lib/pathwayDeadline.ts`, `pathwayReminders.ts`, `assignmentFiles.ts`) must stay free of that import.

There is no test runner configured in this repo. Don't invent test commands or assume Jest/Vitest exists.

## Architecture

### Stack
Next.js 16 App Router + TypeScript, Tailwind v4, NextAuth v4 (Azure AD + a Credentials fallback), Prisma v7 with `@prisma/adapter-pg` (driver adapter, not the classic Prisma engine), PostgreSQL.

### Auth & role-based routing
- `authOptions` lives in `app/api/auth/[...nextauth]/route.ts` (not a separate `lib/auth.ts` — import it from there). JWT session strategy; roles are embedded in the token and refreshed from the DB on every non-initial `jwt` callback call, so a role change takes effect on next session refresh, not instantly.
- Azure AD sign-in is gated on the user already existing (and not soft-deleted) in the DB — there is no self-service signup via SSO. Users get created either by an admin or by the `sync-m365-users` cron script. The Credentials provider is a secondary path (e.g. activation-flow users) with bcrypt-hashed passwords.
- Roles: only `ADMIN` is stored (enum `Role`, via `UserRole`). `MANAGER`, `TRAINER`, `SME` and `PATHWAY_OWNER` are *derived* from assignments — has a non-deleted direct report (`UserManager`), trains a course (`CourseTrainer`), is SME on a topic (`TopicSME`), owns a pathway (`PathwayOwner`) — by `loadUserRoles`/`deriveRoles` in `app/lib/userRoles.ts`, called from the `jwt` callback. Session `roles` is that derived list, so the Manager/Trainer/SME menus and layouts follow assignments automatically. Assignment pickers list all active users. There is no plain "learner" role — anyone authenticated can access learner-facing routes (`/dashboard`, `/pathways`, etc.); the role-gated areas are `/admin`, `/manager`, `/trainer`, `/sme`.
- Each role area has its own `layout.tsx` (e.g. `app/admin/layout.tsx`) that calls `getServerSession(authOptions)`, redirects to `/` if unauthenticated, and redirects to `/dashboard` if the required role is missing. `TRAINER` and `SME` layouts also allow `ADMIN` through. `app/admin/layout.tsx` also lets `PATHWAY_OWNER` in, so every other admin section has its own admin-only `layout.tsx` (`requireAdminPage()`), and `app/admin/pathway/[id]/layout.tsx` checks ownership — add an admin-only layout to any new `/admin/*` section. There is no shared middleware doing this centrally.
- Layouts only protect pages: server actions must check permissions themselves with the helpers in `app/lib/permissions.ts` (`requireAdmin`, `requirePathwayManager(pathwayId)`). Pathway actions must also scope child rows to the pathway (`where: { id, pathwayId }`) so an owner of one pathway can't touch another's.
- `MANAGER` here means a people-manager tied to direct reports via `UserManager` (many-to-many junction, not the `User.title = MANAGER` job title — those are unrelated concepts that happen to share a name). Do not confuse the derived `MANAGER` role (permission) with `JobTitle.MANAGER` (an org title enum value).

### Data layer
- `app/lib/prisma.ts` exports the singleton Prisma client (globalThis-cached in dev to survive HMR). Import `prisma` from there in server code; don't instantiate `PrismaClient` elsewhere except the standalone one inside the NextAuth route file (kept separate to avoid a circular import at auth-init time).
- Soft deletes: many models use `deletedAt` instead of hard deletes (`User`, `Cohort`, `Pathway`, `Course`, `Content`, `PopQuiz`, `Test`, `Question`, `Assignment`, `Comment`). Always filter `where: { deletedAt: null }` when querying these — Prisma will not do this for you.
- Ordering matters and is enforced at the schema level: `PathwayCourse.order` (`@@unique([pathwayId, order])`), `Content.order` and `Test.order` (each `@@unique([courseId, order])` on its own table, but the two share one merged position sequence per course — a course's Content and Test rows are meant to render interleaved, sorted by `order` across both tables, never with duplicate values), `Question.order` (`@@unique([testId, order])`). When reordering or inserting, you generally need to shift/renumber siblings inside a transaction rather than just swapping one value — see `shiftCourseItemsUpFrom`/`shiftCourseItemsDownAfter`/`swapCourseItemOrder` in `app/admin/course/actions.ts`, and the merge helper `buildCourseOutline` in `app/admin/course/[id]/courseOutline.ts` (used to build the "insert after X" position picker in the admin UI).
- A `Course` can have any number of `Test`s (each with its own `title`, `passThreshold`, and `Question`s) placed anywhere among its `Content` via that shared `order` sequence — there is no single "the course's test" anymore (`Course.tests: Test[]`, not `Course.test`). Per-user results live in `TestProgress` (one row per user+test+pathway), not on `CourseProgress`.
- Progress/points are tracked at four granularities: `ContentProgress` (individual content item, drives the learning streak), `TestProgress` (individual test — score/status per user+test+pathway), `CourseProgress` (per user/course/pathway — holds only `completed`/`assignmentStatus`, no test data), and pathway completion which is *derived*, not stored — computed by checking all `PathwayCourse` entries have a matching completed `CourseProgress`. `UserPoint` is an append-only ledger, not a running total column. Course completion (all content done + every test passed + assignment passed if one exists) is evaluated by one shared `evaluateCourseCompletion()` helper in `app/lib/courseCompletion.ts` — always extend that helper rather than re-deriving completion logic at a new call site (it used to be duplicated 3x and that caused a real bug).
- No migrations directory is currently used day-to-day — schema changes are pushed with `prisma db push`. Be cautious about assuming a migration history exists. **There are TWO separate live Postgres databases, and every schema change must be applied to BOTH:** (1) the local `.env` `DATABASE_URL` (`db.prisma.io`) — a live dev/staging database, NOT production; and (2) the real production database, which lives on the deploy host (`ascend.ycp.com`; SSH credentials are in the "remote ssh & sftp" section at the bottom of the local `.env`) and has its own separate `.env` there with a different `DATABASE_URL` pointing at an internal-only host reachable solely from that server. **The auto-deploy workflow (`.github/workflows/deploy.yml`) only does `git reset --hard` + `npm ci` + `npm run build` + `pm2 restart` on push to `main` — it never runs `prisma db push` against either database.** So a schema change merged to `main` never reaches either database automatically — you must apply it yourself. **On every database change: take a `pg_dump` backup of each database, then apply the same change to both** — first `db.prisma.io` via the local `.env`, then SSH into `ascend.ycp.com` and repeat the same steps there against its own `.env`'s `DATABASE_URL`. Skipping the production side leaves the deployed app crash-looping with `P2022: column does not exist` (this has happened before). When adding a required column to a table that already has rows, `db push` will refuse — use the safe two-phase pattern instead: push the column as nullable (+ any new tables) first, run a one-off backfill script (e.g. `prisma/migrate-multi-test.ts` is a worked example) — separately on each database — then tighten to required and drop any now-redundant old columns in a second push, again on each database.

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
`app/lib/email.ts` sends over SMTP (nodemailer) when `SMTP_HOST` is set (production; also needs `SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`, plus optional `SMTP_FROM` to send as another address; port 465 uses TLS directly, any other port STARTTLS). Otherwise it uses the Mailtrap sandbox API (`MAILTRAP_TOKEN`/`MAILTRAP_INBOX_ID`) for local dev, and if neither is configured it just logs and skips. Send failures are logged, not thrown. Don't add another code path — extend the existing `send()` helper.

### Pathway deadlines
`PathwayEnrollment.deadline` is a calendar date stored as UTC midnight, and every day boundary is a UTC day. All deadline rules live as pure functions in `app/lib/pathwayDeadline.ts`: reminder emails go out the day before and on the day, and `DEADLINE_GRACE_DAYS` (7) after the deadline the enrollment locks — content stays viewable, but nothing can be completed or submitted. Reuse those helpers for any deadline check; don't do your own date math.

### Assignment file uploads
Learner uploads are written to local disk under `UPLOAD_DIR` (default `./uploads/assignments`) by a server action. They're capped at 20 MB, which is why `next.config.ts` sets `serverActions.bodySizeLimit` to `21mb`. Downloads are served through `app/api/assignment-submissions/[id]/file/route.ts`, and the file extension whitelist is in `app/lib/assignmentFiles.ts`. Because files live on the deploy host's disk, they aren't in git and aren't in the DB backups.

### File storage (disk vs Vercel Blob)
Uploaded files (assignment files and content images) go through `app/lib/fileStorage.ts`. With `BLOB_READ_WRITE_TOKEN` set (staging on Vercel, which has a connected private Blob store) they're stored in Vercel Blob under `assignments/<key>` / `content-images/<key>`; otherwise on disk under `UPLOAD_DIR/<bucket>` (production). Either way they're only served through the app's own routes, never by public URL. Set `BLOB_ACCESS=public` only if the store is public. On Vercel a request body is capped at ~4.5 MB, so larger assignment uploads fail on staging.

### Content images
`IMAGE` content (and the optional image on `LINK` content, shown as a clickable image opening the link) stores a file key in `Content.imageKey`. Images are resized to 1600 px wide and re-encoded as WebP q0.82 in the browser by `app/lib/compressImage.ts` (JPEG fallback where WebP encoding isn't supported; GIFs pass through to keep animation), then uploaded via the `uploadContentImage` server action, validated by magic bytes and stored by `app/lib/contentImages.ts` (via `fileStorage.ts`). They're served to any signed-in user by `app/api/content-images/[key]/route.ts` with immutable caching (keys are never reused). Duplicated courses share files, so a file is deleted only when no live content references it. Like assignment files they aren't in git or DB backups; course export/import embeds them as base64 so they survive a move between servers.

### Help page & release notes (keep current)
The in-app User Guide (`app/help/HelpContent.tsx`, one tab per role plus Release Notes) and the release notes (`app/help/releaseNotes.ts`, newest day first) must be updated **in the same commit as every user-visible change**: add a plain-language line (kind `new`/`improved`/`fixed`, written for non-technical staff, no code or file names) under that day's date — create the day if it doesn't exist — and edit any guide steps the change makes wrong. Purely internal changes (deploy config, scripts, docs, refactors) don't get a release note.

### Points to double-check before assuming
- The README's feature list and project-structure diagram are a good orientation but are stale relative to the schema (missing Assignment, GrowthPlan, Topic/SME, CourseFeedback, CourseTrainer). Trust `prisma/schema.prisma` and the actual `app/` tree over the README for anything schema-adjacent.
