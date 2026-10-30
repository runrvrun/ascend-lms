"use client"

import { useState } from "react"
import { ShieldCheck, Users, PenLine, GraduationCap, ChevronDown, ChevronRight, BookOpen, BarChart3, ClipboardList, UserCog, UsersRound, Map, Target, Bell, Home, Lightbulb, Megaphone, KeyRound, CalendarClock, Settings, History, Image as ImageIcon, Star, Route } from "lucide-react"
import { RELEASE_NOTES, type ChangeKind } from "./releaseNotes"

type Role = "learner" | "admin" | "owner" | "manager" | "trainer" | "sme"
type Tab = Role | "releases"

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: "learner",  label: "Learner",       icon: GraduationCap, color: "text-blue-700",   bg: "bg-blue-50 border-blue-200"   },
  { id: "admin",    label: "Admin",         icon: ShieldCheck,   color: "text-red-700",    bg: "bg-red-50 border-red-200"     },
  { id: "owner",    label: "Pathway Owner", icon: Route,         color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  { id: "manager",  label: "Manager",       icon: Users,         color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  { id: "trainer",  label: "Trainer",       icon: PenLine,       color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  { id: "sme",      label: "SME",           icon: Lightbulb,     color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  { id: "releases", label: "Release Notes", icon: Megaphone,     color: "text-teal-700",   bg: "bg-teal-50 border-teal-200"   },
]

type Section = { title: string; icon: React.ElementType; steps: (string | { heading: string; items: string[] })[] }

const CONTENT_TYPES = [
  "YouTube Video — a YouTube video, which may include pop quizzes.",
  "SharePoint Video — a video stored in SharePoint (paste its embed link).",
  "Text — written content.",
  "PDF and PPT — a SharePoint PDF or PowerPoint shown inside the course (open the file in a web browser, then use Embed to copy its link).",
  "In Person — a face-to-face session, with an optional description.",
  "External Link — a link to another website, with an optional picture that opens the link when clicked.",
  "Image — a picture uploaded from your computer, with an optional caption. Pictures are resized and compressed automatically before upload.",
]

const CONTENT: Record<Role, { intro: string; sections: Section[] }> = {
  learner: {
    intro: "As a Learner, you can browse and enroll in learning pathways, complete course content, take tests, submit assignments, and track your progress. Everyone in Ascend is a learner.",
    sections: [
      {
        title: "Home Dashboard",
        icon: Home,
        steps: [
          "After signing in, you land on the Home page.",
          "My Pathways shows the pathways you are still working on, with a progress bar for each. When there are more than fit, click View all to open the full list.",
          "You can see your points, your learning streak (how many days in a row you have learned) and recent points earned. Click View full history to open your Learning History.",
          "The Leaderboards show the top learners by points and by streak. The top 3 get gold, silver and bronze medals.",
          "Use the menu button at the top of the left menu to hide or show it. On a phone, the menu opens on top of the page.",
        ],
      },
      {
        title: "Browsing & Enrolling in Pathways",
        icon: Map,
        steps: [
          "Click Pathways in the left menu.",
          "Recommended for You at the top shows the pathways featured by the Learning team. It is hidden when nothing is featured.",
          "Use the search box to find pathways by name or tag. Some pathways are hidden and only appear once an admin or manager assigns you to them.",
          "Click Preview on a pathway to see its courses, trainers and first lesson before enrolling.",
          "Click Share to send a pathway to a colleague. They get a notification and an email with a link — sharing does not enroll them.",
          {
            heading: "To enroll:",
            items: [
              "If the pathway is free to enroll, click Enroll — you are enrolled immediately.",
              "If the pathway needs approval, click Request Enrollment, add an optional note, and submit. Your manager is notified, and you will be notified once they approve or reject the request.",
            ],
          },
        ],
      },
      {
        title: "My Pathways & Learning History",
        icon: History,
        steps: [
          "The My Pathways page (View all on the Home page) lists all your pathways. Click Open to continue one, or Review to look back at a completed one.",
          "To leave a pathway you haven't finished, click the unenroll icon next to it on My Pathways.",
          "Learning History lists everything you have completed and the points you earned. Completed pathways have a View Certificate link.",
        ],
      },
      {
        title: "Taking a Course",
        icon: BookOpen,
        steps: [
          "Open a pathway you are enrolled in from the Home page or the Pathways page.",
          "The course outline on the left lists the courses in the pathway, sometimes grouped under section headings. On a phone, tap Contents to open it.",
          "Click a lesson to open it. Lessons can be videos, written text, PDFs, slides, in-person sessions, links or pictures.",
          "For videos, you must watch at least 75% before you can mark them as complete. YouTube videos may pause for a pop quiz — answer correctly to keep watching.",
          "Click Mark as Completed to record your progress, then use Next Lesson to move on (or Previous Lesson to go back).",
          "If a SharePoint video, PDF or slide doesn't load, click Content not loading? below it for tips (usually you need to sign in to Microsoft in the same browser), or use Open in new tab.",
          "Each lesson has a discussion area where you can ask questions and reply to others.",
          "When you finish a course, you can rate it and leave feedback.",
        ],
      },
      {
        title: "Taking a Test",
        icon: ClipboardList,
        steps: [
          "Tests appear in the course outline wherever the trainer placed them — a course can have more than one.",
          "Click a test to open it, then click Start Test. Answer all questions — multiple choice, true/false, fill-in-the-blank, ranking, or matching.",
          "Click Submit Test when done. Your score is shown immediately.",
          "If you reach the test's passing score, it is marked as passed. If not, you can retake it.",
          "A course is complete once all of its lessons are done, every test is passed, and its assignment (if any) is passed.",
        ],
      },
      {
        title: "Submitting an Assignment",
        icon: ClipboardList,
        steps: [
          "Some courses have an assignment. Read the instructions in the course.",
          "Upload your file directly (up to 20 MB), or paste a link to your work (for example, a SharePoint file).",
          "Click Submit. Your trainer reviews it and marks it as passed or failed, and you are notified of the result.",
          "Uploaded files are deleted after 6 months, but your grade is kept.",
        ],
      },
      {
        title: "Deadlines & Reminder Emails",
        icon: CalendarClock,
        steps: [
          "An assigned pathway may have a deadline. You get a reminder email the day before and on the deadline day.",
          "One week after the deadline, the pathway is locked: you can still view its content, but you can't complete lessons, take tests or submit assignments. Contact your manager or admin if you need more time.",
          "If you have unfinished pathways, you also get a reminder email every Wednesday. Its Start Learning button takes you straight to your next course.",
          "Admins may also schedule extra reminders with a personal message.",
        ],
      },
      {
        title: "My Growth Plan",
        icon: Target,
        steps: [
          "Click My Growth Plan in the left menu to manage your personal development goals.",
          "Click Add Item to create a goal. You can optionally link it to a pathway.",
          "Once you have acted on a goal, click the checkmark to mark it as completed.",
          "Your manager reviews your completed goals and confirms them. You are notified when a goal is confirmed, and it gets a green badge.",
        ],
      },
      {
        title: "Notifications",
        icon: Bell,
        steps: [
          "The bell icon at the bottom of the left menu shows how many unread notifications you have. Click it to open the Notifications page.",
          "Notifications cover enrollment approvals and rejections, new pathway assignments, pathways shared with you, assignment grades, growth plan confirmations, and replies to your comments.",
          "Click the link in a notification to go straight to the relevant page.",
        ],
      },
      {
        title: "Settings",
        icon: Settings,
        steps: [
          "Click the gear icon at the bottom of the left menu.",
          "Turn the weekly learning reminder emails on or off.",
          "Set or change a password for signing in with email (not needed if you sign in with Microsoft).",
        ],
      },
    ],
  },

  admin: {
    intro: "As an Admin, you have full control over users, learning content, cohorts, and settings. All admin pages are under Admin in the left menu.",
    sections: [
      {
        title: "How Roles Work",
        icon: KeyRound,
        steps: [
          "Admin is the only role you give by hand (Users → Actions → Assign Roles).",
          {
            heading: "Every other role follows what a person is assigned to:",
            items: [
              "Manager — anyone who has at least one direct report (Actions → Assign Managers on the team member).",
              "Trainer — anyone assigned as a trainer on a course.",
              "Subject Matter Expert — anyone assigned as SME on a topic.",
              "Pathway Owner — anyone set as an owner of a pathway.",
            ],
          },
          "The matching menu appears for them automatically and disappears when they no longer have that assignment — usually the next time they open or refresh a page.",
          "Anyone can be picked as a manager, trainer, SME or pathway owner.",
        ],
      },
      {
        title: "Managing Users",
        icon: UserCog,
        steps: [
          "Go to Admin → Users. Use the filters to narrow by division, title, office or role.",
          "New colleagues with a company Microsoft account are added automatically, and people who leave are deactivated automatically.",
          "Click Add User to create a user by hand (name, email, division, title, office).",
          "To add many users at once, click Import, download the template, fill it in and upload it. Click Export to download all users in the same format.",
          {
            heading: "From each user's Actions menu:",
            items: [
              "Progress — the User Progress Report: completed pathways and courses, on-time completion, streaks, points and an Attention needed list. Click Download Excel Report for a copy.",
              "Edit — change name, email, division, title or office.",
              "Assign Roles — give or remove Admin.",
              "Assign Managers — link the user to one or more managers.",
              "Assign Cohorts — add the user to cohorts.",
              "Send Activation Email / Change Password — for people who sign in with email and password.",
              "Delete — deactivates the user. Their history is kept, and adding the same email again restores them.",
            ],
          },
        ],
      },
      {
        title: "Managing Cohorts",
        icon: UsersRound,
        steps: [
          "Go to Admin → Cohorts and click Add Cohort to create a group.",
          "Members — add or remove people, upload members in bulk from Excel, or download the member list.",
          "Pathways — assign pathways to the whole cohort, optionally with a deadline. Everyone in the cohort is enrolled and notified by email.",
          "People added to the cohort later are enrolled in its pathways automatically (with the same deadline); people removed lose those cohort enrollments.",
          "View Progress — see how the cohort is doing.",
        ],
      },
      {
        title: "Managing Pathways",
        icon: Map,
        steps: [
          "Go to Admin → Pathways and click Add Pathway.",
          "Fill in the name, description and tags, and pick the owners (optional).",
          "Choose who can see it: Public — free enroll, Public — needs approval (the learner's manager must approve), or Hidden — assigned only.",
          "Use the status button to switch between Draft and Published, and the star to feature it. Up to 2 pathways can be featured; they appear under Recommended for You on the Pathways page.",
          {
            heading: "From each pathway's Actions menu:",
            items: [
              "Manage Courses — add courses with their points, reorder them with the arrows, and add section headings to group them.",
              "Manage Enrollments — enroll people or cohorts (optionally with a deadline), change deadlines, schedule reminder emails, or remove enrollments.",
              "Preview — see the pathway as a learner would.",
              "Edit, Duplicate (the copy starts as a draft with no one enrolled), or Delete.",
            ],
          },
        ],
      },
      {
        title: "Managing Courses",
        icon: BookOpen,
        steps: [
          "Go to Admin → Courses and click Add Course. Set the name, description, topic and one or more trainers.",
          {
            heading: "From each course's Actions menu:",
            items: [
              "Manage Contents — add lessons, tests, pop quizzes and an assignment (see the Trainer tab for details).",
              "Preview — see the course as a learner would.",
              "Report — enrollment, completion, test, assignment and feedback results, with an Excel download.",
              "Export — download the course as a file. Use Import on the Courses page to bring it into another Ascend server as a new draft.",
              "Edit, Duplicate (the copy starts as a draft), or Delete.",
            ],
          },
          "Use the status button on the course page to switch between Draft and Published.",
        ],
      },
      {
        title: "Managing Topics & SMEs",
        icon: Lightbulb,
        steps: [
          "Go to Admin → Topics and click Add Topic.",
          "In each topic card, search for and add Subject Matter Experts. Anyone can be an SME.",
          "Assign courses to a topic when creating or editing them.",
        ],
      },
      {
        title: "Managing Offices",
        icon: UsersRound,
        steps: [
          "Go to Admin → Offices to add, edit or delete office locations used to group users.",
        ],
      },
      {
        title: "Analytics",
        icon: BarChart3,
        steps: [
          "Go to Admin → Analytics for a company-wide overview.",
          "Use the filters at the top to narrow by division, title or office.",
          "See total users, enrollments, completion rate and average points, plus top pathways, breakdowns by division and title, and the leaderboard.",
        ],
      },
    ],
  },

  owner: {
    intro: "As a Pathway Owner, you manage the pathways an admin has made you owner of. You'll find them under Admin → Pathways, which only lists your pathways.",
    sections: [
      {
        title: "What You Can Do",
        icon: Route,
        steps: [
          "Edit your pathway's name, description, tags and visibility, and switch it between Draft and Published.",
          "Manage Courses — add, reorder and remove courses, set points, and add section headings.",
          "Manage Enrollments — enroll people or cohorts, set or change deadlines, schedule reminder emails, and remove enrollments.",
          "Preview the pathway as a learner would.",
          "Only admins can add a new pathway, change owners, feature, duplicate or delete a pathway, or edit the courses themselves.",
        ],
      },
    ],
  },

  manager: {
    intro: "You're a Manager when at least one person has you as their manager. You can follow your team's learning, approve pathway requests, assign pathways, and confirm growth plan goals from the Manager section in the left menu.",
    sections: [
      {
        title: "Viewing Your Team",
        icon: Users,
        steps: [
          "Go to Manager → Professionals to see everyone who reports to you.",
          "Each row shows the person's division, title, enrolled and completed pathways, and points.",
          "Click Assign Pathway to enroll a team member in a pathway, optionally with a deadline. They get a notification and an email.",
          "Click View Progress to open their detailed progress page.",
        ],
      },
      {
        title: "Team Member Detail",
        icon: UserCog,
        steps: [
          "The Learning tab lists their pathways. Expand one to see every course, lesson, test and assignment, with completion dates and anything waiting for review.",
          "Use the edit icon next to a deadline to change it.",
          "The Growth Plan tab shows their personal goals for you to confirm.",
        ],
      },
      {
        title: "Approving Pathway Requests",
        icon: ClipboardList,
        steps: [
          "You are notified when a team member asks to join a pathway that needs approval.",
          "Go to Manager → Pathway Requests to see pending requests, with any note they added.",
          "Click Approve, or Reject with a reason. They are notified of your decision.",
        ],
      },
      {
        title: "Confirming Growth Plans",
        icon: Target,
        steps: [
          "You are notified when a team member marks a growth plan goal as completed.",
          "Click the notification to open their Growth Plan tab, review the goal and click Confirm.",
        ],
      },
      {
        title: "Team Analytics",
        icon: BarChart3,
        steps: [
          "Go to Manager → Analytics for your team's numbers: team size, active enrollments, completion rate and average points.",
          "Use the filters to narrow by division, title or office, and scroll down for pathway progress and the team leaderboard.",
        ],
      },
    ],
  },

  trainer: {
    intro: "You're a Trainer when you are assigned to at least one course. You can manage those courses — content, tests, assignments and grading — from the Trainer section in the left menu.",
    sections: [
      {
        title: "Viewing Your Courses",
        icon: BookOpen,
        steps: [
          "Go to Trainer → My Courses to see the courses you train.",
          "Each card shows the number of lessons and tests and whether there is an assignment. Click a card to manage the course.",
          "Click Preview on the course page to see it exactly as learners will.",
        ],
      },
      {
        title: "Adding Course Content",
        icon: ImageIcon,
        steps: [
          "On the Content tab, click Add Content and choose a type:",
          { heading: "Content types:", items: CONTENT_TYPES },
          "Use Position to place the new item anywhere in the course.",
          "For SharePoint videos, enter the duration — learners must watch 75% of it before they can mark it complete.",
          "Use the edit and delete icons to change or remove content, and the up/down arrows to reorder.",
        ],
      },
      {
        title: "Pop Quizzes (YouTube videos)",
        icon: ClipboardList,
        steps: [
          "In the Pop Quiz section, add a multiple-choice question to a YouTube video at a chosen time.",
          "The video pauses at that moment and only continues once the learner answers correctly.",
        ],
      },
      {
        title: "Creating a Test",
        icon: ClipboardList,
        steps: [
          "In the Tests section, click Add Test. A course can have any number of tests.",
          "Give it a title (e.g. \"Module 1 Quiz\"), choose its Position among the lessons, and set the passing score (e.g. 70 means 70% or above passes).",
          "Click Add Question. Types: Multiple Choice, True/False, Fill in the Blank, Ranking and Matching. Mark the correct answers, order or pairs.",
          "Edit or delete tests and questions at any time. You can move a test from its Edit Test window or with the up/down arrows.",
        ],
      },
      {
        title: "Creating an Assignment",
        icon: ClipboardList,
        steps: [
          "In the Assignment section, click Create Assignment and describe what learners need to do.",
          "Optionally add a SharePoint folder link. Learners can upload a file directly or paste a link to their work.",
        ],
      },
      {
        title: "Grading Submissions",
        icon: ClipboardList,
        steps: [
          "Open the Submissions tab to see all submitted assignments.",
          "Click Grade, open the learner's file or link, choose Passed or Failed, add optional feedback, and click Save.",
          "The learner is notified of the result.",
        ],
      },
      {
        title: "Viewing Feedback",
        icon: Star,
        steps: [
          "Open the Feedback tab to see the average star rating and each learner's comments.",
          "Use the toggle at the top to turn feedback collection on or off for the course.",
        ],
      },
    ],
  },

  sme: {
    intro: "You're a Subject Matter Expert (SME) when you are assigned to a topic. You look after all the courses in your topics, with the same course tools as a Trainer, from the Subject Matter Expert section in the left menu.",
    sections: [
      {
        title: "Viewing Your Topics & Courses",
        icon: Lightbulb,
        steps: [
          "Go to Subject Matter Expert → My Topics to see your topics and their courses.",
          "Each course card shows its content, tests, assignment, trainers and status.",
          "Click New Course to create a course in your topic, optionally with trainers.",
          "Click a course card to manage it, or Preview to see it as learners will.",
        ],
      },
      {
        title: "Managing Trainers",
        icon: PenLine,
        steps: [
          "On the course page, the Trainers section shows who trains the course.",
          "Click Add Trainer and search for anyone — they get the Trainer menu automatically.",
          "Click Remove next to a trainer to unassign them.",
        ],
      },
      {
        title: "Managing Course Content, Tests & Assignments",
        icon: BookOpen,
        steps: [
          "Content, pop quizzes, tests, assignments, grading and feedback work the same as for Trainers — see the Trainer tab for step-by-step instructions.",
        ],
      },
    ],
  },
}

const KIND_STYLES: Record<ChangeKind, { label: string; className: string }> = {
  new:      { label: "New",      className: "bg-blue-100 text-blue-700" },
  improved: { label: "Improved", className: "bg-green-100 text-green-700" },
  fixed:    { label: "Fixed",    className: "bg-amber-100 text-amber-700" },
}

function formatReleaseDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

function ReleaseDaySection({ day, defaultOpen }: { day: (typeof RELEASE_NOTES)[number]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-800">{formatReleaseDate(day.date)}</span>
          <span className="text-xs text-slate-400">{day.changes.length} {day.changes.length === 1 ? "change" : "changes"}</span>
        </div>
        {open ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
      </button>
      {open && (
        <ul className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4">
          {day.changes.map((change, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
              <span className={`mt-0.5 w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold ${KIND_STYLES[change.kind].className}`}>
                {KIND_STYLES[change.kind].label}
              </span>
              <span>{change.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  const Icon = section.icon
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className="shrink-0 text-slate-500" />
          <span className="font-semibold text-slate-800">{section.title}</span>
        </div>
        {open ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <ol className="flex flex-col gap-3">
            {section.steps.map((step, i) =>
              typeof step === "string" ? (
                <li key={i} className="flex gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ) : (
                <li key={i} className="flex gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>
                  <div>
                    <p className="font-medium text-slate-800">{step.heading}</p>
                    <ul className="mt-1.5 flex flex-col gap-1 pl-4">
                      {step.items.map((item, j) => (
                        <li key={j} className="list-disc text-slate-600">{item}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              )
            )}
          </ol>
        </div>
      )}
    </div>
  )
}

export function HelpContent() {
  const [activeTab, setActiveTab] = useState<Tab>("learner")
  const tab = TABS.find((t) => t.id === activeTab)!
  const content = activeTab === "releases" ? null : CONTENT[activeTab]

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">User Guide</h1>
        <p className="mt-1 text-sm text-slate-500">Step-by-step instructions for each role in Ascend, and what&apos;s new.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === activeTab
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                active ? `${t.bg} ${t.color}` : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Intro */}
      <div className={`mb-6 rounded-2xl border p-5 ${tab.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          <tab.icon size={16} className={tab.color} />
          <span className={`font-semibold ${tab.color}`}>{tab.label}</span>
        </div>
        <p className="text-sm text-slate-700">
          {content ? content.intro : "Everything that has changed in Ascend, newest first. Click a day to see its changes."}
        </p>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {content
          ? content.sections.map((section) => <AccordionSection key={`${activeTab}-${section.title}`} section={section} />)
          : RELEASE_NOTES.map((day, i) => <ReleaseDaySection key={day.date} day={day} defaultOpen={i === 0} />)}
      </div>
    </main>
  )
}
