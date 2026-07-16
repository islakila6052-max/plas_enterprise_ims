/**
 * Realistic seed data for the Internship Management System demo.
 *
 * This dataset simulates a single company ("Greenfield Solutions Inc.")
 * that already has interns, supervisors, attendance, journals, documents,
 * evaluations and announcements. It is used by the in-memory mock backend
 * (see ./mockBackend.js) so the entire UI is populated without a real
 * Supabase project. Shapes mirror the Supabase schema in supabase_schema.sql.
 */

function isoDateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(n, h = 9, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const INTERN_SUPERVISOR = {
  "int-1": "sup-1",
  "int-2": "sup-1",
  "int-3": "sup-2",
  "int-4": "sup-2",
  "int-5": "sup-3",
  "int-6": "sup-3",
  "int-7": "sup-4",
  "int-8": "sup-5",
};

const departments = [
  { id: "dep-1", name: "Information Technology", description: "Software, infrastructure and support." },
  { id: "dep-2", name: "Marketing", description: "Brand, campaigns and communications." },
  { id: "dep-3", name: "Finance", description: "Accounting, payroll and reporting." },
  { id: "dep-4", name: "Human Resources", description: "Recruitment, onboarding and culture." },
  { id: "dep-5", name: "Operations", description: "Logistics and business operations." },
];

const supervisors = [
  { id: "sup-1", profile_id: "user-sup", department_id: "dep-1", full_name: "James Reyes", email: "supervisor@company.com" },
  { id: "sup-2", profile_id: null, department_id: "dep-2", full_name: "Carmen Lopez", email: "carmen.lopez@company.com" },
  { id: "sup-3", profile_id: null, department_id: "dep-3", full_name: "David Tan", email: "david.tan@company.com" },
  { id: "sup-4", profile_id: null, department_id: "dep-4", full_name: "Paula Martinez", email: "paula.martinez@company.com" },
  { id: "sup-5", profile_id: null, department_id: "dep-5", full_name: "Robert Garcia", email: "robert.garcia@company.com" },
];

const interns = [
  {
    id: "int-1", profile_id: "user-int", full_name: "Angela Cruz", student_number: "2021-00341",
    school: "University of the Philippines", course: "BS Computer Science", contact_number: "+63 919 345 6789",
    email: "intern@company.com", emergency_contact: "+63 919 345 6790", department_id: "dep-1",
    supervisor_id: "sup-1", start_date: isoDateDaysAgo(45), end_date: isoDateDaysAgo(-45),
    required_hours: 300, status: "active", avatar_url: null,
  },
  {
    id: "int-2", profile_id: null, full_name: "Benjie Mendoza", student_number: "2021-00412",
    school: "Polytechnic University", course: "BS Information Technology", contact_number: "+63 920 111 2233",
    email: "benjie.mendoza@student.edu.ph", emergency_contact: "+63 920 111 2244", department_id: "dep-1",
    supervisor_id: "sup-1", start_date: isoDateDaysAgo(40), end_date: isoDateDaysAgo(-50),
    required_hours: 300, status: "active", avatar_url: null,
  },
  {
    id: "int-3", profile_id: null, full_name: "Clarisse Ong", student_number: "2020-01998",
    school: "Ateneo de Manila", course: "AB Communication", contact_number: "+63 921 222 3344",
    email: "clarisse.ong@student.edu.ph", emergency_contact: "+63 921 222 3355", department_id: "dep-2",
    supervisor_id: "sup-2", start_date: isoDateDaysAgo(50), end_date: isoDateDaysAgo(-40),
    required_hours: 400, status: "active", avatar_url: null,
  },
  {
    id: "int-4", profile_id: null, full_name: "Daryl Fernando", student_number: "2020-02011",
    school: "De La Salle University", course: "AB Marketing", contact_number: "+63 922 333 4455",
    email: "daryl.fernando@student.edu.ph", emergency_contact: "+63 922 333 4466", department_id: "dep-2",
    supervisor_id: "sup-2", start_date: isoDateDaysAgo(38), end_date: isoDateDaysAgo(-52),
    required_hours: 400, status: "active", avatar_url: null,
  },
  {
    id: "int-5", profile_id: null, full_name: "Erica Salcedo", student_number: "2019-03120",
    school: "University of Santo Tomas", course: "BS Accountancy", contact_number: "+63 923 444 5566",
    email: "erica.salcedo@student.edu.ph", emergency_contact: "+63 923 444 5577", department_id: "dep-3",
    supervisor_id: "sup-3", start_date: isoDateDaysAgo(60), end_date: isoDateDaysAgo(-30),
    required_hours: 350, status: "active", avatar_url: null,
  },
  {
    id: "int-6", profile_id: null, full_name: "Francis Lim", student_number: "2019-03155",
    school: "University of Santo Tomas", course: "BS Accounting", contact_number: "+63 924 555 6677",
    email: "francis.lim@student.edu.ph", emergency_contact: "+63 924 555 6688", department_id: "dep-3",
    supervisor_id: "sup-3", start_date: isoDateDaysAgo(180), end_date: isoDateDaysAgo(-10),
    required_hours: 350, status: "completed", avatar_url: null,
  },
  {
    id: "int-7", profile_id: null, full_name: "Gina Bautista", student_number: "2022-00781",
    school: "Far Eastern University", course: "BS Psychology", contact_number: "+63 925 666 7788",
    email: "gina.bautista@student.edu.ph", emergency_contact: "+63 925 666 7799", department_id: "dep-4",
    supervisor_id: "sup-4", start_date: isoDateDaysAgo(20), end_date: isoDateDaysAgo(-70),
    required_hours: 300, status: "active", avatar_url: null,
  },
  {
    id: "int-8", profile_id: null, full_name: "Hannah Reyes", student_number: "2022-00802",
    school: "Mapua University", course: "BS Industrial Engineering", contact_number: "+63 926 777 8899",
    email: "hannah.reyes@student.edu.ph", emergency_contact: "+63 926 777 8800", department_id: "dep-5",
    supervisor_id: "sup-5", start_date: isoDateDaysAgo(15), end_date: isoDateDaysAgo(-75),
    required_hours: 300, status: "archived", avatar_url: null,
  },
];

// --- Attendance: last 14 days for every active/completed intern -----------
const attendance = [];
let aid = 1;
["int-1", "int-2", "int-3", "int-4", "int-5", "int-6", "int-7"].forEach((iid, idx) => {
  for (let d = 0; d < 14; d++) {
    const roll = (idx + d) % 7;
    let status = "present";
    let time_in = isoDaysAgo(d, 9, 0);
    let time_out = isoDaysAgo(d, 17, 0);
    let total_hours = 8;

    if (roll === 6) {
      status = "absent";
      time_in = null;
      time_out = null;
      total_hours = 0;
    } else if (roll === 5) {
      status = "late";
      time_in = isoDaysAgo(d, 9, 50);
      time_out = isoDaysAgo(d, 17, 30);
      total_hours = 7.67;
    }

    // Demo intern is timed-in (open record) for today so "Time Out" is available.
    if (iid === "int-1" && d === 0) {
      status = "present";
      time_in = isoDaysAgo(0, 9, 5);
      time_out = null;
      total_hours = 0;
    }

    attendance.push({
      id: `att-${aid++}`,
      intern_id: iid,
      date: isoDateDaysAgo(d),
      time_in,
      time_out,
      total_hours,
      method: "manual",
      status,
    });
  }
});

// --- Daily journals --------------------------------------------------------
const journalActivities = [
  "Fixed several UI bugs in the employee portal and paired with my supervisor on code review.",
  "Attended the weekly marketing sync and drafted copy for the new campaign landing page.",
  "Reconciled the petty cash ledger and prepared the monthly expense summary.",
  "Shadowed the recruitment team and helped screen three candidate resumes.",
  "Mapped the warehouse inbound process and proposed a small efficiency improvement.",
  "Built a reusable React component library and documented the usage guidelines.",
];
const journalChallenges = [
  "Struggled to reproduce a flaky test in CI; will add more logging tomorrow.",
  "Tight deadline for the campaign brief, but the team helped reprioritize.",
  "Some legacy data was inconsistent; I cross-checked with the source files.",
  "None significant — a smooth and productive day.",
];
const journalLearnings = [
  "Learned how our design system tokens map to Tailwind utility classes.",
  "Better understood how stakeholder feedback shapes campaign messaging.",
  "Improved my confidence reading financial statements.",
  "Practiced structured interviewing and note-taking.",
];

const daily_journals = [];
let jid = 1;
["int-1", "int-2", "int-3", "int-4", "int-5", "int-6", "int-7"].forEach((iid, idx) => {
  for (let k = 0; k < 6; k++) {
    const d = k * 2;
    const status = k === 1 ? "pending" : k === 4 ? "rejected" : "approved";
    daily_journals.push({
      id: `jr-${jid++}`,
      intern_id: iid,
      supervisor_id: INTERN_SUPERVISOR[iid],
      date: isoDateDaysAgo(d),
      activities: journalActivities[(idx + k) % journalActivities.length],
      hours_worked: 8,
      challenges: journalChallenges[(idx + k) % journalChallenges.length],
      learnings: journalLearnings[(idx + k) % journalLearnings.length],
      status,
      supervisor_comment:
        status === "approved"
          ? "Great work — keep it up."
          : status === "rejected"
            ? "Please add more detail about the challenges you faced."
            : null,
    });
  }
});

// --- Documents -------------------------------------------------------------
const docTypes = ["resume", "moa", "endorsement", "school_requirements", "completion_report"];
const documents = [];
let did = 1;
["int-1", "int-2", "int-3", "int-4", "int-5", "int-6", "int-7", "int-8"].forEach((iid, idx) => {
  const n = 2 + (idx % 2);
  for (let t = 0; t < n; t++) {
    const type = docTypes[t % docTypes.length];
    const status = t === 0 ? "approved" : t === 1 ? "pending" : "approved";
    documents.push({
      id: `doc-${did++}`,
      intern_id: iid,
      type,
      label: type,
      file_path: `${iid}/sample-${t + 1}.pdf`,
      file_url: null,
      file_name: `${type}-${iid}.pdf`,
      status,
      created_at: isoDaysAgo(t * 2, 10, 0),
    });
  }
});

// --- Evaluations -----------------------------------------------------------
const evaluations = [];
let eid = 1;
[
  ["int-1", "sup-1"],
  ["int-3", "sup-2"],
  ["int-5", "sup-3"],
  ["int-6", "sup-3"],
].forEach(([iid, sid]) => {
  evaluations.push({
    id: `ev-${eid++}`,
    intern_id: iid,
    supervisor_id: sid,
    attendance: 5,
    communication: 4,
    teamwork: 5,
    initiative: 4,
    technical_skills: 5,
    professionalism: 5,
    overall_rating: 5,
    comments: "Consistently reliable and eager to learn. A strong contributor to the team.",
    final_recommendation: "highly_recommend",
    status: "completed",
    created_at: isoDaysAgo(3, 14, 0),
  });
});

// --- Announcements ---------------------------------------------------------
const announcements = [
  {
    id: "ann-1", title: "Welcome to the Q3 Internship Cohort",
    body: "A warm welcome to all new interns joining us this quarter! Please complete your onboarding documents by Friday. Your supervisors will reach out with your first-week schedule.",
    category: "company_news", published_by: "user-hr", pinned: true, created_at: isoDaysAgo(2, 9, 0),
  },
  {
    id: "ann-2", title: "Fire Drill — Thursday 2:00 PM",
    body: "A building-wide fire drill is scheduled for Thursday at 2:00 PM. Please proceed to the assembly area near the parking lot and wait for the all-clear from your supervisor.",
    category: "reminder", published_by: "user-hr", pinned: false, created_at: isoDaysAgo(1, 11, 30),
  },
  {
    id: "ann-3", title: "Journal Submission Deadline",
    body: "Daily journals must be submitted by 6:00 PM each working day. Late submissions require supervisor approval. Reach out to HR if you experience any issues.",
    category: "deadline", published_by: "user-hr", pinned: false, created_at: isoDaysAgo(3, 15, 0),
  },
  {
    id: "ann-4", title: "Marketing Campaign Briefing Moved",
    body: "The campaign kickoff briefing has been moved to Conference Room B at 10:00 AM on Monday. Interns under the Marketing department are encouraged to attend.",
    category: "schedule", published_by: "user-hr", pinned: false, created_at: isoDaysAgo(4, 13, 0),
  },
  {
    id: "ann-5", title: "New Coffee Machine in the Break Room",
    body: "We've installed a new espresso machine in the 3rd-floor break room. Enjoy responsibly and please clean up after use!",
    category: "company_news", published_by: "user-hr", pinned: false, created_at: isoDaysAgo(6, 16, 0),
  },
];

const settings = {
  id: 1,
  company_name: "Greenfield Solutions Inc.",
  internship_duration: "6 months",
  required_hours: 300,
  updated_at: isoDaysAgo(10, 10, 0),
};

const profiles = [
  {
    id: "user-hr", full_name: "Maria Santos", email: "hr@company.com", avatar_url: null,
    contact_number: "+63 917 123 4567", bio: "HR Administrator overseeing the company internship program.",
    role: "admin", intern_id: null, supervisor_id: null,
  },
  {
    id: "user-sup", full_name: "James Reyes", email: "supervisor@company.com", avatar_url: null,
    contact_number: "+63 918 234 5678", bio: "IT Department Supervisor and internship mentor.",
    role: "supervisor", intern_id: null, supervisor_id: "sup-1",
  },
  {
    id: "user-int", full_name: "Angela Cruz", email: "intern@company.com", avatar_url: null,
    contact_number: "+63 919 345 6789", bio: "Intern from the University of the Philippines.",
    role: "intern", intern_id: "int-1", supervisor_id: null,
  },
];

export const SAMPLE_DATA = {
  profiles,
  departments,
  supervisors,
  interns,
  attendance,
  daily_journals,
  documents,
  evaluations,
  announcements,
  settings,
};

/** Demo login accounts (password is always "password123" in demo mode). */
export const DEMO_ACCOUNTS = [
  { email: "hr@company.com", password: "password123", role: "admin", label: "HR Administrator" },
  { email: "supervisor@company.com", password: "password123", role: "supervisor", label: "Supervisor" },
  { email: "intern@company.com", password: "password123", role: "intern", label: "Intern" },
];
