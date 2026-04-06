"use client"

import { useState } from "react"
import { ShieldCheck, Users, PenLine, GraduationCap, ChevronDown, ChevronRight, BookOpen, BarChart3, ClipboardList, UserCog, UsersRound, Map, Target, Bell, Home, Lightbulb } from "lucide-react"

type Role = "learner" | "admin" | "manager" | "trainer" | "sme"

const ROLES: { id: Role; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: "learner",  label: "Learner",  icon: GraduationCap, color: "text-blue-700",   bg: "bg-blue-50 border-blue-200"   },
  { id: "admin",   label: "Admin",   icon: ShieldCheck,   color: "text-red-700",    bg: "bg-red-50 border-red-200"     },
  { id: "manager", label: "Manager", icon: Users,         color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  { id: "trainer", label: "Trainer", icon: PenLine,       color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  { id: "sme",     label: "SME",     icon: Lightbulb,     color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
]

type Section = { title: string; icon: React.ElementType; steps: (string | { heading: string; items: string[] })[] }

const CONTENT: Record<Role, { intro: string; sections: Section[] }> = {
  learner: {
    intro: "As a Learner, you can browse and enroll in learning pathways, complete course content, take tests, submit assignments, and track your progress.",
    sections: [
      {
        title: "Home Dashboard",
        icon: Home,
        steps: [
          "After signing in, you land on the Home page.",
          "The dashboard shows your active learning pathways with a progress bar for each.",
          "You can see your current points, learning streak, and your rank on the leaderboard.",
          "Recent activity is shown at the bottom of the page.",
        ],
      },
      {
        title: "Browsing & Enrolling in Pathways",
        icon: Map,
        steps: [
          "Click Pathways in the left sidebar.",
          "Browse all available published pathways. Each card shows the pathway name, description, and tags.",
          "Click a pathway card to view its details and the list of courses inside.",
          {
            heading: "To enroll:",
            items: [
              "If the pathway does not require approval, click Enroll — you will be enrolled immediately.",
              "If the pathway requires manager approval, click Request Enrollment, add an optional note, and submit. You will be notified once your manager approves or rejects the request.",
            ],
          },
        ],
      },
      {
        title: "Taking a Course",
        icon: BookOpen,
        steps: [
          "Open a pathway you are enrolled in from the Home dashboard or the Pathways page.",
          "The left panel shows the list of courses in the pathway. Click a course to expand it and see its contents.",
          "Click a content item (lesson, video, or link) to open it in the main panel.",
          "Read or watch the content. For videos, you must watch at least 75% before you can mark it as complete.",
          "Click Mark as Completed at the bottom of the content to record your progress.",
          "Work through all content items in a course before moving to the test or assignment.",
        ],
      },
      {
        title: "Taking a Test",
        icon: ClipboardList,
        steps: [
          "Once all content in a course is completed, the Test section becomes available at the bottom of the course.",
          "Click Start Test to begin. Answer all questions — multiple choice, true/false, fill-in-the-blank, ranking, or matching.",
          "Click Submit Test when done. Your score will be shown immediately.",
          "If you meet the passing threshold, the test is marked as passed. If not, you can retake it.",
        ],
      },
      {
        title: "Submitting an Assignment",
        icon: ClipboardList,
        steps: [
          "Some courses have an assignment in addition to a test.",
          "Read the assignment description and follow the instructions to upload your work to the provided SharePoint link.",
          "Copy the link to your submitted file, paste it into the submission field, and click Submit.",
          "Your trainer will review the submission and mark it as passed or failed. You will receive a notification with the result.",
        ],
      },
      {
        title: "My Growth Plan",
        icon: Target,
        steps: [
          "Click My Growth Plan in the sidebar to manage your personal development goals.",
          "Click Add Item to create a new growth plan goal. You can optionally link it to a specific pathway.",
          "Once you have acted on a goal, click the checkmark to mark it as completed.",
          "Your manager will review your completed goals and confirm them. You will be notified when a goal is confirmed.",
          "Confirmed goals are shown with a green badge.",
        ],
      },
      {
        title: "Notifications",
        icon: Bell,
        steps: [
          "The bell icon in the sidebar shows how many unread notifications you have.",
          "Click the bell to go to the Notifications page.",
          "Notifications inform you about pathway approvals or rejections, assignment grades, growth plan confirmations, and new pathway assignments.",
          "Click the action link in a notification to navigate directly to the relevant page.",
        ],
      },
    ],
  },

  admin: {
    intro: "As an Admin, you have full control over users, learning content, cohorts, and system configuration. All admin pages are found under the Admin section in the sidebar.",
    sections: [
      {
        title: "Managing Users",
        icon: UserCog,
        steps: [
          "Go to Admin → Users.",
          "Click Add User to create a single user. Fill in name, email, division, title, and office.",
          "To import multiple users at once, click Import, download the template, fill it in, and upload the completed file.",
          {
            heading: "After creating a user:",
            items: [
              "Use Actions → Assign Roles to grant them Admin, Manager, Trainer, or SME access.",
              "Use Actions → Assign Managers to link them to one or more managers.",
              "Use Actions → Assign Cohorts to add them to learning cohorts.",
              "Use Actions → Send Activation Email to send them a link to set their password.",
            ],
          },
          "To edit a user's name, email, division, title, or office, use Actions → Edit.",
          "To permanently delete a user, use Actions → Delete.",
        ],
      },
      {
        title: "Managing Cohorts",
        icon: UsersRound,
        steps: [
          "Go to Admin → Cohorts.",
          "Click Add Cohort to create a new cohort group.",
          "Open a cohort to manage its members and assigned pathways.",
          "Use the Members tab to add or remove users from the cohort.",
          "Use the Pathways tab to assign pathways to the entire cohort at once.",
        ],
      },
      {
        title: "Managing Pathways",
        icon: Map,
        steps: [
          "Go to Admin → Pathways.",
          "Click Add Pathway to create a new pathway. Fill in the name, description, and tags.",
          "Toggle Requires Approval if learners need manager sign-off before enrolling.",
          "Open a pathway to manage its courses — add, reorder, or remove courses, and set point values per course.",
          "Use the status toggle to publish or draft a pathway.",
        ],
      },
      {
        title: "Managing Courses",
        icon: BookOpen,
        steps: [
          "Go to Admin → Courses.",
          "Click Add Course to create a new course. Set the name, description, topic, and trainer.",
          "Click Manage Contents in the Actions menu to open the course detail page.",
          "In the course detail page you can add content (text, video link, or external link), create a test with questions, and set up an assignment.",
          "Use the status toggle at the top right to publish or draft the course.",
          "The Submissions tab shows all assignment submissions from learners for grading.",
          "The Feedback tab shows star ratings and comments left by learners.",
        ],
      },
      {
        title: "Managing Topics & SMEs",
        icon: Lightbulb,
        steps: [
          "Go to Admin → Topics.",
          "Click Add Topic to create a new topic category.",
          "In each topic card, use the SME search field to assign Subject Matter Experts to that topic.",
          "Courses can be assigned to a topic when creating or editing them.",
        ],
      },
      {
        title: "Managing Offices",
        icon: UsersRound,
        steps: [
          "Go to Admin → Offices to add, edit, or delete office locations.",
          "Offices are used to categorise users by location.",
        ],
      },
      {
        title: "Analytics",
        icon: BarChart3,
        steps: [
          "Go to Admin → Analytics for a system-wide overview.",
          "Use the filters at the top to narrow down by division, title, or office.",
          "Key metrics include total users, total enrolments, overall completion rate, and average points per user.",
          "Scroll down to see top pathways by enrolment, breakdown by division and title, and the global leaderboard.",
        ],
      },
    ],
  },

  manager: {
    intro: "As a Manager, you can view the learning progress of your team members, approve pathway requests, assign pathways, and confirm their growth plan goals. Access all Manager features from the Manager section in the sidebar.",
    sections: [
      {
        title: "Viewing Your Team",
        icon: Users,
        steps: [
          "Go to Manager → Professionals.",
          "You will see all users who have been assigned to you as their manager.",
          "Each row shows the team member's name, division, title, number of enrolled and completed pathways, and total points.",
          "Click View Progress on any team member to open their detailed progress page.",
        ],
      },
      {
        title: "Team Member Detail",
        icon: UserCog,
        steps: [
          "On the professional's detail page, the Learning tab shows all their enrolled pathways.",
          "For each pathway, you can see how many courses they have completed out of the total, and whether the pathway is finished.",
          "Use Assign Pathway to enrol a team member directly into a pathway. You can set a deadline.",
          "You can update the deadline for any existing enrolment using the edit icon next to it.",
          "Switch to the Growth Plan tab to see and confirm their personal development goals.",
        ],
      },
      {
        title: "Approving Pathway Requests",
        icon: ClipboardList,
        steps: [
          "Go to Manager → Pathway Requests.",
          "This page lists all pending enrolment requests from your team members.",
          "Each card shows who is requesting, which pathway, and any note they included.",
          "Click Approve to grant access, or Reject to decline. If rejecting, you must provide a reason.",
          "The team member will receive a notification with your decision.",
        ],
      },
      {
        title: "Confirming Growth Plans",
        icon: Target,
        steps: [
          "You will receive a notification whenever a team member marks a growth plan item as completed.",
          "Click the notification link to go directly to their Growth Plan tab.",
          "Review the completed item and click Confirm to acknowledge it.",
          "The team member will be notified that their goal has been confirmed.",
        ],
      },
      {
        title: "Team Analytics",
        icon: BarChart3,
        steps: [
          "Go to Manager → Analytics for metrics specific to your team.",
          "Use the filters at the top to narrow by division, title, or office.",
          "The dashboard shows team size, active enrolments, completion rate, and average points.",
          "Scroll down to see your team's pathway progress, breakdown by division and title, and the team leaderboard.",
        ],
      },
    ],
  },

  trainer: {
    intro: "As a Trainer, you can manage the courses assigned to you — including content, tests, assignments, and grading. Access your courses from the Trainer section in the sidebar.",
    sections: [
      {
        title: "Viewing Your Courses",
        icon: BookOpen,
        steps: [
          "Go to Trainer → My Courses.",
          "You will see all courses where you have been assigned as the trainer.",
          "Each card shows the number of content items, whether a test exists, and whether an assignment exists.",
          "Click a course card to open the course management page.",
        ],
      },
      {
        title: "Managing Course Content",
        icon: BookOpen,
        steps: [
          "On the course detail page, the Content tab shows all content items in the course.",
          "Click Add Content to create a new lesson. Choose the type: Text (written content), Video (SharePoint or other video URL), or Link (external resource).",
          "For Video content, set the duration in hours, minutes, and seconds — this determines the 75% watch threshold for completion.",
          "Use the edit and delete icons next to each item to update or remove content.",
          "Drag items to reorder them (or use the order field).",
        ],
      },
      {
        title: "Creating a Test",
        icon: ClipboardList,
        steps: [
          "In the course detail page, scroll to the Test section and click Create Test.",
          "Set the passing threshold percentage (e.g. 70 means learners must score 70% or above to pass).",
          "Click Add Question to add questions. Supported types: Multiple Choice, True/False, Fill in the Blank, Ranking, and Matching.",
          "For Multiple Choice, mark the correct answer(s). For Ranking, set the correct order. For Matching, set the key pairs.",
          "You can edit or delete questions at any time.",
        ],
      },
      {
        title: "Creating an Assignment",
        icon: ClipboardList,
        steps: [
          "In the course detail page, scroll to the Assignment section and click Create Assignment.",
          "Write a clear description of what learners need to do.",
          "Paste the SharePoint folder URL where learners should upload their work.",
          "Click Save. Learners will see the instructions and the upload link in their course view.",
        ],
      },
      {
        title: "Grading Submissions",
        icon: ClipboardList,
        steps: [
          "Click the Submissions tab on the course detail page to see all submitted assignments.",
          "Each row shows the learner's name, pathway, submission date, and current status.",
          "Click Grade on a submission to open the grading panel.",
          "Review the learner's submission by clicking the link to their uploaded file.",
          "Select Passed or Failed, add optional feedback notes, and click Save.",
          "The learner will receive a notification with the result.",
        ],
      },
      {
        title: "Viewing Feedback",
        icon: BarChart3,
        steps: [
          "Click the Feedback tab on the course detail page.",
          "You can see the average star rating and all individual reviews left by learners.",
          "Use the toggle at the top of the Feedback tab to enable or disable feedback collection for this course.",
        ],
      },
    ],
  },

  sme: {
    intro: "As a Subject Matter Expert (SME), you are responsible for the courses within your assigned topics. You have the same course management capabilities as a Trainer. Access your topics from the Subject Matter Expert section in the sidebar.",
    sections: [
      {
        title: "Viewing Your Topics & Courses",
        icon: Lightbulb,
        steps: [
          "Go to Subject Matter Expert → My Topics.",
          "You will see all topics you have been assigned to, grouped with their courses.",
          "Each course card shows its content count, whether it has a test or assignment, the assigned trainer, and its status.",
          "Click New Course to create a new course within your topic. You can assign a trainer during creation.",
          "Click a course card to open the course management page.",
        ],
      },
      {
        title: "Managing Trainers",
        icon: PenLine,
        steps: [
          "On the course detail page, the Trainers section at the top shows who is assigned to the course.",
          "Click Add Trainer to assign a trainer — only users with the Trainer role will appear in search results.",
          "Click Remove next to a trainer to unassign them.",
        ],
      },
      {
        title: "Managing Course Content, Tests & Assignments",
        icon: BookOpen,
        steps: [
          "The Content, Test, and Assignment management works the same as for Trainers.",
          "Refer to the Trainer section of this guide for detailed steps on adding content, creating tests, creating assignments, and grading submissions.",
        ],
      },
    ],
  },
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
  const [activeRole, setActiveRole] = useState<Role>("learner")
  const role = ROLES.find((r) => r.id === activeRole)!
  const content = CONTENT[activeRole]

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">User Guide</h1>
        <p className="mt-1 text-sm text-slate-500">Step-by-step instructions for each role in Ascend.</p>
      </div>

      {/* Role tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {ROLES.map((r) => {
          const Icon = r.icon
          const active = r.id === activeRole
          return (
            <button
              key={r.id}
              onClick={() => setActiveRole(r.id)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                active ? `${r.bg} ${r.color}` : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={15} />
              {r.label}
            </button>
          )
        })}
      </div>

      {/* Role intro */}
      <div className={`mb-6 rounded-2xl border p-5 ${role.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          <role.icon size={16} className={role.color} />
          <span className={`font-semibold ${role.color}`}>{role.label}</span>
        </div>
        <p className="text-sm text-slate-700">{content.intro}</p>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {content.sections.map((section) => (
          <AccordionSection key={section.title} section={section} />
        ))}
      </div>
    </main>
  )
}
