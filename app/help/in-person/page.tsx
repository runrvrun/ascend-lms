import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  GraduationCap,
  MoreHorizontal,
  PenLine,
  PlayCircle,
  Printer,
  QrCode,
  Smartphone,
  Users,
} from "lucide-react"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { SidebarWithStats } from "../../components/SidebarWithStats"

export const metadata: Metadata = { title: "In-Person Sessions Guide" }

// A walkthrough of in-person sessions: what trainers/admins do with the QR code and the
// attendance list, and how learners check in. Linked from the Help page, the attendance
// popups and the in-person lesson.

function Step({ n, title, children, mock }: { n: number; title: string; children: React.ReactNode; mock?: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <div className="mt-1 space-y-2 text-sm text-slate-600">{children}</div>
        {mock && <div className="mt-3">{mock}</div>}
      </div>
    </li>
  )
}

// Small, non-interactive pictures of the real screens, so people recognise them.
function Mock({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="max-w-md rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3" aria-label={label}>
      {children}
      <figcaption className="mt-2 text-[11px] text-slate-400">{label}</figcaption>
    </figure>
  )
}

function Section({ id, icon: Icon, title, intro, color, children }: { id: string; icon: React.ElementType; title: string; intro: string; color: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
      <div className="mb-1 flex items-center gap-2">
        <Icon size={18} className={color} />
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <p className="mb-6 text-sm text-slate-500">{intro}</p>
      <ol className="flex flex-col gap-7">{children}</ol>
    </section>
  )
}

