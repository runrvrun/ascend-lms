import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertCourse(name: string, description: string) {
  return prisma.course.upsert({
    where: { name },
    create: { name, description },
    update: { description },
  })
}

async function upsertContent(
  courseId: string,
  order: number,
  title: string,
  type: "TEXT" | "VIDEO" | "LINK",
  value: string
) {
  return prisma.content.upsert({
    where: { courseId_order: { courseId, order } },
    create: { courseId, order, title, type, value },
    update: { title, type, value },
  })
}

async function upsertTest(courseId: string, passThreshold: number) {
  return prisma.test.upsert({
    where: { courseId },
    create: { courseId, passThreshold },
    update: { passThreshold },
  })
}

async function upsertQuestion(
  testId: string,
  order: number,
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "RANKING" | "MATCHING",
  question: string
) {
  return prisma.question.upsert({
    where: { testId_order: { testId, order } },
    create: { testId, order, type, question },
    update: { type, question },
  })
}

async function seedOptions(
  questionId: string,
  options: { text: string; isCorrect?: boolean; order?: number; matchKey?: string }[]
) {
  // Clear existing options and recreate — simplest idempotent approach for options
  await prisma.questionOption.deleteMany({ where: { questionId } })
  await prisma.questionOption.createMany({
    data: options.map((o) => ({
      questionId,
      text: o.text,
      isCorrect: o.isCorrect ?? null,
      order: o.order ?? null,
      matchKey: o.matchKey ?? null,
    })),
  })
}

async function upsertPathway(
  name: string,
  description: string,
  requiresApproval: boolean
) {
  return prisma.pathway.upsert({
    where: { name },
    create: { name, description, requiresApproval },
    update: { description, requiresApproval },
  })
}

