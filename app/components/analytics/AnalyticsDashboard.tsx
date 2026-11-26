import { Users, Map, BookOpen, GraduationCap, TrendingUp, Activity, Award, Briefcase, Star, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, BarChart3, AlertTriangle, UsersRound } from "lucide-react"
import { prisma } from "../../lib/prisma"
import { loadAnalytics, type AnalyticsFilters, type AnalyticsViewer, type LearnerRow } from "../../lib/analytics"
import { AnalyticsFilter } from "../AnalyticsFilter"
import { StatCard, BarRow, BucketLegend, DistributionBar, CompletionHistogram, Card } from "./AnalyticsCharts"
import { PeopleTable } from "./PeopleTable"

type Tab = "users" | "pathways" | "courses" | "cohorts"

const TAB_META: Record<Tab, { label: string; icon: React.ElementType }> = {
  users: { label: "Users", icon: Users },
  pathways: { label: "Pathways", icon: Map },
  courses: { label: "Courses", icon: BookOpen },
  cohorts: { label: "Cohorts", icon: UsersRound },
}

export type AnalyticsSearchParams = AnalyticsFilters & { tab?: string; pathway?: string; course?: string; cohort?: string }

function fileSlug(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "export"
}

function hrefFor(basePath: string, filters: AnalyticsFilters, extra: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) params.set(k, v)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function LearnerList({ rows, unit, empty }: { rows: LearnerRow[]; unit: React.ReactNode; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>
  return (
    <div className="-mx-6 -mb-6 divide-y divide-slate-100 border-t border-slate-100">
      {rows.map((u, i) => (
        <div key={u.id} className="flex items-center gap-4 px-6 py-3">
          <span className={`w-6 text-center text-sm font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-slate-300"}`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{u.name}</p>
            <p className="text-xs text-slate-400">{u.sub}</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-800">
            {unit}
            <span className="font-semibold">{u.value.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export async function AnalyticsDashboard({
  viewer,
  basePath,
  searchParams,
}: {
  viewer: AnalyticsViewer
  basePath: string
  searchParams: AnalyticsSearchParams
}) {
  const isAdmin = viewer.roles.includes("ADMIN")
  const tabs: Tab[] = isAdmin ? ["users", "pathways", "courses", "cohorts"] : ["users", "pathways", "courses"]
  const tab: Tab = tabs.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "users"
  const filters: AnalyticsFilters = { division: searchParams.division, title: searchParams.title, officeId: searchParams.officeId }
  const hasFilter = !!(filters.division || filters.title || filters.officeId)

  const [offices, data] = await Promise.all([
    prisma.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    loadAnalytics({
      viewer,
      filters,
      pathwayId: tab === "pathways" ? searchParams.pathway : undefined,
      courseId: tab === "courses" ? searchParams.course : undefined,
      cohortTab: tab === "cohorts",
      cohortId: tab === "cohorts" ? searchParams.cohort : undefined,
    }),
  ])

  const learnerLabel = isAdmin ? "Users" : "Learners"
  const scopeText = isAdmin
    ? "Learning across the whole company, by user, pathway, course and cohort"
    : "Learning in your scope: your team, the courses you train or look after as an SME, and the pathways you own"

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">{scopeText}</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = TAB_META[t].icon
          const active = t === tab
          return (
            <a
              key={t}
              href={hrefFor(basePath, filters, { tab: t === "users" ? undefined : t })}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={15} />
              {TAB_META[t].label}
            </a>
          )
        })}
      </div>

      <div className="mb-6">
        <AnalyticsFilter
          offices={offices}
          current={{ division: filters.division ?? "", title: filters.title ?? "", officeId: filters.officeId ?? "" }}
          basePath={basePath}
          keep={{
            tab: tab === "users" ? "" : tab,
            pathway: tab === "pathways" ? searchParams.pathway ?? "" : "",
            course: tab === "courses" ? searchParams.course ?? "" : "",
            cohort: tab === "cohorts" ? searchParams.cohort ?? "" : "",
          }}
        />
      </div>

      {hasFilter && (
        <p className="mb-4 text-xs text-slate-400">
          Showing data for {data.learnerCount} {data.learnerCount === 1 ? "person" : "people"} matching the selected filters.
        </p>
      )}

      {tab === "users" && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={learnerLabel} value={data.learnerCount} icon={Users} color="blue" />
            <StatCard
              label="Active (last 30 days)"
              value={data.activeLearners}
              icon={Activity}
              color="purple"
              sub={`${pctOf(data.activeLearners, data.learnerCount)}% signed in recently`}
            />
            <StatCard label="Pathway Enrollments" value={data.pathwayEnrollments} icon={GraduationCap} color="green" />
            <StatCard
              label="Pathway Completion"
              value={`${pctOf(data.pathwayCompleted, data.pathwayEnrollments)}%`}
              icon={TrendingUp}
              color="amber"
              sub={`${data.pathwayCompleted} of ${data.pathwayEnrollments} completed`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={`${learnerLabel} by Division`} icon={Users} iconColor="text-indigo-600">
              {data.byDivision.length === 0 ? (
                <p className="text-sm text-slate-400">No data for the current filter.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.byDivision.map((d) => <BarRow key={d.label} label={d.label} value={d.value} max={data.byDivision[0].value} color="bg-indigo-400" />)}
                </div>
              )}
            </Card>
            <Card title={`${learnerLabel} by Title`} icon={Briefcase} iconColor="text-violet-600">
              {data.byTitle.length === 0 ? (
                <p className="text-sm text-slate-400">No data for the current filter.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.byTitle.map((t) => <BarRow key={t.label} label={t.label} value={t.value} max={data.byTitle[0].value} color="bg-violet-400" />)}
                </div>
              )}
            </Card>
            {data.showPoints && (
              <Card title={isAdmin ? "Top Point Earners" : "Top Point Earners (your team)"} icon={Award} iconColor="text-yellow-500">
                <LearnerList rows={data.topEarners} unit={<Star size={14} className="text-yellow-400" />} empty="No points awarded yet." />
              </Card>
            )}
            <Card title="Most Courses Completed" icon={CheckCircle2} iconColor="text-green-600">
              <LearnerList rows={data.topCompleters} unit={<BookOpen size={14} className="text-slate-400" />} empty="No courses completed yet." />
            </Card>
          </div>
        </>
      )}

      {tab === "pathways" && !data.pathwayDetail && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Pathways" value={data.pathways.length} icon={Map} color="blue" />
            <StatCard label="Enrollments" value={data.pathwayEnrollments} icon={GraduationCap} color="green" />
            <StatCard
              label="Completion Rate"
              value={`${pctOf(data.pathwayCompleted, data.pathwayEnrollments)}%`}
              icon={TrendingUp}
              color="amber"
              sub={`${data.pathwayCompleted} of ${data.pathwayEnrollments} completed`}
            />
            <StatCard
              label="Overdue"
              value={data.pathways.reduce((s, p) => s + p.overdue, 0)}
              icon={AlertTriangle}
              color="purple"
              sub="Past the deadline and not finished"
            />
          </div>

          <div className="mb-6">
            <Card title="Enrollments by Completion" icon={BarChart3} action={<span className="text-xs text-slate-400">All pathway enrollments</span>}>
              <CompletionHistogram buckets={data.pathwayBuckets} unit="enrollments" />
            </Card>
          </div>

          <ScopeTable
            kind="pathway"
            empty="No pathways to show."
            rows={data.pathways.map((p) => ({
              id: p.id,
              name: p.name,
              isDraft: p.isDraft,
              href: hrefFor(basePath, filters, { tab: "pathways", pathway: p.id }),
              people: p.enrolled,
              completed: p.completed,
              avgPct: p.avgPct,
              buckets: p.buckets,
              extra: [
                p.overdue ? <span key="o" className="text-red-600">{p.overdue}</span> : <span key="o" className="text-slate-300">0</span>,
                p.pending ? <span key="p">{p.pending}</span> : <span key="p" className="text-slate-300">0</span>,
              ],
            }))}
            extraHeaders={["Overdue", "Pending requests"]}
          />
        </>
      )}

      {tab === "pathways" && data.pathwayDetail && (() => {
        const d = data.pathwayDetail
        const enrolled = d.row.enrolled
        return (
          <>
            <BackLink href={hrefFor(basePath, filters, { tab: "pathways" })} label="All pathways" />
            <h2 className="mb-4 text-xl font-bold text-slate-900">{d.row.name}{d.row.isDraft && <DraftBadge />}</h2>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Enrolled" value={enrolled} icon={Users} color="blue" sub={d.row.pending ? `${d.row.pending} pending approval` : undefined} />
              <StatCard label="Completed" value={d.row.completed} icon={CheckCircle2} color="green" sub={`${pctOf(d.row.completed, enrolled)}% of enrolled`} />
              <StatCard label="Average Progress" value={`${d.row.avgPct}%`} icon={TrendingUp} color="amber" />
              <StatCard label="Overdue" value={d.row.overdue} icon={AlertTriangle} color="purple" sub="Past the deadline and not finished" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="People by Completion" icon={BarChart3}>
                <CompletionHistogram buckets={d.row.buckets} />
              </Card>
              <Card title="Progress by Course" icon={BookOpen} action={<span className="text-xs text-slate-400">Completed · started</span>}>
                {d.courses.length === 0 ? (
                  <p className="text-sm text-slate-400">This pathway has no published courses.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {d.courses.map((c, i) => (
                      <BarRow
                        key={c.id}
                        label={`${i + 1}. ${c.name}`}
                        value={c.completed}
                        max={enrolled}
                        sub={`${pctOf(c.completed, enrolled)}% · ${c.started} started`}
                        color="bg-blue-600"
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>
            <div className="mt-6">
              <PeopleTable
                title="Enrolled People"
                empty="No one is enrolled in this pathway yet."
                fileName={`${fileSlug(d.row.name)}-enrolled.xlsx`}
                sheetName="Enrolled"
                rows={d.people.map((p) => ({ id: p.userId, ...p }))}
                columns={[
                  { key: "name", label: "Name", sub: "email" },
                  { key: "email", label: "Email", exportOnly: true },
                  { key: "office", label: "Office", filter: true },
                  { key: "division", label: "Division", filter: true },
                  { key: "title", label: "Title", exportOnly: true },
                  { key: "via", label: "Enrolled via", filter: true },
                  { key: "pct", label: "Progress", kind: "pct" },
                  { key: "coursesDone", label: "Courses done" },
                  { key: "coursesTotal", label: "Required courses", exportOnly: true },
                  { key: "enrolledAt", label: "Enrolled", kind: "date" },
                  { key: "deadline", label: "Deadline", kind: "date" },
                ]}
              />
            </div>
          </>
        )
      })()}

      {tab === "cohorts" && data.cohorts && !data.cohortDetail && (() => {
        const enrollments = data.cohorts.reduce((s, c) => s + c.enrollments, 0)
        const completed = data.cohorts.reduce((s, c) => s + c.completed, 0)
        const buckets = data.cohorts.reduce((acc, c) => acc.map((n, i) => n + c.buckets[i]), data.pathwayBuckets.map(() => 0))
        return (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Cohorts" value={data.cohorts.length} icon={UsersRound} color="blue" />
              <StatCard label="Members" value={data.cohorts.reduce((s, c) => s + c.members, 0)} icon={Users} color="green" sub="Counted once per cohort" />
              <StatCard
                label="Completion Rate"
                value={`${pctOf(completed, enrollments)}%`}
                icon={TrendingUp}
                color="amber"
                sub={`${completed} of ${enrollments} pathway enrollments completed`}
              />
              <StatCard
                label="Members Done"
                value={data.cohorts.reduce((s, c) => s + c.membersDone, 0)}
                icon={CheckCircle2}
                color="purple"
                sub="Finished every pathway of their cohort"
              />
            </div>
            <div className="mb-6">
              <Card title="Cohort Pathway Enrollments by Completion" icon={BarChart3}>
                <CompletionHistogram buckets={buckets} unit="enrollments" />
              </Card>
            </div>
            <ScopeTable
              kind="cohort"
              empty="No cohorts yet."
              rows={data.cohorts.map((c) => ({
                id: c.id,
                name: c.name,
                isDraft: false,
                href: hrefFor(basePath, filters, { tab: "cohorts", cohort: c.id }),
                people: c.members,
                completed: c.membersDone,
                avgPct: c.avgPct,
                buckets: c.buckets,
                extra: [
                  <span key="p">{c.pathwayCount}</span>,
                  <span key="e">{c.completed} / {c.enrollments}</span>,
                ],
              }))}
              extraHeaders={["Pathways", "Pathways completed"]}
            />
          </>
        )
      })()}

      {tab === "cohorts" && data.cohortDetail && (() => {
        const d = data.cohortDetail
        return (
          <>
            <BackLink href={hrefFor(basePath, filters, { tab: "cohorts" })} label="All cohorts" />
            <h2 className="mb-4 text-xl font-bold text-slate-900">{d.row.name}</h2>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Members" value={d.row.members} icon={Users} color="blue" sub={`${d.row.pathwayCount} pathway${d.row.pathwayCount !== 1 ? "s" : ""} assigned`} />
              <StatCard
                label="Members Done"
                value={d.row.membersDone}
                icon={CheckCircle2}
                color="green"
                sub={`${pctOf(d.row.membersDone, d.row.members)}% finished every pathway`}
              />
              <StatCard label="Average Progress" value={`${d.row.avgPct}%`} icon={TrendingUp} color="amber" sub="Across all their pathway enrollments" />
              <StatCard
                label="Pathways Completed"
                value={`${d.row.completed} / ${d.row.enrollments}`}
                icon={GraduationCap}
                color="purple"
                sub={`${pctOf(d.row.completed, d.row.enrollments)}% of pathway enrollments`}
              />
            </div>
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <Card title="Pathway Enrollments by Completion" icon={BarChart3}>
                <CompletionHistogram buckets={d.row.buckets} unit="enrollments" />
              </Card>
              <Card title="Progress by Pathway" icon={Map} action={<span className="text-xs text-slate-400">Members completed</span>}>
                {d.pathways.length === 0 ? (
                  <p className="text-sm text-slate-400">No pathways are assigned to this cohort.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {d.pathways.map((p) => (
                      <a key={p.id} href={hrefFor(basePath, filters, { tab: "pathways", pathway: p.id })} className="block rounded-lg hover:bg-slate-50">
                        <BarRow
                          label={`${p.name}${p.isDraft ? " (draft)" : ""}`}
                          value={p.completed}
                          max={p.enrolled}
                          sub={`${p.enrolled} enrolled · avg ${p.avgPct}%`}
                          color="bg-blue-600"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            <PeopleTable
              title="Members"
              empty="This cohort has no members matching the filters."
              fileName={`${fileSlug(d.row.name)}-cohort-progress.xlsx`}
              sheetName={d.row.name}
              progressKey="avgPct"
              rows={d.members.map((m) => ({
                id: m.userId,
                name: m.name,
                email: m.email,
                office: m.office,
                division: m.division,
                title: m.title,
                avgPct: m.avgPct,
                pathwaysDone: `${m.pathwaysDone} / ${m.pathwaysEnrolled}`,
                ...Object.fromEntries(d.pathways.map((p) => [`p:${p.id}`, m.byPathway[p.id] ?? null])),
              }))}
              columns={[
                { key: "name", label: "Name", sub: "email" },
                { key: "email", label: "Email", exportOnly: true },
                { key: "office", label: "Office", filter: true },
                { key: "division", label: "Division", filter: true },
                { key: "title", label: "Title", exportOnly: true },
                { key: "avgPct", label: "Overall", kind: "pct" },
                { key: "pathwaysDone", label: "Pathways done" },
                ...d.pathways.map((p) => ({ key: `p:${p.id}`, label: p.name, kind: "pct" as const })),
              ]}
            />
          </>
        )
      })()}

      {tab === "courses" && !data.courseDetail && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Courses" value={data.courses.length} icon={BookOpen} color="blue" />
            <StatCard label="Course Learners" value={data.courseEnrollments} icon={Users} color="green" sub="Each person counted once per course" />
            <StatCard
              label="Completion Rate"
              value={`${pctOf(data.courseCompleted, data.courseEnrollments)}%`}
              icon={TrendingUp}
              color="amber"
              sub={`${data.courseCompleted} of ${data.courseEnrollments} completed`}
            />
            <StatCard
              label="Awaiting Grading"
              value={data.courses.reduce((s, c) => s + c.awaitingGrading, 0)}
              icon={ClipboardCheck}
              color="purple"
              sub="Assignment submissions to review"
            />
          </div>

          <div className="mb-6">
            <Card title="Learners by Completion" icon={BarChart3} action={<span className="text-xs text-slate-400">All course learners</span>}>
              <CompletionHistogram buckets={data.courseBuckets} unit="learners" />
            </Card>
          </div>

          <ScopeTable
            kind="course"
            empty="No courses to show."
            rows={data.courses.map((c) => ({
              id: c.id,
              name: c.name,
              isDraft: c.isDraft,
              href: hrefFor(basePath, filters, { tab: "courses", course: c.id }),
              people: c.learners,
              completed: c.completed,
              avgPct: c.avgPct,
              buckets: c.buckets,
              extra: [
                c.avgTestScore === null ? <span key="t" className="text-slate-300">—</span> : <span key="t">{c.avgTestScore}% <span className="text-xs text-slate-400">({c.testPassRate}% pass)</span></span>,
                c.avgRating === null ? <span key="r" className="text-slate-300">—</span> : <span key="r" className="inline-flex items-center gap-1"><Star size={12} className="fill-yellow-400 text-yellow-400" />{c.avgRating} <span className="text-xs text-slate-400">({c.ratingCount})</span></span>,
                c.awaitingGrading ? <span key="g" className="text-amber-700">{c.awaitingGrading}</span> : <span key="g" className="text-slate-300">0</span>,
              ],
            }))}
            extraHeaders={["Avg test score", "Rating", "To grade"]}
          />
        </>
      )}

      {tab === "courses" && data.courseDetail && (() => {
        const d = data.courseDetail
        const learners = d.row.learners
        return (
          <>
            <BackLink href={hrefFor(basePath, filters, { tab: "courses" })} label="All courses" />
            <h2 className="mb-4 text-xl font-bold text-slate-900">{d.row.name}{d.row.isDraft && <DraftBadge />}</h2>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Learners" value={learners} icon={Users} color="blue" />
              <StatCard label="Completed" value={d.row.completed} icon={CheckCircle2} color="green" sub={`${pctOf(d.row.completed, learners)}% of learners`} />
              <StatCard label="Average Progress" value={`${d.row.avgPct}%`} icon={TrendingUp} color="amber" />
              <StatCard
                label="Rating"
                value={d.row.avgRating === null ? "—" : `${d.row.avgRating} / 5`}
                icon={Star}
                color="purple"
                sub={d.row.ratingCount ? `${d.row.ratingCount} ${d.row.ratingCount === 1 ? "review" : "reviews"}` : "No reviews yet"}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Learners by Completion" icon={BarChart3}>
                <CompletionHistogram buckets={d.row.buckets} unit="learners" />
              </Card>
              <Card title="Where Learners Get To" icon={BookOpen} action={<span className="text-xs text-slate-400">Learners who finished each item</span>}>
                {d.items.length === 0 ? (
                  <p className="text-sm text-slate-400">This course has no content yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {d.items.map((item, i) => (
                      <BarRow
                        key={item.id}
                        label={`${i + 1}. ${item.kind === "test" ? "Test: " : ""}${item.title}`}
                        value={item.done}
                        max={learners}
                        sub={`${pctOf(item.done, learners)}%`}
                        color={item.kind === "test" ? "bg-violet-500" : "bg-blue-600"}
                      />
                    ))}
                  </div>
                )}
              </Card>
              {d.tests.length > 0 && (
                <Card title="Tests" icon={ClipboardCheck} iconColor="text-violet-600">
                  <div className="-mx-6 -mb-6 overflow-x-auto border-t border-slate-100">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-6 py-2.5">Test</th>
                          <th className="px-3 py-2.5 text-right">Attempted</th>
                          <th className="px-3 py-2.5 text-right">Passed</th>
                          <th className="px-6 py-2.5 text-right">Avg score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.tests.map((t) => (
                          <tr key={t.id}>
                            <td className="px-6 py-2.5 font-medium text-slate-800">{t.title}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{t.attempted}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{t.passed} <span className="text-xs text-slate-400">({pctOf(t.passed, t.attempted)}%)</span></td>
                            <td className="px-6 py-2.5 text-right text-slate-600">{t.avgScore === null ? "—" : `${t.avgScore}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </>
        )
      })()}
    </main>
  )
}

function DraftBadge() {
  return <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-slate-500">Draft</span>
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
      <ChevronLeft size={15} />
      {label}
    </a>
  )
}

function ScopeTable({
  kind,
  rows,
  extraHeaders,
  empty,
}: {
  kind: "pathway" | "course" | "cohort"
  rows: { id: string; name: string; isDraft: boolean; href: string; people: number; completed: number; avgPct: number; buckets: number[]; extra: React.ReactNode[] }[]
  extraHeaders: string[]
  empty: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{kind === "pathway" ? "Pathways" : kind === "cohort" ? "Cohorts" : "Courses"}</h2>
        <BucketLegend />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{kind === "pathway" ? "Pathway" : kind === "cohort" ? "Cohort" : "Course"}</th>
                <th className="px-3 py-3 text-right">{kind === "pathway" ? "Enrolled" : kind === "cohort" ? "Members" : "Learners"}</th>
                <th className="px-3 py-3 text-right">{kind === "cohort" ? "Members done" : "Completed"}</th>
                <th className="px-3 py-3 text-right">Avg</th>
                <th className="w-56 px-3 py-3">Completion</th>
                {extraHeaders.map((h) => <th key={h} className="px-3 py-3 text-right">{h}</th>)}
                <th className="w-8 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="min-w-[14rem] max-w-xs px-5 py-3">
                    <a href={r.href} className="font-medium text-slate-900 hover:text-blue-700">{r.name}</a>
                    {r.isDraft && <DraftBadge />}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">{r.people}</td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {r.completed} <span className="text-xs text-slate-400">({pctOf(r.completed, r.people)}%)</span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">{r.avgPct}%</td>
                  <td className="px-3 py-3"><DistributionBar buckets={r.buckets} /></td>
                  {r.extra.map((cell, i) => <td key={i} className="whitespace-nowrap px-3 py-3 text-right text-slate-700">{cell}</td>)}
                  <td className="px-3 py-3">
                    <a href={r.href} className="text-slate-300 hover:text-blue-600" aria-label={`Details for ${r.name}`}>
                      <ChevronRight size={16} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