export default async function InPersonGuidePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/?callbackUrl=/help/in-person")

  return (
    <div className="min-h-screen bg-slate-50 md:pl-72 sidebar-collapsed:pt-14 md:sidebar-collapsed:pt-0 md:sidebar-collapsed:pl-14">
      <SidebarWithStats session={session} />
      <main className="mx-auto w-full max-w-3xl p-6 md:p-10">
        <a href="/help" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} />
          User Guide
        </a>
        <h1 className="text-2xl font-bold text-slate-900">In-Person Sessions</h1>
        <p className="mt-1 text-sm text-slate-500">
          How attendance works for face-to-face sessions: what trainers and admins do, and how learners check in.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: QrCode, title: "Check in with the QR code", text: "Learners scan the printed code at the session." },
            { icon: Users, title: "Marked by the trainer", text: "Trainers and admins tick people off or paste emails." },
            { icon: PlayCircle, title: "Watch the recording", text: "For anyone who couldn't attend." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-4">
              <Icon size={18} className="text-blue-600" />
              <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Any one of the three completes the session. Learners can&apos;t mark an in-person session as completed themselves.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2 text-sm">
          <a href="#trainers" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 font-semibold text-green-700">
            <PenLine size={15} />
            For trainers &amp; admins
          </a>
          <a href="#learners" className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-700">
            <GraduationCap size={15} />
            For learners
          </a>
        </nav>

        <div className="mt-6 flex flex-col gap-6">
          <Section
            id="trainers"
            icon={PenLine}
            color="text-green-700"
            title="For trainers & admins"
            intro="Admins can do this for every course; trainers for the courses they train. Subject Matter Experts can't manage attendance."
          >
            <Step n={1} title="Open the in-person lesson's Actions menu">
              <p>
                Go to <span className="font-medium text-slate-800">Trainer → My Courses</span> (admins: <span className="font-medium text-slate-800">Admin → Courses</span>), open the course, and find the In Person lesson on the Contents tab. Its{" "}
                <span className="font-medium text-slate-800">Actions</span> menu has two extra options: <span className="font-medium text-slate-800">Check-in QR code</span> and{" "}
                <span className="font-medium text-slate-800">Attendance</span>.
              </p>
              <p>No in-person lesson yet? Click Add Lesson and choose In Person as the lesson type.</p>
            </Step>

            <Step
              n={2}
              title="Print the QR code before the session"
              mock={
                <Mock label="The printable page">
                  <div className="rounded-lg bg-white p-4 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Attendance check-in</p>
                    <p className="text-sm font-bold text-slate-900">Negotiation Workshop</p>
                    <QrCode size={72} className="mx-auto my-2 text-slate-800" />
                    <p className="text-[11px] text-slate-500">
                      No camera? Enter the code <span className="font-mono font-bold text-slate-900">K7MX-3QPA</span>
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <Printer size={11} /> Print
                    </span>
                  </div>
                </Mock>
              }
            >
              <p>
                Choose <span className="font-medium text-slate-800">Check-in QR code</span>, then <span className="font-medium text-slate-800">Open printable QR code</span>. A page opens with the
                session name, a large QR code, three short instructions and the code to type in. Click <span className="font-medium text-slate-800">Print</span>.
              </p>
              <p>
                The code never changes, so one printout works for every run of the session. You can also show the page on a screen instead of printing it.
              </p>
            </Step>

            <Step n={3} title="Pass it around the room">
              <p>
                Attendees scan it with their phone camera and tap Check in (see the learner steps below). Their attendance is recorded straight away, in every pathway they have
                that includes the course.
              </p>
              <p>Learners must be enrolled in a pathway with this course to check in. Enroll or assign them beforehand.</p>
            </Step>

            <Step
              n={4}
              title="Check and complete the attendance list"
              mock={
                <Mock label="The Attendance popup">
                  <div className="overflow-hidden rounded-lg bg-white text-[11px] shadow-sm">
                    {[
                      { name: "Aiko Tanaka", status: "Checked in (QR)" },
                      { name: "Budi Santoso", status: "Marked present" },
                      { name: "Chen Wei", status: null, ticked: true },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 last:border-0">
                        <span className={`h-3 w-3 rounded border ${r.ticked ? "border-blue-600 bg-blue-600" : "border-slate-300"}`} />
                        <span className="flex-1 font-medium text-slate-800">{r.name}</span>
                        {r.status ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            <CheckCircle2 size={10} />
                            {r.status}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not yet</span>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end gap-1.5 bg-slate-50 px-3 py-1.5">
                      <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600">Mark not attended</span>
                      <span className="rounded bg-blue-600 px-2 py-0.5 text-white">Mark present</span>
                    </div>
                  </div>
                </Mock>
              }
            >
              <p>
                Choose <span className="font-medium text-slate-800">Attendance</span> from the lesson&apos;s Actions menu. It lists everyone enrolled in a pathway with this course and how
                each person completed the session: checked in with the QR code, marked present, or watched the recording.
              </p>
              <p>
                To add people who didn&apos;t scan, tick them (search by name or email if the list is long) and click{" "}
                <span className="font-medium text-slate-800">Mark present</span>. To undo a mistake, tick them and click{" "}
                <span className="font-medium text-slate-800">Mark not attended</span>.
              </p>
            </Step>

            <Step
              n={5}
              title="Or paste a list of emails"
              mock={
                <Mock label="Paste emails">
                  <div className="rounded-lg bg-white p-3 text-[11px] shadow-sm">
                    <div className="flex items-center gap-1.5 font-medium text-slate-700">
                      <ClipboardPaste size={12} /> Paste emails
                    </div>
                    <div className="mt-1.5 rounded border border-slate-200 p-2 font-mono text-slate-500">
                      aiko.tanaka@ycp.com; budi.santoso@ycp.com
                      <br />
                      Chen Wei &lt;chen.wei@ycp.com&gt; Joined 09:58
                    </div>
                  </div>
                </Mock>
              }
            >
              <p>
                In the Attendance popup, click <span className="font-medium text-slate-800">Paste emails</span> and paste any text that contains the attendees&apos; email addresses, for
                example a Teams attendance report or a sign-in sheet. Only the email addresses are used, so you don&apos;t need to clean the text up.
              </p>
              <p>
                Click <span className="font-medium text-slate-800">Mark present</span>. Ascend tells you how many were marked, and lists anyone who isn&apos;t enrolled in a pathway with
                this course or isn&apos;t an Ascend user, so you can follow up.
              </p>
            </Step>

            <Step n={6} title="Add the recording for people who missed it (optional)">
              <p>
                Edit the in-person lesson and paste the recording link into <span className="font-medium text-slate-800">Recording URL</span> (for a SharePoint video, also enter its
                length). Learners who weren&apos;t there can then watch it to complete the session.
              </p>
            </Step>

            <li className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              <span className="font-semibold">Deadlines:</span> when a pathway closes 7 days after its deadline, learners can no longer check in, but trainers and admins can still mark
              them present.
            </li>
          </Section>

          <Section
            id="learners"
            icon={GraduationCap}
            color="text-blue-700"
            title="For learners"
            intro="You need to be enrolled in the pathway that includes the session. Have your phone with you."
          >
            <Step
              n={1}
              title="Scan the QR code"
              mock={
                <Mock label="Your phone camera">
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <Smartphone size={36} className="shrink-0 text-slate-500" />
                    <p>Point the camera at the code and tap the link that pops up. No app needed.</p>
                  </div>
                </Mock>
              }
            >
              <p>When the QR code comes round, open your phone&apos;s camera, point it at the code and tap the link that appears.</p>
            </Step>

            <Step n={2} title="Sign in to Ascend">
              <p>
                If you&apos;re not signed in on your phone yet, the Ascend sign-in page opens. Tap <span className="font-medium text-slate-800">Sign in with YCP Microsoft Account</span>{" "}
                and sign in with your usual YCP email and password (and approve the sign-in in Microsoft Authenticator if asked).
              </p>
              <p>After signing in you&apos;re taken straight back to the check-in page. You only need to sign in once; next time your phone remembers you.</p>
            </Step>

            <Step
              n={3}
              title="Tap Check in"
              mock={
                <Mock label="The check-in page">
                  <div className="rounded-lg bg-white p-4 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">In Person Session</p>
                    <p className="text-sm font-bold text-slate-900">Negotiation Workshop</p>
                    <span className="mt-2 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Check in to this session</span>
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
                      <CheckCircle2 size={11} /> You&apos;re checked in. Thanks for attending!
                    </p>
                  </div>
                </Mock>
              }
            >
              <p>
                Check the session name, then tap <span className="font-medium text-slate-800">Check in to this session</span>. You&apos;ll see{" "}
                <span className="font-medium text-slate-800">You&apos;re checked in</span>, and the session shows as Completed in your pathway.
              </p>
            </Step>

            <Step n={4} title="No camera? Type the code instead">
              <p>
                Open the pathway in Ascend, go to the in-person session, and type the code printed under the QR (like <span className="font-mono font-semibold text-slate-800">K7MX-3QPA</span>)
                into the <span className="font-medium text-slate-800">Attending in person?</span> box, then click Check in.
              </p>
            </Step>

            <Step n={5} title="Couldn't attend?">
              <p>
                Once your trainer adds the recording, it appears in the session lesson. Watch it, then click <span className="font-medium text-slate-800">Mark as Completed</span>. You can
                also ask your trainer to mark you present if you were there but couldn&apos;t check in.
              </p>
            </Step>

            <li className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">If check-in doesn&apos;t work</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium text-slate-800">&quot;You&apos;re not enrolled in a pathway that includes…&quot;</span> Ask your trainer or an admin to enroll you, then scan
                  again, or they can mark you present.
                </li>
                <li>
                  <span className="font-medium text-slate-800">&quot;Your pathway with this session closed…&quot;</span> The pathway&apos;s deadline has passed. Your trainer or an admin
                  can still mark you present.
                </li>
                <li>
                  <span className="font-medium text-slate-800">&quot;Check-in code not found&quot;</span> The QR code or the typed code is for a different session, or was mistyped.
                </li>
                <li>
                  <span className="font-medium text-slate-800">&quot;You were already checked in.&quot;</span> Nothing more to do.
                </li>
              </ul>
            </li>
          </Section>
        </div>

        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400">
          <MoreHorizontal size={14} />
          The names and codes in the pictures above are examples.
        </p>
      </main>
    </div>
  )
}