async function linkCourseToPathway(pathwayId: string, courseId: string, order: number, points: number) {
  return prisma.pathwayCourse.upsert({
    where: { pathwayId_courseId: { pathwayId, courseId } },
    create: { pathwayId, courseId, order, points },
    update: { order, points },
  })
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

const OFFICES = [
  "EU - Atlas Investments P Ltd",
  "EU - Renoir Consulting (UK) Limited",
  "EU - Renoir Mauritius",
  "EU - Shenkuo France",
  "EU - YCP Netherlands",
  "GC - Renoir Consulting (Hk) Private Limited",
  "GC - Shenkuo Hong Kong",
  "GC - Shenkuo Shanghai",
  "GC - YCP Holdings (Hong Kong)",
  "GC - YCP Hong Kong",
  "GC - YCP Investment",
  "GC - YCP Shanghai",
  "GC - YCP Taiwan",
  "IN - Consus India",
  "IN - Renoir Management Consulting (India) Pvt Ltd",
  "IN - YCP Auctus",
  "JP - Green Impact Labs, Inc",
  "JP - YCP Japan",
  "ME - ESG Integrate Fze",
  "ME - Renoir Consulting Sole Proprietorship LLC",
  "NA - Consus Canada",
  "NA - Consus US",
  "NA - Renoir Brasil Ltda",
  "NA - Renoir Management Corporation",
  "NA - YCP US",
  "SEA - Consus Malaysia",
  "SEA - Consus Singapore",
  "SEA - PT Renoir Consulting Indonesia",
  "SEA - Renoir Consulting (Malaysia) Sdn Bhd",
  "SEA - Renoir Consulting (Singapore) Pte Ltd",
  "SEA - Renoir Holdings Pte. Ltd",
  "SEA - Renoir Implementation Services Inc",
  "SEA - Unison Mining Consulting Pte Ltd",
  "SEA - YCP Holdings (Singapore)",
  "SEA - YCP Indonesia",
  "SEA - YCP Malaysia",
  "SEA - YCP Myanmar",
  "SEA - YCP Philippines",
  "SEA - YCP Singapore",
  "SEA - YCP Thailand",
  "SEA - YCP Vietnam",
  "UAE - Consus Dubai",
  "YCP Solidiance India",
  "YCP Solidiance Lebanon",
  "YCP Solidiance United Arab Emirates",
]

async function main() {
  console.log("🌱  Seeding offices…")
  for (const name of OFFICES) {
    await prisma.office.upsert({
      where: { name },
      create: { name },
      update: {},
    })
  }
  console.log(`✅  ${OFFICES.length} offices seeded\n`)

  console.log("🌱  Seeding pathways, courses, contents, and tests…\n")

  // ══════════════════════════════════════════════════════════════════════════════
  // COURSES
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Course 1: Introduction to YCP Holdings ──────────────────────────────────
  const c1 = await upsertCourse(
    "Introduction to YCP Holdings",
    "An overview of YCP Holdings — who we are, what we do, and how we operate across Asia."
  )

  await upsertContent(c1.id, 1, "Who We Are", "TEXT", `YCP Holdings is a pan-Asian management consulting and investment firm headquartered in Hong Kong. Founded on the belief that rigorous analysis and deep local expertise can unlock extraordinary value, YCP works with corporations, private equity funds, and governments across Asia to solve complex business problems.

Our teams span more than 15 cities across Asia Pacific, including Tokyo, Singapore, Bangkok, Jakarta, Kuala Lumpur, and Manila. We bring together professionals with diverse academic and professional backgrounds — united by a shared commitment to excellence, intellectual curiosity, and client impact.

YCP's service lines include:
• Strategy & Corporate Development
• Commercial Due Diligence
• Market Entry & Expansion
• Operational Improvement
• Digital Transformation

Every engagement at YCP is driven by facts, structured thinking, and a genuine desire to help our clients succeed in Asia's dynamic and fast-evolving markets.`)

  await upsertContent(c1.id, 2, "Our Vision and Mission", "TEXT", `Vision:
To be the most trusted partner for businesses seeking to grow and succeed in Asia.

Mission:
We create lasting value for our clients by combining local expertise with global best practices, delivering actionable insights that lead to measurable results.

Core Pillars:
1. Client-Centricity — Our clients' success is our success. We commit fully to every engagement.
2. Analytical Rigor — We follow the evidence wherever it leads, no matter how complex the picture.
3. Collaborative Spirit — We believe the best answers emerge from diverse perspectives working together.
4. Continuous Learning — We invest in our people because knowledge is our most valuable asset.

At YCP, titles and tenure do not define contribution — ideas and effort do.`)

  await upsertContent(c1.id, 3, "YCP Official Website", "LINK", "https://www.ycp.com")

  const t1 = await upsertTest(c1.id, 75)
  const q1_1 = await upsertQuestion(t1.id, 1, "MULTIPLE_CHOICE", "Where is YCP Holdings headquartered?")
  await seedOptions(q1_1.id, [
    { text: "Singapore", isCorrect: false },
    { text: "Hong Kong", isCorrect: true },
    { text: "Tokyo", isCorrect: false },
    { text: "Bangkok", isCorrect: false },
  ])
  const q1_2 = await upsertQuestion(t1.id, 2, "TRUE_FALSE", "YCP Holdings works exclusively with private equity funds.")
  await seedOptions(q1_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q1_3 = await upsertQuestion(t1.id, 3, "MULTIPLE_CHOICE", "Which of the following is NOT a YCP service line?")
  await seedOptions(q1_3.id, [
    { text: "Commercial Due Diligence", isCorrect: false },
    { text: "Market Entry & Expansion", isCorrect: false },
    { text: "Consumer Goods Manufacturing", isCorrect: true },
    { text: "Digital Transformation", isCorrect: false },
  ])
  const q1_4 = await upsertQuestion(t1.id, 4, "FILL_BLANK", "YCP's vision is to be the most trusted partner for businesses seeking to grow and succeed in ____.")
  await seedOptions(q1_4.id, [
    { text: "Asia", isCorrect: true },
  ])

  // ── Course 2: Mindset as a YCP Professional ──────────────────────────────────
  const c2 = await upsertCourse(
    "Mindset as a YCP Professional",
    "Developing the habits of mind and professional behaviours that define high-performing YCP consultants."
  )

  await upsertContent(c2.id, 1, "The Consultant's Mindset", "TEXT", `Great consultants are made, not born. At YCP, we believe that success is the result of deliberate habits, disciplined thinking, and a genuine commitment to growth.

The Three Mindset Pillars at YCP:

1. Ownership Mentality
Take full responsibility for your work — from the quality of a single slide to the success of an entire engagement. Don't wait to be told what to do. Identify problems, propose solutions, and execute with care.

2. Hypothesis-Driven Thinking
Don't wait until all data is available before forming a view. Start with a hypothesis, test it rigorously, and update it as evidence accumulates. This approach keeps you focused on what matters and prevents analysis paralysis.

3. Structured Communication
Every insight must be communicated clearly and concisely. At YCP, we use the Pyramid Principle: lead with your conclusion, support it with key points, and back those up with evidence. Whether you are writing an email or presenting to a CEO, structure is everything.`)

  await upsertContent(c2.id, 2, "Growth Mindset in Consulting", "TEXT", `The consulting environment is demanding. Projects move fast, expectations are high, and the problems are rarely simple. This is precisely why mindset matters.

Fixed vs. Growth Mindset:
A fixed mindset treats intelligence and skill as static. A growth mindset treats them as developable through effort and learning.

At YCP, we expect our professionals to:
• Embrace feedback — treat every piece of feedback as data, not judgment
• Learn from setbacks — a failed hypothesis is not a failure; it is information
• Seek discomfort — growth happens at the edge of your current capability
• Celebrate others' success — a rising tide lifts all boats

Practical habits for building a growth mindset:
• After every project, write down three things you learned and one thing you would do differently
• Ask for feedback proactively rather than waiting for performance reviews
• Spend 30 minutes each week reading something outside your current domain of expertise`)

  const t2 = await upsertTest(c2.id, 70)
  const q2_1 = await upsertQuestion(t2.id, 1, "MULTIPLE_CHOICE", "Which of the following best describes 'hypothesis-driven thinking'?")
  await seedOptions(q2_1.id, [
    { text: "Waiting until all data is collected before drawing any conclusions", isCorrect: false },
    { text: "Forming an initial view early and testing it against evidence", isCorrect: true },
    { text: "Relying on intuition without any data analysis", isCorrect: false },
    { text: "Delegating analysis to data teams before forming opinions", isCorrect: false },
  ])
  const q2_2 = await upsertQuestion(t2.id, 2, "TRUE_FALSE", "In the Pyramid Principle, you should present your supporting evidence before stating your conclusion.")
  await seedOptions(q2_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q2_3 = await upsertQuestion(t2.id, 3, "MULTIPLE_CHOICE", "What does 'Ownership Mentality' mean at YCP?")
  await seedOptions(q2_3.id, [
    { text: "Owning shares in YCP", isCorrect: false },
    { text: "Waiting for clear instructions before beginning any task", isCorrect: false },
    { text: "Taking full responsibility for your work and proactively solving problems", isCorrect: true },
    { text: "Only being accountable for tasks explicitly assigned to you", isCorrect: false },
  ])

  // ── Course 3: YCP Code of Conduct ────────────────────────────────────────────
  const c3 = await upsertCourse(
    "YCP Code of Conduct",
    "Understanding the professional and ethical standards expected of every YCP professional."
  )

  await upsertContent(c3.id, 1, "Professional Standards", "TEXT", `At YCP, our reputation is built on trust — trust from our clients, our colleagues, and the communities we serve. Every professional at YCP is expected to uphold the highest standards of integrity and professionalism.

Key Principles:

Confidentiality
Client information is strictly confidential. You must never share client data, project details, or insights with external parties without explicit permission. This obligation continues even after you leave the firm.

Conflicts of Interest
Disclose any potential conflicts of interest immediately to your project lead or People team. When in doubt, disclose.

Respectful Workplace
YCP is committed to a workplace free from discrimination, harassment, and bullying. Every colleague deserves to be treated with dignity and respect, regardless of seniority, background, or nationality.

Use of Company Resources
YCP's resources — including laptops, software licences, and communication tools — are for professional use. Use them responsibly and in accordance with firm policy.

Social Media
When posting publicly about YCP or your work, be thoughtful. Never share confidential information or make statements that could misrepresent the firm's views.`)

  await upsertContent(c3.id, 2, "Reporting and Whistleblowing", "TEXT", `YCP takes ethical violations seriously. If you observe or suspect any breach of our Code of Conduct, you are expected — and protected — to report it.

How to Report:
• Speak directly to your project lead or People team if you are comfortable doing so
• Use the anonymous reporting channel available on the internal HR portal
• Contact the Ethics Committee directly for serious matters

Whistleblower Protections:
YCP prohibits any form of retaliation against employees who report concerns in good faith. Anyone found to have retaliated against a whistleblower will face disciplinary action.

Remember: staying silent in the face of wrongdoing is not neutrality — it is complicity. We rely on every professional to help maintain the culture and standards that make YCP an exceptional place to work.`)

  // No test for Code of Conduct — reading material only

  // ── Course 4: Foundations of Leadership ─────────────────────────────────────
  const c4 = await upsertCourse(
    "Foundations of Leadership",
    "Core leadership principles for YCP managers and senior professionals."
  )

  await upsertContent(c4.id, 1, "What Makes a Great Leader", "TEXT", `Leadership at YCP is not about authority — it is about impact. The best leaders at YCP elevate everyone around them.

Five Foundations of Leadership at YCP:

1. Vision and Direction
Great leaders paint a clear picture of where the team is going and why it matters. Without direction, even the most talented teams lose momentum.

2. Developing People
Your most important job as a leader is to grow the people around you. Give stretch assignments, share feedback early and often, and celebrate development milestones.

3. Building Trust
Trust is the currency of leadership. It is earned through consistency, transparency, and follow-through. Say what you will do, and do what you say.

4. Decision-Making Under Uncertainty
Leaders do not have the luxury of waiting for perfect information. Learn to make well-reasoned decisions with incomplete data, and communicate the reasoning behind them clearly.

5. Resilience and Composure
Teams take emotional cues from their leaders. In difficult moments — tight deadlines, negative client feedback, team conflict — your composure sets the tone.`)

  await upsertContent(c4.id, 2, "Giving and Receiving Feedback", "TEXT", `Feedback is the engine of growth. As a leader, your ability to deliver and receive feedback with skill and grace is one of your most important capabilities.

Giving Effective Feedback — the SBI Model:
• Situation: Describe the specific context ("During the client presentation on Tuesday…")
• Behaviour: Describe the observable behaviour, not the person ("…you interrupted the client twice…")
• Impact: Describe the impact ("…which made it harder for us to understand their concern.")

Common Mistakes When Giving Feedback:
• Waiting too long — feedback should be as close to the event as possible
• Being vague — "You need to be more professional" tells someone nothing actionable
• Making it personal — focus on behaviour, never on character

Receiving Feedback:
• Listen without interrupting
• Thank the person for the feedback, regardless of whether you agree
• Reflect before responding — avoid defensive reactions in the moment
• Identify one concrete action you can take as a result`)

  const t4 = await upsertTest(c4.id, 75)
  const q4_1 = await upsertQuestion(t4.id, 1, "MULTIPLE_CHOICE", "According to YCP's leadership model, what is a leader's most important job?")
  await seedOptions(q4_1.id, [
    { text: "Maximising billable utilisation of the team", isCorrect: false },
    { text: "Growing and developing the people around them", isCorrect: true },
    { text: "Ensuring all project deliverables are completed on time", isCorrect: false },
    { text: "Maintaining authority and discipline within the team", isCorrect: false },
  ])
  const q4_2 = await upsertQuestion(t4.id, 2, "TRUE_FALSE", "Trust is primarily built through seniority and years of experience.")
  await seedOptions(q4_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q4_3 = await upsertQuestion(t4.id, 3, "MULTIPLE_CHOICE", "In the SBI feedback model, what does 'B' stand for?")
  await seedOptions(q4_3.id, [
    { text: "Belief", isCorrect: false },
    { text: "Behaviour", isCorrect: true },
    { text: "Background", isCorrect: false },
    { text: "Benefit", isCorrect: false },
  ])
  const q4_4 = await upsertQuestion(t4.id, 4, "RANKING", "Arrange the steps of the SBI feedback model in the correct order.")
  await seedOptions(q4_4.id, [
    { text: "Situation", order: 1 },
    { text: "Behaviour", order: 2 },
    { text: "Impact", order: 3 },
  ])

  // ── Course 5: Stakeholder Communication ─────────────────────────────────────
  const c5 = await upsertCourse(
    "Stakeholder Communication",
    "Strategies for communicating effectively with clients, leadership, and cross-functional teams."
  )

  await upsertContent(c5.id, 1, "Communicating with Clients", "TEXT", `Client communication is one of the most visible and impactful skills a YCP professional can develop. Every interaction — from a quick email to a formal board presentation — shapes the client's perception of YCP.

Principles of Effective Client Communication:

Be Concise
Clients are busy. Respect their time by getting to the point quickly. Use the Pyramid Principle: conclusion first, then supporting points.

Anticipate Questions
Before any client meeting, ask yourself: "What are the three questions they are most likely to ask, and how will I answer them?" Preparation signals respect and competence.

Manage Expectations Proactively
If there is a delay, a change in scope, or unexpected findings, tell the client before they ask. Surprises erode trust; proactive communication builds it.

Use Visuals Thoughtfully
A well-designed chart communicates faster than three paragraphs. Use visuals to simplify complexity, not to decorate.

Follow Up in Writing
After important meetings, send a concise summary of decisions made and next steps within 24 hours.`)

  await upsertContent(c5.id, 2, "Communicating Up and Across", "TEXT", `Effective communication is not only about speaking to clients — it is also about managing upward and working collaboratively across teams.

Communicating Upward:
• Lead with the so-what — your manager needs the bottom line, not the full story
• Flag risks early — "I think we have a problem" is always better to hear early than late
• Come with solutions, not just problems — when you raise an issue, bring at least one proposed path forward

Communicating Across Teams:
• Assume positive intent — misunderstandings across teams are usually the result of context gaps, not bad faith
• Be explicit about what you need — vague requests lead to misaligned outputs
• Close the loop — let people know when you have acted on something they contributed to

Remote and Async Communication:
In a geographically dispersed firm like YCP, written communication is critical. Write emails and messages as if the reader has no prior context. Be specific about deadlines and expected actions.`)

  const t5 = await upsertTest(c5.id, 70)
  const q5_1 = await upsertQuestion(t5.id, 1, "MULTIPLE_CHOICE", "When communicating project updates to a client, what should you do if there is an unexpected delay?")
  await seedOptions(q5_1.id, [
    { text: "Wait until you have a complete solution before informing the client", isCorrect: false },
    { text: "Inform the client proactively before they ask", isCorrect: true },
    { text: "Let the project lead handle all communication about delays", isCorrect: false },
    { text: "Adjust the timeline silently and submit the work when ready", isCorrect: false },
  ])
  const q5_2 = await upsertQuestion(t5.id, 2, "TRUE_FALSE", "When communicating upward, you should always present the full analysis before stating your conclusion.")
  await seedOptions(q5_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q5_3 = await upsertQuestion(t5.id, 3, "MATCHING", "Match each communication principle to its correct description.")
  await seedOptions(q5_3.id, [
    { text: "Pyramid Principle", matchKey: "Lead with the conclusion, then support it" },
    { text: "SBI Model", matchKey: "Situation, Behaviour, Impact framework for feedback" },
    { text: "Proactive communication", matchKey: "Telling stakeholders about issues before they ask" },
  ])

  // ── Course 6: Structured Problem Solving ─────────────────────────────────────
  const c6 = await upsertCourse(
    "Structured Problem Solving",
    "The analytical frameworks and thinking tools used by YCP consultants to solve complex business problems."
  )

  await upsertContent(c6.id, 1, "The MECE Principle", "TEXT", `MECE — Mutually Exclusive, Collectively Exhaustive — is one of the foundational tools of consulting logic. It was popularised by McKinsey and is used across the consulting industry to structure problems and organise information.

Mutually Exclusive (ME)
Each element in your framework covers a distinct part of the problem, with no overlaps. If two categories overlap, your analysis will double-count and create confusion.

Collectively Exhaustive (CE)
Together, your categories cover every possible aspect of the problem. If your framework has gaps, you risk missing the root cause of an issue or an important market segment.

Why MECE Matters:
• It forces you to think comprehensively before diving into analysis
• It prevents you from confusing the client with redundant or overlapping information
• It makes your logic easier to follow and challenge

Example — Diagnosing a Revenue Decline:
Non-MECE: "The decline could be due to sales, marketing, or customer satisfaction." (Overlapping and incomplete)
MECE: "Revenue = Volume × Price. Volume decline could be due to fewer customers or lower purchase frequency. Price decline could be due to discounting or mix shift." (Structured and complete)`)

  await upsertContent(c6.id, 2, "Issue Trees and Hypothesis Trees", "TEXT", `Issue trees and hypothesis trees are the primary tools consultants use to break complex problems into manageable, testable components.

Issue Trees:
An issue tree is a logical decomposition of a problem into its component parts. You start with the central question and branch downward into increasingly specific sub-questions.

Example — "Why are profits declining?"
├── Revenues declining?
│   ├── Volume declining? (fewer customers, lower frequency)
│   └── Price declining? (discounting, product mix)
└── Costs increasing?
    ├── Fixed costs rising? (overhead, rent, headcount)
    └── Variable costs rising? (input costs, logistics)

Hypothesis Trees:
A hypothesis tree is an issue tree where each branch represents a testable hypothesis rather than an open question. This is the preferred tool at YCP because it forces you to commit to a view early and test it efficiently.

Tips for Building Good Trees:
• Use the MECE principle at every level of the tree
• Limit each level to 3–5 branches to keep it manageable
• Make your hypotheses specific enough to be falsifiable`)

  const t6 = await upsertTest(c6.id, 75)
  const q6_1 = await upsertQuestion(t6.id, 1, "MULTIPLE_CHOICE", "What does MECE stand for?")
  await seedOptions(q6_1.id, [
    { text: "Mutually Exclusive, Collectively Exhaustive", isCorrect: true },
    { text: "Mutually Exhaustive, Collectively Exclusive", isCorrect: false },
    { text: "Maximum Efficiency, Collective Execution", isCorrect: false },
    { text: "Methodology, Evidence, Conclusion, Evaluation", isCorrect: false },
  ])
  const q6_2 = await upsertQuestion(t6.id, 2, "TRUE_FALSE", "In a hypothesis tree, each branch represents an open question rather than a specific testable hypothesis.")
  await seedOptions(q6_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q6_3 = await upsertQuestion(t6.id, 3, "MULTIPLE_CHOICE", "Which of the following is an example of a MECE breakdown of company revenue?")
  await seedOptions(q6_3.id, [
    { text: "Revenue from product sales and revenue from loyal customers", isCorrect: false },
    { text: "Revenue from online channels and revenue from offline channels", isCorrect: true },
    { text: "Revenue from marketing and revenue from sales teams", isCorrect: false },
    { text: "Revenue growth and revenue decline", isCorrect: false },
  ])

  // ── Course 7: Data-Driven Decision Making ────────────────────────────────────
  const c7 = await upsertCourse(
    "Data-Driven Decision Making",
    "How to gather, interpret, and present data to drive confident business decisions."
  )

  await upsertContent(c7.id, 1, "Principles of Data Analysis", "TEXT", `Data is only as useful as the decisions it enables. At YCP, we use data to sharpen our hypotheses, test our assumptions, and build conviction in our recommendations.

Key Principles:

Start with the Question, Not the Data
Always begin with a clear question: "What decision does this analysis need to support?" Without this anchor, you will collect mountains of data and still not know what to do with it.

Triangulate Across Sources
No single data source is perfect. Use multiple sources — quantitative and qualitative — to build a complete picture. When sources conflict, investigate why.

Correlation ≠ Causation
One of the most common analytical errors is assuming that two trends moving together means one causes the other. Always ask: "Is there a plausible causal mechanism?" and "Could there be a confounding variable?"

Sensitivity Analysis
For every key conclusion, test how sensitive it is to your assumptions. If changing one number by 10% flips your recommendation, you have a fragile finding that needs more investigation.

Present Data with Clarity
A great analysis communicated poorly has no impact. Use the right chart for the message (trends → line charts, comparisons → bar charts, composition → pie/waterfall), add clear titles that state the insight, not just the topic.`)

  await upsertContent(c7.id, 2, "Common Analytical Pitfalls", "TEXT", `Even experienced analysts fall into predictable traps. Awareness is the first step to avoiding them.

1. Confirmation Bias
Seeking out data that confirms your existing view while ignoring contradictory evidence. Counter it by actively seeking data that could disprove your hypothesis.

2. Survivorship Bias
Drawing conclusions only from visible outcomes, ignoring cases that didn't survive to be observed. (e.g., studying only successful companies to understand what makes businesses succeed.)

3. Anchoring
Letting the first number you see disproportionately influence your judgment. Always sanity-check figures against independent benchmarks.

4. Overfitting
Building a model that explains the historical data perfectly but has no predictive power. Keep models simple unless complexity is clearly warranted.

5. Misleading Visualisations
Truncated axes, inconsistent scales, and cherry-picked time windows can make weak trends look dramatic. Always check the full range and context of any chart you are shown.

Building Good Analytical Habits:
• Document your methodology so your work can be replicated
• Peer-review important analyses before sharing with clients
• Maintain a healthy scepticism about data that confirms what you hoped to find`)

  const t7 = await upsertTest(c7.id, 70)
  const q7_1 = await upsertQuestion(t7.id, 1, "MULTIPLE_CHOICE", "What is the first step when beginning a data analysis, according to YCP's approach?")
  await seedOptions(q7_1.id, [
    { text: "Collect as much data as possible", isCorrect: false },
    { text: "Build a dashboard to visualise available data", isCorrect: false },
    { text: "Define the decision the analysis needs to support", isCorrect: true },
    { text: "Identify the most reliable data source", isCorrect: false },
  ])
  const q7_2 = await upsertQuestion(t7.id, 2, "TRUE_FALSE", "If two data trends move together, it is safe to conclude that one causes the other.")
  await seedOptions(q7_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q7_3 = await upsertQuestion(t7.id, 3, "MULTIPLE_CHOICE", "Which analytical pitfall involves drawing conclusions only from visible successes while ignoring failures?")
  await seedOptions(q7_3.id, [
    { text: "Anchoring", isCorrect: false },
    { text: "Confirmation bias", isCorrect: false },
    { text: "Survivorship bias", isCorrect: true },
    { text: "Overfitting", isCorrect: false },
  ])
  const q7_4 = await upsertQuestion(t7.id, 4, "FILL_BLANK", "A ____ analysis tests how sensitive your conclusion is to changes in key assumptions.")
  await seedOptions(q7_4.id, [
    { text: "sensitivity", isCorrect: true },
  ])

  // ══════════════════════════════════════════════════════════════════════════════
  // PATHWAYS
  // ══════════════════════════════════════════════════════════════════════════════

  const p1 = await upsertPathway(
    "YCP New Joiner Program",
    "Everything you need to know to hit the ground running as a new YCP professional. Covers the firm's history, culture, mindset, and code of conduct.",
    false
  )
  await linkCourseToPathway(p1.id, c1.id, 1, 10)
  await linkCourseToPathway(p1.id, c2.id, 2, 10)
  await linkCourseToPathway(p1.id, c3.id, 3, 10)

  const p2 = await upsertPathway(
    "Leadership Development Program",
    "A curated program for YCP managers and senior professionals. Covers the foundations of leadership, coaching, and stakeholder communication. Requires manager approval to enrol.",
    true
  )
  await linkCourseToPathway(p2.id, c4.id, 1, 20)
  await linkCourseToPathway(p2.id, c5.id, 2, 20)

  const p3 = await upsertPathway(
    "Consulting Fundamentals",
    "The core analytical and problem-solving toolkit for YCP consultants at every level. Covers structured thinking, MECE, issue trees, and data-driven decision making.",
    false
  )
  await linkCourseToPathway(p3.id, c6.id, 1, 15)
  await linkCourseToPathway(p3.id, c7.id, 2, 15)

  // ══════════════════════════════════════════════════════════════════════════════
  // GENERAL BUSINESS PATHWAYS
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Course 8: Project Planning and Scope Management ──────────────────────────
  const c8 = await upsertCourse(
    "Project Planning and Scope Management",
    "How to initiate, plan, and control a project from charter to delivery."
  )
  await upsertContent(c8.id, 1, "Project Initiation and the Project Charter", "TEXT", `Every successful project begins before a single task is assigned. The initiation phase defines what the project is, why it matters, and who is responsible for it.

The Project Charter:
A project charter is the founding document of any project. It establishes:
• Project purpose and business case — why are we doing this?
• Objectives and success criteria — how will we know it succeeded?
• Scope — what is included, and critically, what is excluded
• Key stakeholders and their roles
• High-level timeline and budget

Work Breakdown Structure (WBS):
Once the charter is approved, the project manager decomposes the project into manageable chunks using a WBS. The WBS breaks the total scope into deliverables, then sub-deliverables, then individual tasks. A well-constructed WBS ensures nothing is forgotten and makes estimation far more accurate.

Scope Creep:
One of the most common reasons projects fail is scope creep — the gradual expansion of project scope without corresponding adjustments to time, budget, or resources. Signs of scope creep include:
• Stakeholders adding new requirements after the project has started
• "Small" changes that accumulate over time
• No formal change control process

Preventing scope creep requires a clear scope baseline, a formal change request process, and the discipline to say no to changes that are not formally approved.`)

  await upsertContent(c8.id, 2, "Scheduling, Milestones, and Progress Tracking", "TEXT", `A plan without a schedule is a wish. Effective project scheduling translates scope into a time-bound sequence of activities.

Key Scheduling Tools:

Gantt Chart
A Gantt chart displays tasks against a timeline, showing start and end dates, dependencies, and milestones. It provides an at-a-glance view of project progress and is the most widely used scheduling tool in project management.

Critical Path Method (CPM)
The critical path is the longest sequence of dependent tasks that determines the minimum project duration. Any delay on the critical path delays the entire project. Identifying the critical path helps project managers focus their attention on the tasks that matter most.

Milestones
Milestones are significant checkpoints in the project — not tasks, but markers that signal a phase has been completed. They create natural review points and help stakeholders track progress without getting lost in detail.

Progress Tracking:
• Hold brief weekly status meetings with the core team
• Use a RAG (Red / Amber / Green) status system to flag risks and delays early
• Compare actual progress against the baseline plan — do not update the baseline unless there is a formal scope change
• Escalate issues early; surprises are always more damaging than managed risks`)

  const t8 = await upsertTest(c8.id, 75)
  const q8_1 = await upsertQuestion(t8.id, 1, "MULTIPLE_CHOICE", "What is the primary purpose of a Work Breakdown Structure (WBS)?")
  await seedOptions(q8_1.id, [
    { text: "To assign budget to individual team members", isCorrect: false },
    { text: "To decompose project scope into manageable deliverables and tasks", isCorrect: true },
    { text: "To identify the critical path of the project", isCorrect: false },
    { text: "To document stakeholder communication preferences", isCorrect: false },
  ])
  const q8_2 = await upsertQuestion(t8.id, 2, "TRUE_FALSE", "Updating the project baseline after every change is a best practice in project management.")
  await seedOptions(q8_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q8_3 = await upsertQuestion(t8.id, 3, "MULTIPLE_CHOICE", "Which of the following best describes 'scope creep'?")
  await seedOptions(q8_3.id, [
    { text: "A formal process for adding new requirements to a project", isCorrect: false },
    { text: "The gradual, uncontrolled expansion of project scope", isCorrect: true },
    { text: "A deliberate reduction in project scope to meet deadlines", isCorrect: false },
    { text: "A scheduling technique used to shorten the critical path", isCorrect: false },
  ])
  const q8_4 = await upsertQuestion(t8.id, 4, "FILL_BLANK", "The ____ path is the longest sequence of dependent tasks and determines the minimum project duration.")
  await seedOptions(q8_4.id, [{ text: "critical", isCorrect: true }])

  // ── Course 9: Risk and Stakeholder Management ────────────────────────────────
  const c9 = await upsertCourse(
    "Risk and Stakeholder Management",
    "Identifying, assessing, and managing project risks and stakeholder relationships."
  )
  await upsertContent(c9.id, 1, "Risk Identification and the Risk Register", "TEXT", `Risk management is not about eliminating uncertainty — it is about understanding it well enough to make informed decisions.

The Risk Management Process:
1. Identify — brainstorm everything that could go wrong (and occasionally, go better than expected)
2. Assess — evaluate each risk by likelihood and impact
3. Respond — decide how to handle each risk
4. Monitor — track risks throughout the project

The Risk Register:
Every identified risk should be logged in a risk register, which captures:
• Risk description
• Likelihood (Low / Medium / High)
• Impact (Low / Medium / High)
• Overall risk rating (Likelihood × Impact)
• Risk owner — the person accountable for monitoring and responding to this risk
• Response strategy and contingency plan

Risk Response Strategies:
• Avoid — change the plan to eliminate the risk entirely
• Mitigate — take actions to reduce the likelihood or impact
• Transfer — shift the risk to a third party (e.g., insurance, contracts)
• Accept — acknowledge the risk and prepare a contingency plan

High-probability, high-impact risks demand immediate attention. Low-probability, low-impact risks can be accepted or monitored passively.`)

  await upsertContent(c9.id, 2, "Stakeholder Mapping and Engagement", "TEXT", `Projects succeed when the right people are engaged in the right way at the right time. Stakeholder management is the discipline of making that happen.

Identifying Stakeholders:
Cast a wide net initially — anyone who affects or is affected by the project is a stakeholder. This includes:
• Sponsors and decision-makers
• End users and customers
• Delivery teams and subject matter experts
• Regulators, partners, and vendors

The Power/Interest Matrix:
Plot stakeholders on a 2×2 matrix of power (ability to influence the project) versus interest (degree of concern about outcomes):
• High power, high interest → Manage closely (key stakeholders, engage frequently)
• High power, low interest → Keep satisfied (senior executives, brief them regularly)
• Low power, high interest → Keep informed (team members, send updates)
• Low power, low interest → Monitor (peripheral stakeholders, minimal engagement)

Stakeholder Engagement Plan:
For each key stakeholder, define:
• What information they need and when
• Their preferred communication channel
• Potential concerns or resistance points
• How you will address those concerns proactively`)

  const t9 = await upsertTest(c9.id, 70)
  const q9_1 = await upsertQuestion(t9.id, 1, "MULTIPLE_CHOICE", "Which risk response strategy involves shifting the risk to a third party?")
  await seedOptions(q9_1.id, [
    { text: "Avoid", isCorrect: false },
    { text: "Mitigate", isCorrect: false },
    { text: "Transfer", isCorrect: true },
    { text: "Accept", isCorrect: false },
  ])
  const q9_2 = await upsertQuestion(t9.id, 2, "MULTIPLE_CHOICE", "In the Power/Interest Matrix, how should you treat stakeholders with high power but low interest?")
  await seedOptions(q9_2.id, [
    { text: "Manage closely with frequent engagement", isCorrect: false },
    { text: "Keep satisfied with regular briefings", isCorrect: true },
    { text: "Keep informed with periodic updates", isCorrect: false },
    { text: "Monitor passively with minimal engagement", isCorrect: false },
  ])
  const q9_3 = await upsertQuestion(t9.id, 3, "RANKING", "Arrange the risk management process steps in the correct order.")
  await seedOptions(q9_3.id, [
    { text: "Identify", order: 1 },
    { text: "Assess", order: 2 },
    { text: "Respond", order: 3 },
    { text: "Monitor", order: 4 },
  ])

  // ── Course 10: M&A Process Overview ─────────────────────────────────────────
  const c10 = await upsertCourse(
    "M&A Process Overview",
    "The end-to-end mechanics of a mergers and acquisitions transaction, from strategy to close."
  )
  await upsertContent(c10.id, 1, "Phases of an M&A Transaction", "TEXT", `Mergers and acquisitions are among the most complex and consequential decisions a business can make. Understanding the process is essential for any business professional involved in corporate development or advisory work.

Phase 1 — Strategy and Target Identification
Every M&A transaction begins with a strategic rationale: why does this deal make sense? Common motivations include:
• Market expansion (geographic or segment)
• Capability or technology acquisition
• Consolidation and cost synergies
• Vertical integration

Once the strategic rationale is clear, potential targets are identified and screened against criteria such as size, culture fit, geographic presence, and financial performance.

Phase 2 — Initial Approach and NDA
The acquirer makes a discreet approach to the target. If there is mutual interest, both parties sign a Non-Disclosure Agreement (NDA) before sharing sensitive information.

Phase 3 — Preliminary Valuation and Letter of Intent (LOI)
The acquirer conducts a high-level valuation and submits a non-binding Letter of Intent (LOI) or Term Sheet, outlining the proposed deal structure and price range. The LOI signals serious intent and typically includes exclusivity provisions.

Phase 4 — Due Diligence
Due diligence is a comprehensive investigation of the target across legal, financial, commercial, operational, and HR dimensions. The goal is to validate the investment thesis and identify risks that could affect price or deal structure.

Phase 5 — Negotiation and Definitive Agreement
Based on due diligence findings, the parties negotiate final terms. A definitive agreement (such as a Share Purchase Agreement) is signed when both sides reach agreement.

Phase 6 — Regulatory Approval and Closing
Depending on the deal size and jurisdictions involved, regulatory approval may be required. Once cleared, the transaction closes and the acquirer takes ownership.`)

  await upsertContent(c10.id, 2, "Due Diligence Deep Dive", "TEXT", `Due diligence (DD) is the most intensive phase of an M&A process and is where many deals are renegotiated or abandoned. A rigorous DD process protects the acquirer from overpaying or inheriting hidden liabilities.

Types of Due Diligence:

Commercial Due Diligence (CDD)
Validates the target's market position, revenue sustainability, customer concentration, and competitive dynamics. Key questions: Is the revenue recurring or one-off? How defensible is the market share? What are the growth assumptions?

Financial Due Diligence (FDD)
Examines historical financial performance, quality of earnings, working capital dynamics, and debt profile. Adjustments are made to reported EBITDA to arrive at a "normalised" figure.

Legal Due Diligence
Reviews contracts, litigation exposure, regulatory compliance, intellectual property ownership, and employment agreements.

Operational Due Diligence
Assesses the quality of the target's operations, systems, and management team. Identifies integration risks and operational improvement opportunities.

HR Due Diligence
Reviews the organisational structure, key person dependencies, compensation and benefits, and cultural compatibility.

Red Flags to Watch For:
• Customer concentration (top 3 customers > 40% of revenue)
• Aggressive revenue recognition policies
• Unusually high management turnover
• Pending litigation or regulatory investigations
• Off-balance-sheet liabilities`)

  const t10 = await upsertTest(c10.id, 75)
  const q10_1 = await upsertQuestion(t10.id, 1, "MULTIPLE_CHOICE", "What is the primary purpose of a Letter of Intent (LOI) in an M&A process?")
  await seedOptions(q10_1.id, [
    { text: "To finalise the legal terms of the transaction", isCorrect: false },
    { text: "To signal serious intent and outline proposed deal terms on a non-binding basis", isCorrect: true },
    { text: "To transfer regulatory approval rights to the acquirer", isCorrect: false },
    { text: "To initiate the due diligence process officially", isCorrect: false },
  ])
  const q10_2 = await upsertQuestion(t10.id, 2, "MULTIPLE_CHOICE", "Which type of due diligence focuses on validating market position and revenue sustainability?")
  await seedOptions(q10_2.id, [
    { text: "Financial Due Diligence", isCorrect: false },
    { text: "Legal Due Diligence", isCorrect: false },
    { text: "Commercial Due Diligence", isCorrect: true },
    { text: "Operational Due Diligence", isCorrect: false },
  ])
  const q10_3 = await upsertQuestion(t10.id, 3, "RANKING", "Arrange the M&A process phases in the correct order.")
  await seedOptions(q10_3.id, [
    { text: "Strategy and Target Identification", order: 1 },
    { text: "Initial Approach and NDA", order: 2 },
    { text: "Letter of Intent", order: 3 },
    { text: "Due Diligence", order: 4 },
    { text: "Definitive Agreement", order: 5 },
    { text: "Regulatory Approval and Closing", order: 6 },
  ])

  // ── Course 11: Valuation in M&A ──────────────────────────────────────────────
  const c11 = await upsertCourse(
    "Valuation in M&A",
    "Core valuation methodologies used to price targets in mergers and acquisitions."
  )
  await upsertContent(c11.id, 1, "Valuation Methodologies", "TEXT", `Valuation is both science and art. In M&A, valuation determines what a buyer is willing to pay and what a seller is willing to accept. Professionals use multiple methodologies and triangulate across them.

1. Discounted Cash Flow (DCF)
DCF values a business based on the present value of its expected future free cash flows, discounted at the weighted average cost of capital (WACC). It is theoretically the most rigorous method but highly sensitive to assumptions — a small change in terminal growth rate or discount rate can dramatically change the output.

Key steps:
• Forecast free cash flows for 5–10 years
• Estimate a terminal value (using a perpetuity growth model or exit multiple)
• Discount all cash flows and terminal value back to the present using WACC

2. Comparable Company Analysis (Comps)
Compare the target to publicly listed companies in the same industry using multiples such as:
• EV/EBITDA — most commonly used in M&A
• EV/Revenue — useful for high-growth or unprofitable businesses
• P/E (Price-to-Earnings) — common in public market contexts

3. Precedent Transaction Analysis
Look at multiples paid in prior M&A deals in the same sector. This reflects a "control premium" — the premium paid to acquire control of a business — which comps do not capture.

4. Asset-Based Valuation
Values the business based on the net value of its assets. Most relevant for capital-intensive businesses or distressed situations.

Triangulation:
No single method is definitive. A football field chart displaying the valuation ranges from each methodology side by side allows deal teams to identify a reasonable price range and negotiate confidently.`)

  await upsertContent(c11.id, 2, "Synergies and Deal Pricing", "TEXT", `A key question in any acquisition is: how much of the value being paid reflects intrinsic value versus expected synergies?

Types of Synergies:

Revenue Synergies
• Cross-selling opportunities between the two companies' customer bases
• Entering new geographies or segments using the target's network
• Combined product offering that neither company could offer alone

Revenue synergies are harder to achieve than cost synergies and should be modelled conservatively.

Cost Synergies
• Elimination of duplicate functions (finance, HR, IT)
• Procurement savings from combined purchasing power
• Consolidation of facilities and infrastructure

Cost synergies are more predictable and are typically the primary driver of deal value in consolidation transactions.

Integration Costs
Synergies are never free. Integration requires investment in systems, people, and change management. These costs should be explicitly modelled and deducted from the synergy value.

The "Winner's Curse":
In competitive auctions, the winning bidder often pays a price that fully or over-captures the synergy value, leaving little room for error. Disciplined M&A practitioners set a walk-away price before bidding begins and stick to it.

Rule of thumb: if you need every synergy to materialise perfectly to justify the price, the deal is overpriced.`)

  const t11 = await upsertTest(c11.id, 75)
  const q11_1 = await upsertQuestion(t11.id, 1, "MULTIPLE_CHOICE", "Which valuation methodology is most sensitive to changes in long-term growth and discount rate assumptions?")
  await seedOptions(q11_1.id, [
    { text: "Comparable Company Analysis", isCorrect: false },
    { text: "Precedent Transaction Analysis", isCorrect: false },
    { text: "Discounted Cash Flow (DCF)", isCorrect: true },
    { text: "Asset-Based Valuation", isCorrect: false },
  ])
  const q11_2 = await upsertQuestion(t11.id, 2, "TRUE_FALSE", "Revenue synergies are generally more predictable and easier to achieve than cost synergies.")
  await seedOptions(q11_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q11_3 = await upsertQuestion(t11.id, 3, "MATCHING", "Match each valuation method to its primary characteristic.")
  await seedOptions(q11_3.id, [
    { text: "DCF", matchKey: "Values business based on discounted future cash flows" },
    { text: "Comparable Company Analysis", matchKey: "Uses multiples from publicly listed peers" },
    { text: "Precedent Transactions", matchKey: "Reflects control premium from prior M&A deals" },
  ])

  // ── Course 12: Research Design and Methodology ───────────────────────────────
  const c12 = await upsertCourse(
    "Research Design and Methodology",
    "Designing effective market research studies using quantitative and qualitative methods."
  )
  await upsertContent(c12.id, 1, "Quantitative vs Qualitative Research", "TEXT", `Market research is the systematic process of gathering, analysing, and interpreting information about a market, customers, or competitors. Choosing the right research method is as important as the research itself.

Quantitative Research
Quantitative research collects numerical data that can be statistically analysed. It answers questions like "how many?" and "how often?"

Common methods:
• Surveys and questionnaires (online, phone, in-person)
• Structured interviews with fixed response options
• Observational studies with countable outcomes
• Sales and transaction data analysis

Strengths: Large sample sizes, statistical significance, generalisable findings
Weaknesses: Cannot capture nuance, "why" behind behaviour, or unexpected themes

Qualitative Research
Qualitative research collects non-numerical data — words, images, behaviours — to understand motivations, attitudes, and experiences.

Common methods:
• In-depth interviews (IDIs) — 30–60 minute one-on-one conversations
• Focus groups — moderated group discussions (6–10 participants)
• Ethnographic research — observing customers in their natural environment
• Social listening — analysing online conversations and reviews

Strengths: Rich insights, uncovers "why", flexible and exploratory
Weaknesses: Small samples, subjective interpretation, not statistically generalisable

Mixed Methods:
The most robust research designs combine both approaches — using qualitative research to generate hypotheses and quantitative research to test them at scale.`)

  await upsertContent(c12.id, 2, "Sampling, Bias, and Research Design", "TEXT", `Even a well-designed questionnaire yields useless results if the sample is wrong or the research process introduces bias.

Sampling:
The sample is the subset of the population you study. Good sampling is:
• Representative — reflects the characteristics of the broader population
• Sufficiently large — enough responses to achieve statistical significance
• Appropriately targeted — the right people for the research question

Common sampling methods:
• Random sampling — every person in the population has an equal chance of selection (most rigorous)
• Stratified sampling — population is divided into subgroups and sampled proportionally
• Quota sampling — predefined quotas per segment (common in market research for speed)
• Convenience sampling — whoever is easiest to reach (most common but most prone to bias)

Research Biases to Avoid:
• Selection bias — your sample systematically over- or under-represents certain groups
• Confirmation bias — designing questions that lead respondents toward your expected answer
• Social desirability bias — respondents answer in ways they think are expected or acceptable
• Leading questions — "Don't you think our product is excellent?" rather than "How would you rate our product?"
• Recency bias — asking about experiences skews toward the most recent interaction

Survey Design Principles:
• Start with broad, open questions before moving to specific ones
• Use Likert scales consistently (1–5 or 1–7, not mixed)
• Test your survey on a small group before launching
• Keep it short — every additional minute of survey length reduces completion rates`)

  const t12 = await upsertTest(c12.id, 70)
  const q12_1 = await upsertQuestion(t12.id, 1, "MULTIPLE_CHOICE", "Which research method is best suited for understanding the 'why' behind customer behaviour?")
  await seedOptions(q12_1.id, [
    { text: "Online survey with 500 respondents", isCorrect: false },
    { text: "In-depth qualitative interviews", isCorrect: true },
    { text: "Transaction data analysis", isCorrect: false },
    { text: "Structured questionnaire with fixed responses", isCorrect: false },
  ])
  const q12_2 = await upsertQuestion(t12.id, 2, "TRUE_FALSE", "Convenience sampling is the most rigorous sampling method because it is easy to implement.")
  await seedOptions(q12_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q12_3 = await upsertQuestion(t12.id, 3, "MULTIPLE_CHOICE", "What is 'social desirability bias' in research?")
  await seedOptions(q12_3.id, [
    { text: "Respondents answering in ways they think are expected or socially acceptable", isCorrect: true },
    { text: "Researchers selecting only respondents who share their views", isCorrect: false },
    { text: "Overweighting recent experiences when evaluating a brand", isCorrect: false },
    { text: "Using leading questions that suggest a preferred answer", isCorrect: false },
  ])

  // ── Course 13: Analyzing and Presenting Consumer Insights ────────────────────
  const c13 = await upsertCourse(
    "Analyzing and Presenting Consumer Insights",
    "Turning raw research data into actionable insights and compelling narratives."
  )
  await upsertContent(c13.id, 1, "Customer Segmentation and Personas", "TEXT", `Raw data becomes powerful when it is organised into patterns that drive decisions. Customer segmentation and personas are the bridge between data and strategy.

Customer Segmentation:
Segmentation divides a market into distinct groups of customers with similar characteristics, needs, or behaviours. Common segmentation dimensions:
• Demographic — age, gender, income, education, occupation
• Geographic — country, city, urban vs rural
• Psychographic — values, lifestyle, attitudes, personality
• Behavioural — purchase frequency, brand loyalty, usage occasions, benefits sought

The best segmentation is actionable — each segment should be distinct, measurable, accessible, and large enough to be commercially relevant.

Customer Personas:
A persona is a fictionalised representation of a customer segment, grounded in real research data. A well-constructed persona includes:
• Name and demographic profile
• Goals and motivations
• Pain points and frustrations
• Decision-making criteria
• Preferred channels and touchpoints

Personas are used to align teams around a shared understanding of who the customer is. They make abstract data tangible and help teams make faster decisions.

Segmentation Pitfalls:
• Creating too many segments (5–7 is usually the right number)
• Segments that overlap — good segmentation is MECE
• Personas based on assumptions rather than real data
• Forgetting to update segmentation as the market evolves`)

  await upsertContent(c13.id, 2, "Turning Insights into Recommendations", "TEXT", `Insight without action is just information. The final step in any research project is translating what you have learned into clear, actionable recommendations.

The Insight Pyramid:
• Data — what did we observe? (e.g., "65% of respondents said price is their primary purchase driver")
• Insight — what does this mean? (e.g., "Price sensitivity is driven by a lack of perceived differentiation, not budget constraints")
• Implication — so what? (e.g., "Communicating unique product benefits could reduce price sensitivity and support premium pricing")
• Recommendation — what should we do? (e.g., "Invest in brand communication highlighting X, Y, and Z product differentiators")

Storytelling with Data:
A research presentation is not a data dump. Structure it as a narrative:
1. Set the context — what question were we trying to answer?
2. Describe the approach — how did we conduct the research?
3. Share the key findings — no more than 5–7 main takeaways
4. Interpret the findings — what do they mean for the business?
5. Make recommendations — what should we do?

Visualisation Principles:
• Choose the right chart for the message (bar for comparison, line for trends, scatter for correlation)
• Label data points directly rather than relying on legends
• Highlight the key number or trend — do not make the audience search for the insight
• Keep it simple — one insight per chart`)

  const t13 = await upsertTest(c13.id, 70)
  const q13_1 = await upsertQuestion(t13.id, 1, "MULTIPLE_CHOICE", "Which segmentation dimension groups customers by their values, lifestyle, and attitudes?")
  await seedOptions(q13_1.id, [
    { text: "Demographic", isCorrect: false },
    { text: "Geographic", isCorrect: false },
    { text: "Psychographic", isCorrect: true },
    { text: "Behavioural", isCorrect: false },
  ])
  const q13_2 = await upsertQuestion(t13.id, 2, "RANKING", "Arrange the Insight Pyramid levels from bottom (base) to top.")
  await seedOptions(q13_2.id, [
    { text: "Data", order: 1 },
    { text: "Insight", order: 2 },
    { text: "Implication", order: 3 },
    { text: "Recommendation", order: 4 },
  ])
  const q13_3 = await upsertQuestion(t13.id, 3, "TRUE_FALSE", "A customer persona should be based primarily on team assumptions rather than real research data.")
  await seedOptions(q13_3.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])

  // ── Course 14: Introduction to Lean Thinking ─────────────────────────────────
  const c14 = await upsertCourse(
    "Introduction to Lean Thinking",
    "The principles of Lean — eliminating waste and maximising value in any process."
  )
  await upsertContent(c14.id, 1, "The Origins and Principles of Lean", "TEXT", `Lean is a methodology focused on maximising customer value while minimising waste. Originally developed by Toyota as the Toyota Production System (TPS), Lean has since been applied across industries from healthcare to financial services to software development.

The Five Lean Principles (Womack & Jones):
1. Define Value — value is defined by the customer, not the producer. What is the customer actually willing to pay for?
2. Map the Value Stream — identify every step in the process and classify each as value-adding, necessary non-value-adding, or waste
3. Create Flow — eliminate bottlenecks and interruptions so that value-adding steps flow continuously
4. Establish Pull — produce only what the customer needs, when they need it (rather than pushing output based on forecasts)
5. Pursue Perfection — Lean is a continuous improvement journey, not a one-time fix

The 8 Wastes (TIMWOODS):
• Transportation — unnecessary movement of materials or information
• Inventory — excess stock or work-in-progress beyond immediate need
• Motion — unnecessary movement of people
• Waiting — idle time waiting for the next step
• Overproduction — producing more than is needed
• Over-processing — doing more work than the customer requires
• Defects — errors that require rework or correction
• Skills (underutilised) — not leveraging people's full capabilities

The first step in any Lean improvement is to walk the process and identify which of these wastes are present.`)

  await upsertContent(c14.id, 2, "5S and Visual Management", "TEXT", `5S is a foundational Lean tool for organising the workplace to make problems visible and processes efficient.

The 5S Framework:
1. Sort (Seiri) — remove everything from the workspace that is not needed. If in doubt, move it to a holding area and tag it with a date; if it has not been used within 30 days, discard it.
2. Set in Order (Seiton) — organise what remains so that everything has a designated place and is easy to find. "A place for everything and everything in its place."
3. Shine (Seiso) — clean the workspace thoroughly. Cleanliness is not about aesthetics — a clean workspace makes defects and anomalies immediately visible.
4. Standardise (Seiketsu) — create standards and procedures so that the first three S's are maintained consistently over time.
5. Sustain (Shitsuke) — build 5S into the routine through audits, checklists, and a culture of discipline.

Visual Management:
Lean workplaces use visual cues to make the status of operations instantly apparent to anyone — without needing to ask.
• Kanban boards — visualise work in progress and identify bottlenecks
• Andon lights — red/green signals that indicate machine or process status
• Floor markings — clearly defined lanes and storage areas
• Production boards — real-time display of output versus target

The goal of visual management is to make abnormalities instantly visible so they can be addressed immediately.`)

  const t14 = await upsertTest(c14.id, 75)
  const q14_1 = await upsertQuestion(t14.id, 1, "MULTIPLE_CHOICE", "In Lean thinking, who defines 'value'?")
  await seedOptions(q14_1.id, [
    { text: "The production manager", isCorrect: false },
    { text: "The CEO", isCorrect: false },
    { text: "The customer", isCorrect: true },
    { text: "The quality assurance team", isCorrect: false },
  ])
  const q14_2 = await upsertQuestion(t14.id, 2, "MULTIPLE_CHOICE", "Which of the 8 Wastes refers to producing more output than the customer currently needs?")
  await seedOptions(q14_2.id, [
    { text: "Over-processing", isCorrect: false },
    { text: "Overproduction", isCorrect: true },
    { text: "Inventory", isCorrect: false },
    { text: "Waiting", isCorrect: false },
  ])
  const q14_3 = await upsertQuestion(t14.id, 3, "RANKING", "Arrange the 5S steps in the correct order.")
  await seedOptions(q14_3.id, [
    { text: "Sort", order: 1 },
    { text: "Set in Order", order: 2 },
    { text: "Shine", order: 3 },
    { text: "Standardise", order: 4 },
    { text: "Sustain", order: 5 },
  ])

  // ── Course 15: The DMAIC Framework ───────────────────────────────────────────
  const c15 = await upsertCourse(
    "The DMAIC Framework",
    "Applying Six Sigma's DMAIC methodology to solve business problems and reduce process variation."
  )
  await upsertContent(c15.id, 1, "Understanding DMAIC", "TEXT", `DMAIC is the core problem-solving framework of Six Sigma. It provides a structured, data-driven approach to improving existing processes. DMAIC stands for Define, Measure, Analyze, Improve, and Control.

Define
Clearly articulate the problem, the project goals, and the scope. Tools used in this phase include:
• Project charter — defines the problem, goals, team, timeline, and business case
• SIPOC diagram — maps the Suppliers, Inputs, Process, Outputs, and Customers at a high level
• Voice of the Customer (VoC) — captures customer requirements and translates them into measurable specifications

Measure
Quantify the current state of the process. You cannot improve what you cannot measure.
• Identify the key process metrics (inputs and outputs)
• Collect baseline data to establish current performance
• Calculate process capability (Cp, Cpk) and sigma level
• Validate the measurement system (ensure your data collection method is reliable)

Analyze
Identify the root causes of the problem. Move from symptoms to causes.
• Create a process map to visualise every step
• Use a fishbone (Ishikawa) diagram to brainstorm potential causes
• Apply the 5 Whys to drill down to root causes
• Validate root causes with data — do not assume

Improve
Develop, test, and implement solutions to address the root causes.
• Generate solution ideas using brainstorming or benchmarking
• Pilot the most promising solution on a small scale
• Measure results and refine before full implementation

Control
Sustain the gains and prevent the problem from returning.
• Develop a control plan and standard operating procedures
• Implement monitoring systems and control charts
• Hand over to the process owner with clear accountability`)

  await upsertContent(c15.id, 2, "Root Cause Analysis Tools", "TEXT", `The Analyze phase of DMAIC is where many improvement projects succeed or fail. Identifying the true root cause — rather than treating symptoms — is the difference between a lasting fix and a temporary patch.

The 5 Whys:
A deceptively simple technique: ask "Why?" five times to drill past surface symptoms to the underlying root cause.

Example:
Problem: A customer invoice was sent with incorrect figures.
Why 1: The sales rep entered the wrong price.
Why 2: The price list was out of date.
Why 3: The pricing team did not notify sales when prices changed.
Why 4: There is no standard process for communicating price changes.
Why 5: No one is accountable for maintaining pricing communications.
Root cause: Lack of an owner for the pricing communication process.

The Fishbone Diagram (Ishikawa):
A fishbone diagram organises potential causes into categories — typically the 6Ms: Man, Machine, Method, Material, Measurement, and Mother Nature (Environment). Teams brainstorm causes in each category, creating a visual map of all possible contributors to the problem.

Pareto Analysis (80/20 Rule):
In most processes, 80% of the problems are caused by 20% of the causes. A Pareto chart ranks causes by frequency or impact, helping teams prioritise which root causes to address first for maximum effect.

Hypothesis Testing:
Once potential root causes are identified, use data to confirm or disprove them. Correlation analysis, regression analysis, or simple before/after comparisons can validate whether a suspected cause is statistically significant.`)

  const t15 = await upsertTest(c15.id, 75)
  const q15_1 = await upsertQuestion(t15.id, 1, "RANKING", "Arrange the DMAIC phases in the correct order.")
  await seedOptions(q15_1.id, [
    { text: "Define", order: 1 },
    { text: "Measure", order: 2 },
    { text: "Analyze", order: 3 },
    { text: "Improve", order: 4 },
    { text: "Control", order: 5 },
  ])
  const q15_2 = await upsertQuestion(t15.id, 2, "MULTIPLE_CHOICE", "What is the primary goal of the Control phase in DMAIC?")
  await seedOptions(q15_2.id, [
    { text: "To identify the root cause of the problem", isCorrect: false },
    { text: "To sustain the gains and prevent the problem from returning", isCorrect: true },
    { text: "To pilot and test potential solutions", isCorrect: false },
    { text: "To establish baseline performance metrics", isCorrect: false },
  ])
  const q15_3 = await upsertQuestion(t15.id, 3, "TRUE_FALSE", "The 5 Whys technique involves asking 'Why?' exactly five times and stopping, even if the root cause has not been found.")
  await seedOptions(q15_3.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])

  // ── Course 16: Productivity and Time Management Working Remotely ─────────────
  const c16 = await upsertCourse(
    "Productivity and Time Management Working Remotely",
    "Building routines, boundaries, and focus systems to perform at your best when working from home."
  )
  await upsertContent(c16.id, 1, "Designing Your Remote Work Environment", "TEXT", `Remote work offers flexibility, but it also demands intentionality. Without a structured environment, the boundaries between work and personal life blur, and productivity suffers.

Your Physical Workspace:
• Dedicate a specific space to work — even in a small home. A consistent workspace creates a psychological cue that it is time to focus.
• Invest in ergonomics — a proper chair, monitor at eye level, and good lighting reduce fatigue and improve concentration.
• Minimise distractions — inform household members of your working hours and use visual signals (like a closed door) to indicate focus time.

Structuring Your Day:
• Maintain consistent start and end times — the absence of commute makes it easy to either start too late or never stop working.
• Plan your day the night before — write down your top 3 priorities for tomorrow before you close your laptop.
• Time-block your calendar — protect deep work blocks (90–120 minutes of uninterrupted focus) in the morning when cognitive energy is highest.
• Schedule breaks — the Pomodoro technique (25 minutes on, 5 minutes off) helps maintain focus throughout the day.

Digital Boundaries:
• Turn off non-essential notifications during focus blocks
• Set a hard end time and stick to it — closing your laptop is your "commute home"
• Use separate browser profiles or devices for work and personal use where possible`)

  await upsertContent(c16.id, 2, "Async Communication and Remote Collaboration", "TEXT", `Remote work is not just working from home — it is a fundamentally different way of collaborating. Mastering asynchronous communication is the key skill that separates high-performing remote teams from struggling ones.

Synchronous vs Asynchronous:
• Synchronous communication happens in real time — video calls, phone calls, instant messaging
• Asynchronous (async) communication does not require an immediate response — emails, recorded video messages, shared documents, task management tools

Default to Async:
Most remote communication does not need to be synchronous. Before scheduling a meeting, ask: "Could this be an email? A Loom video? A comment on a document?"

Writing Well for Async:
When you write a message or request asynchronously, assume the reader cannot ask you a follow-up question immediately. Write with:
• Full context — do not assume the reader remembers the background
• Clear action — what exactly do you need from them, and by when?
• Relevant links — attach the document, not just the project name

Remote Meeting Hygiene:
When meetings are necessary, make them count:
• Always share an agenda in advance
• Start and end on time — lateness is more disruptive in virtual meetings
• Assign a note-taker and distribute action items within 24 hours
• Use video — it increases engagement and builds connection
• Declare a "camera-optional" meeting only when appropriate, not as a default`)

  const t16 = await upsertTest(c16.id, 70)
  const q16_1 = await upsertQuestion(t16.id, 1, "MULTIPLE_CHOICE", "What does 'asynchronous communication' mean in a remote work context?")
  await seedOptions(q16_1.id, [
    { text: "Communication that happens in real time, requiring immediate response", isCorrect: false },
    { text: "Communication that does not require an immediate response", isCorrect: true },
    { text: "Communication conducted exclusively via video calls", isCorrect: false },
    { text: "Communication between team members in different time zones only", isCorrect: false },
  ])
  const q16_2 = await upsertQuestion(t16.id, 2, "TRUE_FALSE", "Scheduling a meeting is always more effective than sending an asynchronous message.")
  await seedOptions(q16_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q16_3 = await upsertQuestion(t16.id, 3, "MULTIPLE_CHOICE", "According to the deep work principle, when is the best time to schedule high-focus work blocks?")
  await seedOptions(q16_3.id, [
    { text: "Late afternoon, after all meetings are done", isCorrect: false },
    { text: "Immediately after lunch", isCorrect: false },
    { text: "In the morning, when cognitive energy is highest", isCorrect: true },
    { text: "Whenever there is a gap in the calendar", isCorrect: false },
  ])

  // ── Course 17: Business Writing Essentials ───────────────────────────────────
  const c17 = await upsertCourse(
    "Business Writing Essentials",
    "Writing clearly, concisely, and persuasively in professional contexts."
  )
  await upsertContent(c17.id, 1, "Principles of Clear Business Writing", "TEXT", `In business, writing is thinking made visible. Unclear writing signals unclear thinking. Mastering business writing is one of the highest-leverage professional skills you can develop.

The Core Principles:

1. Clarity — use simple, direct language. Prefer active voice: "The team completed the analysis" over "The analysis was completed by the team." Avoid jargon unless you are certain the reader shares the terminology.

2. Conciseness — respect the reader's time. Every sentence should earn its place. Read every paragraph and ask: "What would be lost if I deleted this?" If the answer is "nothing," delete it.

3. Structure — impose logical order on your writing before you start, not after. Use the Pyramid Principle: state your conclusion first, then provide supporting arguments, then evidence.

4. Tone — match your tone to your audience and purpose. A message to a peer can be conversational; a message to a senior client should be more formal. Never confuse informality with unprofessionalism.

5. Precision — vague language creates vague action. "Please review soon" is worse than "Please send your comments by Thursday at 5pm."

Email Best Practices:
• Subject line: specific and actionable ("Q3 Report — Review by Friday" not "Update")
• Open with the most important point
• One topic per email wherever possible
• Close with a clear next step and owner
• Proofread before sending — typos and errors undermine credibility`)

  await upsertContent(c17.id, 2, "Executive Summaries and Business Reports", "TEXT", `Two of the most impactful forms of business writing are the executive summary and the formal business report. Mastering both will significantly increase your professional effectiveness.

The Executive Summary:
An executive summary is not an introduction — it is a standalone document that captures the essential conclusions and recommendations of a longer report. A busy senior leader should be able to read the executive summary and have everything they need to make a decision.

Structure of an executive summary:
• Context — one sentence on why this document exists
• Key findings — 3–5 bullet points summarising the most important discoveries
• Recommendations — what should be done as a result?
• Next steps — what needs to happen, by whom, and by when?

The executive summary is written last but placed first.

Business Report Structure:
1. Title page and date
2. Executive summary
3. Introduction and objectives
4. Methodology (how the analysis was conducted)
5. Findings (what was discovered)
6. Analysis and discussion (what it means)
7. Recommendations
8. Appendices (supporting data)

Report Writing Tips:
• Use headings and subheadings to enable skimming
• Use bullet points for lists of 3 or more items
• Every chart and table needs a title and a callout box highlighting the key insight
• Use consistent formatting throughout — inconsistency signals lack of care`)

  const t17 = await upsertTest(c17.id, 70)
  const q17_1 = await upsertQuestion(t17.id, 1, "MULTIPLE_CHOICE", "In the Pyramid Principle for business writing, what comes first?")
  await seedOptions(q17_1.id, [
    { text: "Background and context", isCorrect: false },
    { text: "Supporting evidence", isCorrect: false },
    { text: "The conclusion or recommendation", isCorrect: true },
    { text: "The methodology", isCorrect: false },
  ])
  const q17_2 = await upsertQuestion(t17.id, 2, "TRUE_FALSE", "An executive summary is essentially an introduction that tells the reader what the report will discuss.")
  await seedOptions(q17_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q17_3 = await upsertQuestion(t17.id, 3, "MULTIPLE_CHOICE", "Which of the following is the most effective email subject line?")
  await seedOptions(q17_3.id, [
    { text: "Update", isCorrect: false },
    { text: "Quick question", isCorrect: false },
    { text: "Budget Proposal — Approval Needed by Friday", isCorrect: true },
    { text: "FYI", isCorrect: false },
  ])

  // ── Course 18: Presentation Skills and Public Speaking ───────────────────────
  const c18 = await upsertCourse(
    "Presentation Skills and Public Speaking",
    "Designing and delivering presentations that engage, persuade, and inspire action."
  )
  await upsertContent(c18.id, 1, "Structuring a Compelling Presentation", "TEXT", `A great presentation is not a collection of slides — it is a story with a clear narrative arc, a protagonist (the audience), and a resolution (the decision or action you want them to take).

The SCR Structure (Situation, Complication, Resolution):
• Situation — establish the shared context. What is the current state of affairs? This is common ground between you and the audience.
• Complication — introduce the tension. What problem, challenge, or opportunity disrupts the status quo?
• Resolution — present your answer, recommendation, or solution.

This structure creates narrative momentum. The audience leans in because you have established a problem that needs solving.

Slide Design Principles:
• One idea per slide — if a slide has two key messages, it should be two slides
• Assertion-Evidence format — slide title states the conclusion; slide body provides the evidence
• Use the "squint test" — if you squint at a slide and cannot understand the main point, it is too complex
• Limit text — slides are a visual aid, not a teleprompter
• Consistent visual language — font sizes, colours, and spacing should be uniform throughout

Opening Strong:
The first 60 seconds determine whether the audience decides to pay attention. Open with:
• A provocative question or surprising statistic
• A brief story or anecdote relevant to the topic
• A bold statement of what the audience will learn or gain
Never open with "Hello, my name is…" or an agenda slide.`)

  await upsertContent(c18.id, 2, "Delivery, Nerves, and Handling Questions", "TEXT", `The best-designed presentation can be undermined by poor delivery. Conversely, a mediocre deck can be elevated by a confident, engaging presenter.

Managing Presentation Nerves:
• Preparation is the antidote to anxiety — know your material so well that you could present it without slides
• Reframe nerves as energy — the physiological response to nervousness and excitement is identical
• Breathe before you begin — three slow, deep breaths lower your heart rate and slow your speech
• Practice out loud — reading your notes silently is not rehearsing

Delivery Techniques:
• Eye contact — look at one person for a full thought, then move to another. Do not scan the room.
• Pace — most presenters speak too fast when nervous. Deliberately slow down.
• Pauses — a pause of 2–3 seconds feels much shorter to the speaker than to the audience. Use pauses after key points to let them land.
• Posture — stand with feet shoulder-width apart, weight evenly distributed. Avoid pacing, swaying, or crossing arms.
• Voice — vary your pitch, pace, and volume to maintain engagement. A monotone voice loses audiences quickly.

Handling Q&A:
• Listen to the full question before answering — do not interrupt
• Paraphrase the question ("So you are asking about…") to confirm understanding and buy thinking time
• If you do not know the answer, say so: "That is a great question and I do not have that data to hand — I will follow up with you by tomorrow."
• Do not let one questioner dominate — invite questions from different parts of the room`)

  const t18 = await upsertTest(c18.id, 70)
  const q18_1 = await upsertQuestion(t18.id, 1, "MULTIPLE_CHOICE", "In the SCR presentation structure, what does the 'Complication' represent?")
  await seedOptions(q18_1.id, [
    { text: "The shared context between the presenter and audience", isCorrect: false },
    { text: "The problem, challenge, or opportunity that disrupts the status quo", isCorrect: true },
    { text: "The final recommendation or call to action", isCorrect: false },
    { text: "A detailed explanation of the presenter's methodology", isCorrect: false },
  ])
  const q18_2 = await upsertQuestion(t18.id, 2, "TRUE_FALSE", "The best way to handle a question you cannot answer is to give your best guess to avoid appearing unprepared.")
  await seedOptions(q18_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q18_3 = await upsertQuestion(t18.id, 3, "MULTIPLE_CHOICE", "What does the 'assertion-evidence' slide format mean?")
  await seedOptions(q18_3.id, [
    { text: "The slide title lists the topic and the body contains all supporting text", isCorrect: false },
    { text: "The slide title states the conclusion and the body provides evidence for it", isCorrect: true },
    { text: "Assertions are made verbally and evidence is shown on slides", isCorrect: false },
    { text: "Slides contain only visual evidence with no text", isCorrect: false },
  ])

  // ── Course 19: Strategic Frameworks ─────────────────────────────────────────
  const c19 = await upsertCourse(
    "Strategic Frameworks",
    "The essential analytical tools for assessing competitive position and shaping business strategy."
  )
  await upsertContent(c19.id, 1, "SWOT, PESTLE, and Porter's Five Forces", "TEXT", `Strategic frameworks are lenses that help organisations understand their environment and make better decisions. No single framework is complete on its own — the skill lies in knowing which to use and how to combine them.

SWOT Analysis:
SWOT maps internal and external factors across four dimensions:
• Strengths — what does the organisation do exceptionally well?
• Weaknesses — where does it underperform or face limitations?
• Opportunities — what external trends or shifts could the organisation exploit?
• Threats — what external forces could harm the business?

SWOT is widely used but often misused. Common mistakes include listing generic points ("Our people are our strength"), failing to prioritise, and not linking the analysis to strategic implications.

PESTLE Analysis:
PESTLE examines the macro-environment across six dimensions:
• Political — government policy, trade agreements, political stability
• Economic — GDP growth, inflation, interest rates, consumer spending
• Social — demographic trends, cultural shifts, workforce changes
• Technological — innovation, digitalisation, automation
• Legal — regulations, employment law, data privacy
• Environmental — climate change, sustainability, resource scarcity

Porter's Five Forces:
Michael Porter's framework analyses the structural attractiveness of an industry through five forces:
1. Threat of new entrants — how easy is it to enter this industry?
2. Bargaining power of suppliers — can suppliers dictate terms?
3. Bargaining power of buyers — can customers force prices down?
4. Threat of substitutes — can customers switch to alternatives?
5. Rivalry among existing competitors — how intense is competition?

The collective strength of these forces determines industry profitability. A strategist uses this analysis to identify where to compete and how to build defensible positions.`)

  await upsertContent(c19.id, 2, "The BCG Matrix and Competitive Positioning", "TEXT", `Portfolio strategy tools help organisations decide where to invest, maintain, harvest, or exit.

The BCG Growth-Share Matrix:
Developed by the Boston Consulting Group, the BCG matrix classifies business units or products across two dimensions: market growth rate and relative market share.

The four quadrants:
• Stars (high growth, high share) — invest heavily; these are tomorrow's cash cows
• Cash Cows (low growth, high share) — harvest cash; minimal reinvestment required
• Question Marks (high growth, low share) — invest selectively or divest; they have potential but consume cash
• Dogs (low growth, low share) — consider divesting unless they serve a strategic purpose

Generic Competitive Strategies (Porter):
Porter identified three generic strategies for achieving competitive advantage:
• Cost Leadership — be the lowest-cost producer in the industry (e.g., budget airlines, discount retailers)
• Differentiation — offer something unique that customers will pay a premium for (e.g., luxury goods, proprietary technology)
• Focus — target a narrow segment and serve it better than broad-market competitors (either cost focus or differentiation focus)

Stuck in the Middle:
Companies that try to be all things to all customers — neither lowest cost nor meaningfully differentiated — tend to be outcompeted by more focused rivals. Strategic clarity requires making choices about what you will not do.`)

  const t19 = await upsertTest(c19.id, 75)
  const q19_1 = await upsertQuestion(t19.id, 1, "MATCHING", "Match each BCG Matrix quadrant to its description.")
  await seedOptions(q19_1.id, [
    { text: "Stars", matchKey: "High growth, high market share — tomorrow's cash cows" },
    { text: "Cash Cows", matchKey: "Low growth, high market share — generate steady cash" },
    { text: "Question Marks", matchKey: "High growth, low market share — uncertain potential" },
    { text: "Dogs", matchKey: "Low growth, low market share — consider divesting" },
  ])
  const q19_2 = await upsertQuestion(t19.id, 2, "MULTIPLE_CHOICE", "Which of Porter's Five Forces asks how easily new competitors can enter an industry?")
  await seedOptions(q19_2.id, [
    { text: "Bargaining power of suppliers", isCorrect: false },
    { text: "Threat of substitutes", isCorrect: false },
    { text: "Threat of new entrants", isCorrect: true },
    { text: "Rivalry among existing competitors", isCorrect: false },
  ])
  const q19_3 = await upsertQuestion(t19.id, 3, "TRUE_FALSE", "According to Porter, a company that tries to pursue both cost leadership and differentiation simultaneously is likely to outperform focused competitors.")
  await seedOptions(q19_3.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])

  // ── Course 20: Execution and OKRs ────────────────────────────────────────────
  const c20 = await upsertCourse(
    "Execution and OKRs",
    "Translating strategy into action using Objectives and Key Results and disciplined execution practices."
  )
  await upsertContent(c20.id, 1, "OKRs — Objectives and Key Results", "TEXT", `Strategy without execution is daydreaming. OKRs are a goal-setting framework, originally developed at Intel and popularised by Google, that connects ambitious goals to measurable outcomes.

How OKRs Work:
• Objective — a qualitative, inspirational statement of what you want to achieve. It should be ambitious enough to be motivating but clear enough to provide direction. Example: "Become the most trusted partner for mid-market clients in Southeast Asia."
• Key Results — 3–5 quantitative, measurable milestones that indicate progress toward the Objective. Example: "Achieve NPS of 70+", "Expand to 3 new markets", "Reduce client onboarding time to < 5 days."

OKR Properties:
• Aspirational — OKRs should stretch the team. An OKR consistently scored 1.0 (100%) was probably not ambitious enough.
• Measurable — if you cannot measure it, it is not a Key Result
• Time-bound — OKRs typically run on quarterly cycles
• Transparent — OKRs are shared publicly within the organisation, creating alignment and accountability
• Not linked to compensation — OKRs are about learning and improvement, not performance ratings

Common OKR Mistakes:
• Treating OKRs as a to-do list (Key Results should be outcomes, not activities)
• Having too many OKRs (3–5 Objectives with 3–5 KRs each is the maximum)
• Setting OKRs top-down without team input
• Forgetting to review and update OKRs mid-cycle`)

  await upsertContent(c20.id, 2, "Execution Disciplines and Common Pitfalls", "TEXT", `Most strategic plans fail not because the strategy was wrong, but because execution was poor. Research by Harvard Business Review found that two-thirds of executives rated strategy execution as their top challenge.

The 4 Disciplines of Execution (4DX):
1. Focus on the Wildly Important — do not try to do everything. Identify the 1–2 goals that will make the biggest difference and concentrate effort there.
2. Act on Lead Measures — leading indicators predict future results and can be influenced now (e.g., number of client meetings per week). Lagging indicators tell you what happened (e.g., revenue). Track lead measures daily.
3. Keep a Compelling Scoreboard — a visible, simple scoreboard that shows the team whether they are winning or losing. Engagement rises when people know the score.
4. Create a Cadence of Accountability — hold brief weekly team meetings where each member commits to specific actions and reports on last week's commitments.

Common Execution Pitfalls:
• Too many priorities — when everything is a priority, nothing is
• Lack of accountability — goals with no owner are wishes
• Poor communication — teams execute on what they understand, not what was intended
• Failure to learn — projects end without a structured review, so the same mistakes recur
• Micromanagement — overchecking reduces ownership and slows progress

Building an Execution Culture:
Execution is not a process — it is a culture. It is built through consistent follow-through, visible accountability, and leaders who model the discipline they expect from their teams.`)

  const t20 = await upsertTest(c20.id, 75)
  const q20_1 = await upsertQuestion(t20.id, 1, "MULTIPLE_CHOICE", "In the OKR framework, what should a Key Result always be?")
  await seedOptions(q20_1.id, [
    { text: "A list of activities the team plans to complete", isCorrect: false },
    { text: "A qualitative description of the desired outcome", isCorrect: false },
    { text: "A quantitative, measurable milestone indicating progress", isCorrect: true },
    { text: "A budget allocation for the objective", isCorrect: false },
  ])
  const q20_2 = await upsertQuestion(t20.id, 2, "TRUE_FALSE", "Achieving a score of 1.0 (100%) on all OKRs every quarter is the primary goal of the OKR framework.")
  await seedOptions(q20_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q20_3 = await upsertQuestion(t20.id, 3, "MULTIPLE_CHOICE", "According to the 4 Disciplines of Execution, what is a 'lead measure'?")
  await seedOptions(q20_3.id, [
    { text: "A financial metric that measures past results", isCorrect: false },
    { text: "An indicator you can influence now that predicts future results", isCorrect: true },
    { text: "The primary OKR that the whole company focuses on", isCorrect: false },
    { text: "A weekly report submitted to senior leadership", isCorrect: false },
  ])

  // ── Course 21: Understanding Organizational Change ───────────────────────────
  const c21 = await upsertCourse(
    "Understanding Organizational Change",
    "The psychology of change and proven frameworks for leading organisations through transformation."
  )
  await upsertContent(c21.id, 1, "Why Change is Hard and How to Lead It", "TEXT", `Change is the only constant in business, yet organisations consistently struggle to implement it effectively. Research shows that roughly 70% of transformation initiatives fail to achieve their intended results — not because the strategy was wrong, but because the human side of change was not managed.

Why People Resist Change:
• Loss aversion — people feel losses more acutely than equivalent gains. Change threatens what people have now.
• Uncertainty — the unknown is inherently uncomfortable. Ambiguity about what change means for individuals creates anxiety.
• Loss of control — change imposed from above strips people of agency, triggering resentment.
• Competence concerns — "Will I still be good at my job in the new way of working?"
• Social disruption — change can break up established teams and relationships.

Kotter's 8-Step Change Model:
1. Create a sense of urgency — help people see why change is necessary
2. Build a guiding coalition — assemble a team with the authority and credibility to lead change
3. Form a strategic vision — develop a clear, compelling picture of the future state
4. Enlist a volunteer army — communicate the vision widely and recruit champions
5. Enable action by removing barriers — identify and eliminate obstacles (structural, cultural, systemic)
6. Generate short-term wins — plan for and celebrate early victories to build momentum
7. Sustain acceleration — use early wins to push for deeper change
8. Institute change — anchor new behaviours in culture, processes, and systems`)

  await upsertContent(c21.id, 2, "The ADKAR Change Model", "TEXT", `While Kotter's model focuses on organisational change, ADKAR focuses on individual change. Since organisations change one person at a time, ADKAR provides a practical tool for understanding and addressing resistance at the individual level.

The ADKAR Model:
Developed by Prosci, ADKAR describes the five milestones an individual must reach for change to stick:

A — Awareness
Does the person understand why the change is happening? Without awareness of the need for change, people do not see the point. Communication that answers "Why are we changing?" addresses this barrier.

D — Desire
Does the person want to participate in the change? Awareness alone is not enough — people must choose to support it. Desire is influenced by personal motivation, trust in leadership, and the perceived benefits versus costs.

K — Knowledge
Does the person know how to change? Training and education address this gap. Knowledge tells people what the new behaviours, skills, or processes look like.

A — Ability
Can the person actually perform the new behaviour? Knowledge and ability are distinct. Practice, coaching, and feedback are the tools for building ability.

R — Reinforcement
Are the new behaviours being reinforced and sustained? Recognition, consequences for reverting, and embedded processes determine whether change sticks.

Diagnosing Change Resistance:
When someone resists change, identify where they are in the ADKAR model and address that specific gap. Providing training (K) to someone who lacks desire (D) wastes everyone's time.`)

  const t21 = await upsertTest(c21.id, 70)
  const q21_1 = await upsertQuestion(t21.id, 1, "MULTIPLE_CHOICE", "According to research, what is the most common reason large-scale change initiatives fail?")
  await seedOptions(q21_1.id, [
    { text: "The change strategy was poorly designed", isCorrect: false },
    { text: "The budget allocated was insufficient", isCorrect: false },
    { text: "The human side of change was not adequately managed", isCorrect: true },
    { text: "The technology required was not available", isCorrect: false },
  ])
  const q21_2 = await upsertQuestion(t21.id, 2, "MATCHING", "Match each ADKAR element to what it addresses.")
  await seedOptions(q21_2.id, [
    { text: "Awareness", matchKey: "Understanding why the change is happening" },
    { text: "Desire", matchKey: "Wanting to participate and support the change" },
    { text: "Knowledge", matchKey: "Knowing how to change" },
    { text: "Ability", matchKey: "Being able to perform the new behaviour" },
    { text: "Reinforcement", matchKey: "Sustaining and cementing the new behaviour" },
  ])
  const q21_3 = await upsertQuestion(t21.id, 3, "TRUE_FALSE", "If an employee knows how to perform a new process (Knowledge), they will automatically be able to do it (Ability).")
  await seedOptions(q21_3.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])

  // ── Course 22: Managing Resistance and Building Buy-In ───────────────────────
  const c22 = await upsertCourse(
    "Managing Resistance and Building Buy-In",
    "Practical strategies for overcoming change resistance and creating genuine stakeholder commitment."
  )
  await upsertContent(c22.id, 1, "Identifying and Addressing Resistance", "TEXT", `Resistance is not the enemy of change — it is information. People resist for reasons, and understanding those reasons is the first step to addressing them effectively.

Forms of Resistance:
• Active resistance — open opposition, vocal objection, refusal to comply
• Passive resistance — compliance on the surface with no genuine commitment (slow walking, avoidance)
• Indirect resistance — spreading negativity, undermining the initiative in private conversations

Diagnosing Resistance:
Before responding, diagnose. Ask:
• Is this a knowledge gap? (They do not understand the change)
• Is this a skills gap? (They do not know how to do it)
• Is this a values conflict? (They disagree with the change direction)
• Is this a trust issue? (They do not believe the stated reasons for change)
• Is this fear of personal consequences? (They are worried about their job, role, or status)

Different root causes require different responses. Responding with more communication when the real issue is a skills gap, for example, will not help.

Strategies for Addressing Resistance:
• Involve resistors early — people support what they help create. Invite sceptics to be part of the problem-solving process.
• Acknowledge losses — validate what people are giving up. Dismissing concerns accelerates resistance.
• Demonstrate quick wins — early evidence that the change is working erodes doubt
• One-to-one conversations — group sessions rarely shift deep resistance; individual conversations do`)

  await upsertContent(c22.id, 2, "Building a Change Communication Plan", "TEXT", `Communication is the engine of change management. Most change initiatives are under-communicated — research suggests that leaders need to communicate a change message seven times before it is fully absorbed.

Principles of Change Communication:
• Honest and transparent — people can handle difficult truths; they cannot handle being misled
• Timely — communicate before rumours fill the vacuum
• Consistent — mixed messages from different leaders are more damaging than no message at all
• Two-way — communication is not just broadcast; create channels for questions and feedback
• Tailored — different stakeholders need different messages (the CEO's message differs from the team leader's)

The Change Communication Plan:
Map out:
• Audience — who needs to hear this?
• Message — what do they need to know?
• Channel — email, town hall, team meeting, one-to-one?
• Timing — when and how frequently?
• Sender — who has the credibility to deliver this message to this audience?

Communicating the "WIIFM":
Every person experiencing change is silently asking "What's in it for me?" (WIIFM). Change communication that speaks only to organisational benefits and not individual impact will fail to inspire genuine commitment. Be explicit about how the change affects each stakeholder group — and address concerns directly rather than hoping they will not come up.`)

  const t22 = await upsertTest(c22.id, 70)
  const q22_1 = await upsertQuestion(t22.id, 1, "MULTIPLE_CHOICE", "What does 'passive resistance' to change look like?")
  await seedOptions(q22_1.id, [
    { text: "Openly refusing to implement new processes", isCorrect: false },
    { text: "Surface-level compliance with no genuine commitment", isCorrect: true },
    { text: "Publicly criticising the change initiative", isCorrect: false },
    { text: "Submitting a formal objection to leadership", isCorrect: false },
  ])
  const q22_2 = await upsertQuestion(t22.id, 2, "TRUE_FALSE", "Communicating a change message once at the launch of an initiative is generally sufficient for employees to fully absorb it.")
  await seedOptions(q22_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q22_3 = await upsertQuestion(t22.id, 3, "FILL_BLANK", "The acronym ____ stands for the silent question every employee asks during change: 'What's in it for me?'")
  await seedOptions(q22_3.id, [{ text: "WIIFM", isCorrect: true }])

  // ── Course 23: Business Development Fundamentals ─────────────────────────────
  const c23 = await upsertCourse(
    "Business Development Fundamentals",
    "Building a pipeline, crafting compelling pitches, and winning new business."
  )
  await upsertContent(c23.id, 1, "The Business Development Pipeline", "TEXT", `Business development (BD) is the process of identifying, cultivating, and converting opportunities into revenue. Unlike sales of standardised products, BD in professional services involves long relationship cycles, complex buying decisions, and high-value, low-volume deals.

The BD Pipeline:
A pipeline is a visual representation of opportunities at different stages of development. A healthy pipeline has:
• A wide top — many prospective contacts and leads
• Continuous movement — opportunities progressing through stages
• Accurate probability weighting — realistic assessment of close likelihood

Pipeline Stages (typical for professional services):
1. Prospect — a potential client who fits your target profile but has not yet been approached
2. Contact made — initial outreach has occurred
3. Meeting scheduled — they are willing to discuss their situation
4. Needs identified — you understand their problem and have a potential fit
5. Proposal submitted — a formal proposal or pitch has been sent
6. Negotiation — terms are being discussed
7. Closed — won or lost

Prospecting Strategies:
• Warm introductions — the highest conversion rate; a trusted mutual contact opens the door
• Content and thought leadership — publishing insights positions you as an expert and attracts inbound interest
• Industry events and conferences — face-to-face opportunities to build relationships
• LinkedIn outreach — personalised, research-based messages (not generic templates)
• Alumni and former colleague networks — relationships with shared history convert faster`)

  await upsertContent(c23.id, 2, "Crafting a Compelling Value Proposition", "TEXT", `A value proposition is not a description of what you do — it is a clear statement of what problem you solve, for whom, and why you are the best choice.

The Three Questions a Value Proposition Must Answer:
1. What do we do?
2. For whom?
3. Why us, not someone else?

The Value Proposition Canvas:
• Customer Jobs — what tasks, problems, or needs does the customer have?
• Customer Pains — what frustrates them, what risks do they face, what obstacles slow them down?
• Customer Gains — what outcomes and benefits do they desire?
• Pain Relievers — how does your offering specifically relieve the customer's pains?
• Gain Creators — how does your offering create the outcomes the customer wants?
• Products/Services — what are you actually delivering?

Fit is achieved when your offering's Pain Relievers and Gain Creators directly address the Customer Pains and Gains.

Pitching Principles:
• Lead with the client's problem, not your credentials — "Many of our clients in your industry face X" not "We were founded in 2010 and have 500 employees"
• Quantify the value — "We typically help clients reduce processing time by 30%" is more compelling than "We improve efficiency"
• Tell stories — a concrete case study lands harder than abstract claims
• Anticipate objections — address the top 3 objections before they are raised
• End with a clear next step — always leave every conversation with an agreed action`)

  const t23 = await upsertTest(c23.id, 70)
  const q23_1 = await upsertQuestion(t23.id, 1, "MULTIPLE_CHOICE", "What does a 'healthy' BD pipeline have?")
  await seedOptions(q23_1.id, [
    { text: "A few large, high-confidence opportunities only", isCorrect: false },
    { text: "A wide top with many prospects and continuous movement through stages", isCorrect: true },
    { text: "Opportunities clustered at the proposal stage", isCorrect: false },
    { text: "A narrow focus on a single target client", isCorrect: false },
  ])
  const q23_2 = await upsertQuestion(t23.id, 2, "TRUE_FALSE", "A strong value proposition should primarily describe your company's history and credentials.")
  await seedOptions(q23_2.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q23_3 = await upsertQuestion(t23.id, 3, "MULTIPLE_CHOICE", "Which prospecting method typically has the highest conversion rate?")
  await seedOptions(q23_3.id, [
    { text: "Cold email outreach with generic templates", isCorrect: false },
    { text: "Warm introductions from trusted mutual contacts", isCorrect: true },
    { text: "Mass LinkedIn connection requests", isCorrect: false },
    { text: "Attending industry conferences without a clear outreach plan", isCorrect: false },
  ])

  // ── Course 24: Client Relationship Management ────────────────────────────────
  const c24 = await upsertCourse(
    "Client Relationship Management",
    "Building, deepening, and retaining high-value client relationships over time."
  )
  await upsertContent(c24.id, 1, "Account Management and Client Retention", "TEXT", `Winning a client is hard. Keeping them is an ongoing discipline. Research consistently shows that acquiring a new client costs 5–7 times more than retaining an existing one, and that a 5% increase in retention can increase profits by 25–95%.

The Account Management Mindset:
• Think long-term — your goal is not to deliver a project; it is to be a trusted partner for years
• Understand the full picture — great account managers understand the client's business strategy, challenges, and internal politics, not just the immediate engagement
• Proactive, not reactive — do not wait for the client to come to you with problems; be regularly in contact with insights, updates, and new ideas

Client Health Signals:
Regularly assess the health of each client relationship across:
• Satisfaction — are they happy with the current work?
• Engagement — do they involve you early in decisions, or only when problems arise?
• Breadth — how many contacts do you have within the organisation? (One relationship is fragile)
• Growth — are the engagements growing or shrinking over time?
• NPS / feedback — do they refer you to others?

Preventing Churn:
• The best time to address client dissatisfaction is before it becomes a complaint
• Regular check-in calls ("How are things going? Is there anything we could do better?") surface issues early
• Conduct formal mid-project reviews for long engagements
• After a project closes, a structured retrospective ("What went well? What would you do differently?") shows commitment to improvement`)

  await upsertContent(c24.id, 2, "Growing Accounts and Managing Difficult Conversations", "TEXT", `Client growth — expanding the scope and value of existing relationships — is the most capital-efficient form of business development. Existing clients already trust you, making it far easier to win new work.

Identifying Growth Opportunities:
• Understand adjacencies — what other problems does this client have that you could address?
• Map the organisation — are there other divisions, geographies, or functions that could benefit from your work?
• Follow the strategy — clients often share their strategic priorities. Listen for where your capabilities could contribute.
• Create opportunities — do not wait to be asked. Proactively share relevant insights, research, or case studies from similar clients.

The Art of the Cross-Sell:
Never introduce new service lines as a "pitch" — always frame them as solutions to problems you have observed or heard the client mention. The transition from service provider to trusted advisor happens when the client feels you understand their world, not just your own.

Handling Difficult Client Conversations:
Despite best efforts, difficult situations arise — missed deadlines, quality issues, budget overruns.
• Address issues proactively — do not wait for the client to raise it first
• Come with a plan — "Here is the problem" without "Here is what we are doing about it" is unhelpful
• Acknowledge impact — validate the client's frustration before defending your team
• Over-deliver on recovery — a problem well-handled can strengthen the relationship more than a flawless delivery`)

  const t24 = await upsertTest(c24.id, 70)
  const q24_1 = await upsertQuestion(t24.id, 1, "TRUE_FALSE", "Acquiring a new client is generally cheaper than retaining an existing one.")
  await seedOptions(q24_1.id, [
    { text: "True", isCorrect: false },
    { text: "False", isCorrect: true },
  ])
  const q24_2 = await upsertQuestion(t24.id, 2, "MULTIPLE_CHOICE", "When a service issue arises with a client, what should you bring to the conversation?")
  await seedOptions(q24_2.id, [
    { text: "A detailed explanation of why the problem occurred", isCorrect: false },
    { text: "An acknowledgement of the problem plus a clear plan to address it", isCorrect: true },
    { text: "A revised invoice reflecting a discount", isCorrect: false },
    { text: "A request for more time before discussing the issue", isCorrect: false },
  ])
  const q24_3 = await upsertQuestion(t24.id, 3, "MULTIPLE_CHOICE", "What is the most effective way to introduce additional services to an existing client?")
  await seedOptions(q24_3.id, [
    { text: "Send a formal capabilities deck outlining all your service lines", isCorrect: false },
    { text: "Raise it during the contract renewal negotiation", isCorrect: false },
    { text: "Frame new services as solutions to problems or priorities you have observed in their business", isCorrect: true },
    { text: "Wait for the client to ask about other services you offer", isCorrect: false },
  ])

  // ══════════════════════════════════════════════════════════════════════════════
  // LINK COURSES TO PATHWAYS
  // ══════════════════════════════════════════════════════════════════════════════

  const p4 = await upsertPathway(
    "Project Management Fundamentals",
    "A practical introduction to managing projects from initiation to delivery. Covers scope, scheduling, risk, and stakeholder management.",
    false
  )
  await linkCourseToPathway(p4.id, c8.id, 1, 15)
  await linkCourseToPathway(p4.id, c9.id, 2, 15)

  const p5 = await upsertPathway(
    "Mergers and Acquisitions",
    "A comprehensive guide to the M&A process — from deal strategy and due diligence to valuation and synergy analysis. Requires approval to enrol.",
    true
  )
  await linkCourseToPathway(p5.id, c10.id, 1, 25)
  await linkCourseToPathway(p5.id, c11.id, 2, 25)

  const p6 = await upsertPathway(
    "Market Research and Consumer Insights",
    "Learn how to design research studies, avoid common biases, and translate raw data into compelling business insights.",
    false
  )
  await linkCourseToPathway(p6.id, c12.id, 1, 15)
  await linkCourseToPathway(p6.id, c13.id, 2, 15)

  const p7 = await upsertPathway(
    "Lean Six Sigma Fundamentals",
    "Master the principles of Lean thinking and the DMAIC problem-solving framework to eliminate waste and reduce variation in any process.",
    false
  )
  await linkCourseToPathway(p7.id, c14.id, 1, 20)
  await linkCourseToPathway(p7.id, c15.id, 2, 20)

  const p8 = await upsertPathway(
    "Remote Work Excellence",
    "Build the productivity routines, communication habits, and collaboration skills needed to thrive in a remote or hybrid work environment.",
    false
  )
  await linkCourseToPathway(p8.id, c16.id, 1, 10)

  const p9 = await upsertPathway(
    "Professional Communication",
    "Master business writing and presentation skills to communicate with clarity, confidence, and impact in any professional setting.",
    false
  )
  await linkCourseToPathway(p9.id, c17.id, 1, 10)
  await linkCourseToPathway(p9.id, c18.id, 2, 10)

  const p10 = await upsertPathway(
    "Strategic Planning and Execution",
    "From SWOT and Porter's Five Forces to OKRs and execution disciplines — a complete toolkit for setting direction and delivering results. Requires approval to enrol.",
    true
  )
  await linkCourseToPathway(p10.id, c19.id, 1, 20)
  await linkCourseToPathway(p10.id, c20.id, 2, 20)

  const p11 = await upsertPathway(
    "Change Management",
    "Understand the psychology of change and learn practical frameworks — Kotter's 8 Steps, ADKAR, and communication planning — to lead organisations through transformation.",
    false
  )
  await linkCourseToPathway(p11.id, c21.id, 1, 15)
  await linkCourseToPathway(p11.id, c22.id, 2, 15)

  const p12 = await upsertPathway(
    "Business Development and Client Management",
    "Build and manage a BD pipeline, craft compelling value propositions, and develop the client relationship skills that drive long-term growth.",
    false
  )
  await linkCourseToPathway(p12.id, c23.id, 1, 15)
  await linkCourseToPathway(p12.id, c24.id, 2, 15)

  const p13 = await upsertPathway(
    "Virtual Collaboration and Team Dynamics",
    "Develop the skills to lead and contribute effectively in remote and distributed teams, from async communication to virtual meeting best practices.",
    false
  )
  await linkCourseToPathway(p13.id, c16.id, 1, 10)
  await linkCourseToPathway(p13.id, c17.id, 2, 10)

  console.log("✅  Pathways:")
  console.log(`   • ${p1.name} (3 courses)`)
  console.log(`   • ${p2.name} (2 courses)`)
  console.log(`   • ${p3.name} (2 courses)`)
  console.log(`   • ${p4.name} (2 courses)`)
  console.log(`   • ${p5.name} (2 courses)`)
  console.log(`   • ${p6.name} (2 courses)`)
  console.log(`   • ${p7.name} (2 courses)`)
  console.log(`   • ${p8.name} (1 course)`)
  console.log(`   • ${p9.name} (2 courses)`)
  console.log(`   • ${p10.name} (2 courses)`)
  console.log(`   • ${p11.name} (2 courses)`)
  console.log(`   • ${p12.name} (2 courses)`)
  console.log(`   • ${p13.name} (2 courses)`)
  console.log("\n✅  Courses: 24 courses with contents and tests seeded.")
  console.log("\nDone! 🎉")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
