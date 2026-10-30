// Release notes shown on the Help page, newest day first. Add an entry (or extend
// today's) with every user-visible change, written for non-technical readers.

export type ChangeKind = "new" | "improved" | "fixed"

export type ReleaseDay = {
  date: string // YYYY-MM-DD
  changes: { kind: ChangeKind; text: string }[]
}

export const RELEASE_NOTES: ReleaseDay[] = [
  {
    date: "2026-10-30",
    changes: [
      { kind: "new", text: "Analytics now has Users, Pathways and Courses tabs. See how many people are in each pathway and course, how far along they are (from not started to completed), who is overdue, test scores, ratings and assignments to grade. Click any pathway or course for more detail." },
      { kind: "new", text: "Managers see the same analytics for their team. Trainers and Subject Matter Experts get a new Analytics page for their own courses and topics." },
      { kind: "improved", text: "The analytics filters now include every division and job title." },
      { kind: "new", text: "The Users list can now be filtered by office." },
      { kind: "improved", text: "Featured pathways now stay in Recommended for You even after you enroll, so everyone sees the same featured pathways." },
      { kind: "improved", text: "In a course's content list, long web addresses are replaced by a small Open link button." },
      { kind: "fixed", text: "Duplicating a pathway or course no longer fails when an earlier copy was deleted. You can also reuse the name of a deleted pathway or course." },
      { kind: "fixed", text: "Wide tables in the admin, manager, trainer and SME pages now scroll sideways instead of cutting off columns." },
    ],
  },
  {
    date: "2026-10-29",
    changes: [
      { kind: "new", text: "Courses can now include pictures. Course editors pick \"Image\" as the content type and upload a picture straight from their computer." },
      { kind: "new", text: "External Link content can have an optional picture. Learners can click the picture to open the link." },
      { kind: "improved", text: "Uploaded pictures are shrunk automatically before upload, so they load quickly on laptops and phones without looking blurry." },
      { kind: "improved", text: "When a picture is replaced or its content is deleted, the old picture file is cleaned up." },
      { kind: "improved", text: "The \"Recommended for You\" section on the Pathways page now shows only pathways the Learning team has featured. If nothing is featured for you, the section is hidden." },
      { kind: "improved", text: "Only admins can duplicate or delete a pathway. Pathway owners can still do everything else on the pathways they own." },
      { kind: "fixed", text: "The Add/Edit Pathway form no longer runs off the bottom of the screen. It now uses two columns, and the Save button always stays visible." },
      { kind: "improved", text: "This Help page has been refreshed, and these Release Notes are new." },
    ],
  },
  {
    date: "2026-10-28",
    changes: [
      { kind: "new", text: "Admins can open a User Progress Report for anyone. It shows their completed pathways and courses, whether assigned pathways were finished on time, streaks, points, and an \"Attention needed\" list. You can download it as an Excel file." },
      { kind: "new", text: "Pathway owners: admins can make anyone the owner of a pathway. Owners get an Admin › Pathways menu where they can manage the courses and enrollments of their own pathways." },
      { kind: "improved", text: "The Manager, Trainer, Subject Matter Expert and Pathway Owner menus now appear automatically, based on what you're assigned to. Having direct reports makes you a Manager, training a course makes you a Trainer, and so on. Admin is the only role that is given by hand." },
      { kind: "new", text: "Admins can feature up to 2 pathways, which appear at the top of the Pathways page." },
      { kind: "new", text: "Every pathway has a preview page that shows its courses, trainers and first lesson before you enroll." },
      { kind: "new", text: "You can share a pathway with a colleague. They get a notification and an email with a link to it." },
      { kind: "new", text: "Previous Lesson and Next Lesson buttons let you move through a course without going back to the list." },
      { kind: "new", text: "On phones, a Contents button opens the course outline." },
      { kind: "improved", text: "The leaderboard's top 3 now get gold, silver and bronze medals." },
      { kind: "improved", text: "Removing a user now deactivates them instead of erasing them, so their learning history is kept. Adding the same email again brings them back." },
      { kind: "improved", text: "People who leave the company are now deactivated in Ascend automatically." },
      { kind: "improved", text: "On phones, the main menu now opens on top of the page and scrolls, so you no longer have to scroll back up to find it. The menu also starts closed, and dashboard cards fit the screen." },
      { kind: "fixed", text: "Actions that send emails (such as enrolling people) no longer hang when the mail server is slow." },
      { kind: "improved", text: "Admin pages are now better protected, so people can only make changes their role allows." },
    ],
  },
  {
    date: "2026-10-21",
    changes: [
      { kind: "new", text: "Completed pathways in Learning History now have a View Certificate link." },
      { kind: "fixed", text: "The Actions buttons on the pathway enrollments page are no longer cut off. The tables scroll sideways on smaller screens." },
    ],
  },
  {
    date: "2026-10-20",
    changes: [
      { kind: "new", text: "Added the TCD and NA divisions." },
      { kind: "improved", text: "Each person's division and job title are now kept up to date from their Microsoft account." },
    ],
  },
  {
    date: "2026-10-12",
    changes: [
      { kind: "new", text: "A menu button now hides or shows the left menu to give you more room. Ascend remembers your choice." },
    ],
  },
  {
    date: "2026-10-01",
    changes: [
      { kind: "new", text: "Learners can upload their assignment file directly (up to 20 MB) or paste a link as before. Files are deleted after 6 months, but grades are kept." },
      { kind: "new", text: "Admins can set a deadline when enrolling people or a cohort in a pathway. Learners get a reminder email the day before and on the day. One week after the deadline, the pathway can still be viewed but no longer completed." },
      { kind: "improved", text: "In a course report, each learner's name now opens their progress, and you can expand a row to see their lesson, test and assignment status." },
      { kind: "improved", text: "Downloads and exports are now restricted to admins." },
    ],
  },
  {
    date: "2026-09-23",
    changes: [
      { kind: "improved", text: "Course names in a pathway's course list now link straight to that course's edit page." },
    ],
  },
  {
    date: "2026-09-16",
    changes: [
      { kind: "fixed", text: "Emails now go through the company mail server, so reminder emails are no longer held back by a daily sending limit." },
    ],
  },
  {
    date: "2026-09-15",
    changes: [
      { kind: "improved", text: "The learning reminder email now goes out once a week, on Wednesdays, instead of twice a week." },
    ],
  },
  {
    date: "2026-09-11",
    changes: [
      { kind: "new", text: "Admins can schedule reminder emails for a person or a whole cohort in a pathway, with an optional personal message. A reminder is only sent if the pathway isn't finished yet." },
    ],
  },
  {
    date: "2026-09-10",
    changes: [
      { kind: "new", text: "Learners with unfinished pathways get a friendly reminder email. Its Start Learning button takes you straight to your next course." },
      { kind: "new", text: "You can turn reminder emails off under Settings." },
    ],
  },
  {
    date: "2026-09-08",
    changes: [
      { kind: "improved", text: "Long course and lesson names in the course outline now wrap onto two lines instead of being cut off." },
      { kind: "improved", text: "Link content no longer shows the long web address under its title. The Open Link button is enough." },
    ],
  },
  {
    date: "2026-08-31",
    changes: [
      { kind: "new", text: "New colleagues with a Microsoft account are added to Ascend automatically, so they can sign in without waiting for an admin." },
      { kind: "fixed", text: "Adding a user with an email that already exists now shows a clear message instead of an error page." },
    ],
  },
  {
    date: "2026-08-26",
    changes: [
      { kind: "new", text: "Pathways now have three visibility options: Public and free to enroll, Public but needing manager approval, or Hidden, which means people can only be assigned to it." },
    ],
  },
  {
    date: "2026-08-21",
    changes: [
      { kind: "new", text: "SharePoint videos, PDFs and slides now have a small \"Content not loading?\" link. It explains how to sign in to Microsoft and which Edge or Safari setting can block the content." },
      { kind: "fixed", text: "The Actions menu on admin lists now opens in the right place in Safari." },
    ],
  },
  {
    date: "2026-08-18",
    changes: [
      { kind: "improved", text: "SharePoint videos now have an \"Open in new tab\" link for when the video won't play inside Ascend." },
    ],
  },
  {
    date: "2026-08-13",
    changes: [
      { kind: "improved", text: "The Home page now shows only the pathways you're still working on. Completed pathways are under My Pathways, where a Review button lets you look back at them." },
    ],
  },
  {
    date: "2026-08-11",
    changes: [
      { kind: "improved", text: "The instructions for adding SharePoint PDFs and slides to a course are clearer. You need to open the file in a web browser, not the desktop app." },
    ],
  },
  {
    date: "2026-08-10",
    changes: [
      { kind: "new", text: "Trainers and Subject Matter Experts can preview their courses exactly as learners see them." },
      { kind: "new", text: "Learners now get an email, not just a notification, when they are assigned a pathway, whether directly or through a cohort." },
      { kind: "new", text: "Admins can export a course to a file and import it into another Ascend server." },
      { kind: "improved", text: "A test can be moved to a different spot in the course from its Edit Test window." },
      { kind: "fixed", text: "Text typed into boxes was nearly invisible for some people using dark mode or Microsoft Edge. It's now clearly visible." },
    ],
  },
  {
    date: "2026-08-07",
    changes: [
      { kind: "new", text: "A course can now have several tests, and each can be placed anywhere among the lessons instead of only at the end." },
      { kind: "fixed", text: "A course now completes correctly if you passed the test before finishing the last lessons." },
    ],
  },
  {
    date: "2026-07-30",
    changes: [
      { kind: "improved", text: "Progress views now show tests and assignments as their own lines, including ones still waiting to be reviewed." },
    ],
  },
  {
    date: "2026-07-21",
    changes: [
      { kind: "new", text: "YouTube videos are now their own content type. They can include pop quizzes, which pause the video at a set moment until the learner answers correctly." },
    ],
  },
  {
    date: "2026-07-20",
    changes: [
      { kind: "new", text: "Each course has a Report page with enrollment, completion, test, assignment and feedback results, which you can download as Excel. Each learner row shows their assignment result and feedback." },
    ],
  },
  {
    date: "2026-07-10",
    changes: [
      { kind: "new", text: "Admins can open any user's learning progress from the Users list. Admins and managers can expand each pathway to see every course and lesson, with completion dates." },
    ],
  },
  {
    date: "2026-06-26",
    changes: [
      { kind: "new", text: "Download a cohort's members, or all users, as an Excel file in the same format used for importing." },
      { kind: "improved", text: "Ascend emails now come from noreply@ascend.ycp.com." },
    ],
  },
  {
    date: "2026-06-24",
    changes: [
      { kind: "new", text: "Managers are notified when a team member asks to join a pathway." },
      { kind: "fixed", text: "Deleting a lesson no longer leaves a gap in the course order." },
      { kind: "fixed", text: "Enrollment request notifications now open the right page." },
    ],
  },
  {
    date: "2026-05-20",
    changes: [
      { kind: "new", text: "New content types: PDF, PowerPoint slides and In Person sessions." },
      { kind: "new", text: "Preview mode lets admins see a course or pathway exactly as learners will." },
      { kind: "new", text: "Admins can add section headings to group courses inside a pathway." },
      { kind: "new", text: "Courses and pathways can be duplicated. The copy starts as a draft." },
      { kind: "new", text: "A pathway's enrollment page lets admins enroll individual people or whole cohorts, and remove them." },
      { kind: "new", text: "Cohort members can be uploaded in bulk from an Excel file." },
      { kind: "improved", text: "People who join a cohort are enrolled in that cohort's pathways automatically. People who leave are removed from them." },
      { kind: "improved", text: "Up and down arrows reorder courses in a pathway and lessons in a course." },
      { kind: "improved", text: "Course and pathway pages now show when they were created and last updated." },
      { kind: "improved", text: "Topics now appear above Courses in the Admin menu, and the Go to Pathway button is green." },
    ],
  },
  {
    date: "2026-05-05",
    changes: [
      { kind: "new", text: "A course can now have more than one trainer." },
    ],
  },
  {
    date: "2026-04-06",
    changes: [
      { kind: "new", text: "Users now have a job title." },
      { kind: "improved", text: "Office, trainer and course lists can be searched by typing." },
      { kind: "improved", text: "The user import file can set each person's manager." },
      { kind: "improved", text: "The Users list can be filtered by role." },
    ],
  },
  {
    date: "2026-03-31",
    changes: [
      { kind: "improved", text: "Signing in with Microsoft now lets you choose which account to use." },
    ],
  },
  {
    date: "2026-03-27",
    changes: [
      { kind: "new", text: "Courses can include an assignment for learners to submit and trainers to grade." },
      { kind: "new", text: "Trainers can manage the courses assigned to them." },
      { kind: "new", text: "Learners can rate a course and leave feedback." },
      { kind: "new", text: "My Growth Plan: set personal development goals, and your manager confirms them when you're done." },
      { kind: "new", text: "Topics and Subject Matter Experts, who look after all the courses in their topic." },
      { kind: "new", text: "A person can now have more than one manager." },
    ],
  },
  {
    date: "2026-03-26",
    changes: [
      { kind: "new", text: "People without a company Microsoft account can sign in with an email and password." },
      { kind: "new", text: "Videos must be watched (at least 75%) before they can be marked as completed." },
    ],
  },
  {
    date: "2026-03-23",
    changes: [
      { kind: "new", text: "Learning streaks count how many days in a row you've learned." },
      { kind: "new", text: "Leaderboards for points and streaks." },
      { kind: "new", text: "Notifications keep you up to date on enrollments, grades and more." },
    ],
  },
  {
    date: "2026-03-19",
    changes: [
      { kind: "new", text: "Learners can unenroll from a pathway." },
      { kind: "new", text: "Pathways can have tags, which you can search by." },
      { kind: "new", text: "An Analytics dashboard gives admins an overview of learning across the company." },
      { kind: "improved", text: "Admin lists group each row's actions into a single Actions menu." },
    ],
  },
  {
    date: "2026-03-17",
    changes: [
      { kind: "new", text: "Ascend is live! Browse and enroll in learning pathways, work through courses and tests, earn points, and manage users, pathways and courses as an admin." },
    ],
  },
]
