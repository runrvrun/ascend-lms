# Ascend LMS

A learning management system built for structured employee development. Ascend lets staff self-enroll or be assigned to learning pathways, tracks course progress and points, and gives admins full control over content, users, cohorts, and offices.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | NextAuth.js v4 (Azure AD / OAuth) |
| ORM | Prisma v7 with `@prisma/adapter-pg` |
| Database | PostgreSQL |
| Icons | Lucide React |
| Excel | xlsx |

## Features

### For Learners
- **Dashboard** — overview of enrolled pathways, recent point activity, and leaderboards for points and learning streaks (shows name, title, division, office)
- **My Pathways** — full searchable list of enrolled pathways grouped by status (In Progress / Awaiting Approval / Completed), with unenroll option; dashboard card shows a preview of the top 5
- **Pathways page** — browse all published pathways, search by name or tag, enroll or request enrollment, see completion status; top 2 recommendations shown based on what colleagues in the same division are enrolled in
- **Pathway Viewer** — read text, watch video, or open link content; mark individual content items as completed; take course tests; discussion section on every content item for comments and threaded replies
- **Learning History** — full record of completed courses grouped by pathway, with dates and scores
- **Certificates** — downloadable PDF-style certificate (A4 landscape, print-ready) issued on pathway completion, signed by the Group CHRO
- **Notifications** — in-app notifications for: enrollment approved/rejected, pathway assigned by dev manager, pathway assigned to cohort, and replies to discussion comments; unread count badge on the sidebar bell icon
- **Learning Streak** — consecutive daily activity tracked from content completions; streak count and total points shown in the sidebar user card

### For Development Managers
- **Professionals** — view all direct reports with division, title, office, and progress stats; search by name, division, title, or office; assign pathways with optional deadlines
- **Pathway Requests** — approve or reject learner enrollment requests with an optional rejection reason

### For Admins
- **User Management** — create, edit, bulk-import users via Excel; assign cohorts per user; set division, title, office, and dev manager
- **Cohort Management** — create cohorts, manage members, assign pathways, view per-cohort progress report; all actions accessible from a dropdown Actions menu per row
- **Pathway Management** — create and edit pathways; toggle Draft / Published status with an iOS-style switch; manage courses per pathway
- **Course Management** — create courses; toggle Draft / Published status; add content (text, video, link) and tests with multiple question types; only published courses shown to learners
- **Office Management** — create offices, assign users, view and remove members
- **Analytics** — platform-wide analytics dashboard

### Points & Gamification
- Points awarded on course completion
- Pathway completion computed automatically when all courses in a pathway are done
- Learning streak tracked per user (consecutive days with at least one content completion)
- Points and streak leaderboards on the dashboard, scoped to the organisation

## Project Structure

```
app/
├── admin/
│   ├── cohort/        # Cohort CRUD + member management + pathway assignment
│   │   └── [id]/
│   │       ├── progress/   # Per-cohort progress report
│   │       └── pathways/   # Assign pathways to cohort
│   ├── course/        # Course + content + test management
│   ├── office/        # Office CRUD + user assignment
│   ├── pathway/       # Pathway CRUD + course ordering
│   └── user/          # User CRUD + bulk import + cohort assignment
├── api/
│   ├── auth/          # NextAuth route handler
│   └── admin/         # REST endpoints (e.g. Excel template download)
├── components/        # Shared UI components (sidebar, cards, leaderboard, discussion)
├── dashboard/         # Learner dashboard page
├── devmanager/
│   ├── pathway-request/  # Approve / reject enrollment requests
│   └── professionals/    # Dev manager's team view
├── discussions/       # Server actions for content comments and notifications
├── learning-history/  # Full learning history page
├── lib/               # Prisma client singleton, email helpers
├── my-pathways/       # Searchable full pathway list for learners
├── notifications/     # In-app notification centre
├── pathways/          # Learner-facing pathway browser + recommendations
│   └── [id]/
│       └── certificate/  # Pathway completion certificate (printable)
prisma/
├── schema.prisma      # Database schema
└── seed.ts            # Seed data (offices, pathways, courses)
```

## Database Schema (key models)

```
User              — employee profile with division, title, office (FK), dev manager
Office            — physical office locations (one-to-many with User)
Cohort            — group of users assigned to one or more pathways
CohortPathway     — many-to-many: cohorts ↔ pathways
Pathway           — learning pathway with courses, tags, approval settings, publish status
Course            — unit of learning with ordered content and an optional test
PathwayEnrollment — tracks enrollment status (PENDING / APPROVED / REJECTED)
CourseProgress    — tracks course completion per user per pathway
ContentProgress   — tracks individual content item completion (drives learning streak)
UserPoint         — points ledger (source: COURSE_COMPLETION)
Comment           — discussion comments on content items (2-level: top + replies)
Notification      — in-app notifications (reply, approval, assignment)
```

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OAuth provider credentials (e.g. Azure AD)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables** — create a `.env` file:
   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="..."
   AZURE_AD_CLIENT_ID="..."
   AZURE_AD_CLIENT_SECRET="..."
   AZURE_AD_TENANT_ID="..."
   ```

3. **Push the database schema**
   ```bash
   npx prisma db push
   ```

4. **Seed initial data** (offices, sample pathways and courses)
   ```bash
   npm run seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client and build for production |
| `npm run start` | Start production server |
| `npm run seed` | Seed the database with initial data |
| `npm run lint` | Run ESLint |

## Deployment

The app is designed to deploy on [Vercel](https://vercel.com). Set all environment variables in your Vercel project settings. The build command (`prisma generate && next build`) is configured in `package.json`.
