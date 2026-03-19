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
- **Dashboard** — overview of enrolled pathways and recent point activity
- **My Pathways** — sorted list of open, pending-approval, and completed pathways with unenroll option
- **Pathways page** — browse all available pathways, search by name or tag, enroll or request enrollment, see completion status

### For Development Managers
- **Professionals** — view all direct reports with division, title, office, and progress stats; search by name, division, title, or office
- **Pathway Requests** — approve or reject learner enrollment requests with an optional rejection reason

### For Admins
- **User Management** — create, edit, bulk-import users via Excel; assign cohorts per user; set division, title, office, and dev manager
- **Cohort Management** — create cohorts, assign pathways, manage members
- **Pathway Management** — create and edit pathways with name, description, approval requirement, and tags; manage courses per pathway
- **Course Management** — create courses, add content (text, video, link) and tests with multiple question types
- **Office Management** — create offices, assign users (one office per user), view and remove members

### Points & Progress
- Points awarded on course completion
- Pathway completion computed automatically when all courses in a pathway are done
- Recent activity feed on the dashboard

## Project Structure

```
app/
├── admin/
│   ├── cohort/        # Cohort CRUD + member management
│   ├── course/        # Course + content + test management
│   ├── office/        # Office CRUD + user assignment
│   ├── pathway/       # Pathway CRUD + course ordering
│   └── user/          # User CRUD + bulk import + cohort assignment
├── api/
│   ├── auth/          # NextAuth route handler
│   └── admin/         # REST endpoints (e.g. Excel template download)
├── components/        # Shared UI components (sidebar, cards)
├── dashboard/         # Learner dashboard page
├── devmanager/
│   ├── pathway-request/  # Approve / reject enrollment requests
│   └── professionals/    # Dev manager's team view
├── lib/               # Prisma client singleton
└── pathways/          # Learner-facing pathway browser
prisma/
├── schema.prisma      # Database schema
└── seed.ts            # Seed data (offices, pathways, courses)
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

## Database Schema (key models)

```
User        — employee profile with division, title, office (FK), dev manager
Office      — physical office locations (one-to-many with User)
Cohort      — group of users assigned to one or more pathways
Pathway     — learning pathway with courses, tags, and approval settings
Course      — unit of learning with ordered content and an optional test
PathwayEnrollment — tracks enrollment status (PENDING / APPROVED / REJECTED)
CourseProgress    — tracks course completion per user per pathway
UserPoint         — points ledger (source: COURSE_COMPLETION)
```

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
