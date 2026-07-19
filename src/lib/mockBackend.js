// src/lib/mockBackend.js
/**
 * In-memory mock backend used when Supabase is not configured.
 *
 * It mirrors the shape of the real Supabase schema (see supabase_schema.sql)
 * so the services layer can call it transparently. All mutations are kept in
 * memory for the lifetime of the page session, which is enough for a realistic
 * frontend prototype. When the project is later connected to Supabase, this
 * module is simply never imported (services fall back to `supabase`).
 *
 * Persistence: a snapshot is saved to localStorage so demo data survives a
 * refresh, giving the prototype a "real app" feel.
 */

import { SAMPLE_DATA } from "./sampleData";

const STORAGE_KEY = "ims-demo-db-v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return clone(SAMPLE_DATA);
}

function saveDB(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* ignore quota errors */
  }
}

let db = loadDB();

/** Reset the demo database back to the seed data. */
export function resetDemoDB() {
  db = clone(SAMPLE_DATA);
  saveDB(db);
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// --- helpers to resolve relational labels --------------------------------
function internName(id) {
  return db.interns.find((i) => i.id === id)?.full_name ?? null;
}
function internStudentNo(id) {
  return db.interns.find((i) => i.id === id)?.student_number ?? null;
}
function departmentName(id) {
  return db.departments.find((d) => d.id === id)?.name ?? null;
}
function supervisorName(id) {
  const s = db.supervisors.find((x) => x.id === id);
  return s?.full_name ?? null;
}

function institutionName(id) {
  return db.institutions.find((i) => i.institution_id === id)?.institution_name ?? null;
}

function programName(id) {
  const p = db.programs.find((x) => x.program_id === id);
  return p?.program_name ?? null;
}

const mockBackend = {
  // ----- profiles -----
  async getProfileByEmail(email) {
    return db.profiles.find((p) => p.email === email) ?? null;
  },
  async getProfileById(id) {
    return db.profiles.find((p) => p.id === id) ?? null;
  },
  async updateProfile(id, updates) {
    const p = db.profiles.find((x) => x.id === id);
    if (p) Object.assign(p, updates);
    saveDB(db);
    return p;
  },

  /**
   * Create a new auth user + linked profile row (demo mode equivalent of the
   * serverless /api/admin/create-user route). Returns { id, email } so callers
   * can link the new user to a supervisors / interns record via profile_id.
   */
  async createUser({ email, password, full_name, role }) {
    const id = uid(role === "supervisor" ? "user-sup" : "user-int");
    const profile = {
      id,
      full_name: full_name || email,
      email,
      avatar_url: null,
      contact_number: null,
      bio: null,
      role,
      intern_id: null,
      supervisor_id: null,
    };
    db.profiles.push(profile);
    // Demo accounts are stored so the new user can also log in.
    db.demoAccounts = db.demoAccounts || [];
    db.demoAccounts.push({ email, password, role, label: full_name });
    saveDB(db);
    return { id, email };
  },

  /**
   * Look up a demo login credential (used by authService in demo mode so users
   * created at runtime via createUser can sign in). Returns { email, password, role }
   * or null.
   */
  getDemoAccount(email) {
    const accounts = db.demoAccounts || [];
    return accounts.find((a) => a.email.toLowerCase() === String(email).toLowerCase()) ?? null;
  },

  // ----- departments -----
  async listDepartments() {
    return clone(db.departments);
  },
  async createDepartment(payload) {
    const row = { id: uid("dep"), created_at: new Date().toISOString(), ...payload };
    db.departments.push(row);
    saveDB(db);
    return clone(row);
  },
  async updateDepartment(id, payload) {
    const row = db.departments.find((d) => d.id === id);
    if (row) Object.assign(row, payload);
    saveDB(db);
    return clone(row);
  },
  async removeDepartment(id) {
    db.departments = db.departments.filter((d) => d.id !== id);
    saveDB(db);
  },

  // ----- institutions -----
  async listInstitutions() {
    return clone(db.institutions);
  },
  async getInstitutionById(id) {
    return clone(db.institutions.find((i) => i.institution_id === id) ?? null);
  },
  async createInstitution(payload) {
    const row = {
      institution_id: uid("inst"),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload,
    };
    db.institutions.push(row);
    saveDB(db);
    return clone(row);
  },
  async updateInstitution(id, payload) {
    const row = db.institutions.find((i) => i.institution_id === id);
    if (row) Object.assign(row, payload, { updated_at: new Date().toISOString() });
    saveDB(db);
    return clone(row);
  },
  async removeInstitution(id) {
    db.institutions = db.institutions.filter((i) => i.institution_id !== id);
    // cascade: drop programs of the removed institution
    db.programs = db.programs.filter((p) => p.institution_id !== id);
    saveDB(db);
  },

  // ----- programs -----
  async listPrograms() {
    return clone(db.programs);
  },
  async getProgramById(id) {
    return clone(db.programs.find((p) => p.program_id === id) ?? null);
  },
  async createProgram(payload) {
    const row = {
      program_id: uid("prog"),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload,
    };
    db.programs.push(row);
    saveDB(db);
    return clone(row);
  },
  async updateProgram(id, payload) {
    const row = db.programs.find((p) => p.program_id === id);
    if (row) Object.assign(row, payload, { updated_at: new Date().toISOString() });
    saveDB(db);
    return clone(row);
  },
  async removeProgram(id) {
    db.programs = db.programs.filter((p) => p.program_id !== id);
    saveDB(db);
  },

  // ----- supervisors -----
  async listSupervisors() {
    return clone(
      db.supervisors.map((s) => ({
        ...s,
        profile: { full_name: s.full_name, email: s.email },
        department: s.department_id ? { name: departmentName(s.department_id) } : null,
      })),
    );
  },
  async createSupervisor(payload) {
    const row = {
      id: uid("sup"),
      created_at: new Date().toISOString(),
      profile_id: null,
      ...payload,
    };
    db.supervisors.push(row);
    // Mirror the DB sync_profile_links trigger: cache the link on the profile.
    if (row.profile_id) {
      const p = db.profiles.find((x) => x.id === row.profile_id);
      if (p) p.supervisor_id = row.id;
    }
    saveDB(db);
    return clone(row);
  },
  async getSupervisorById(id) {
    return db.supervisors.find((s) => s.id === id) ?? null;
  },
  async updateSupervisor(id, payload) {
    const row = db.supervisors.find((s) => s.id === id);
    if (row) Object.assign(row, payload);
    saveDB(db);
    return clone(row);
  },
  async removeSupervisor(id) {
    db.supervisors = db.supervisors.filter((s) => s.id !== id);
    saveDB(db);
  },

  // ----- interns -----
  async listInterns({ search = "", departmentId = "", status = "", supervisorId = "", createdBy = "", institutionId = "", programId = "", page = 1, pageSize = 10 } = {}) {
    let rows = clone(db.interns);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.student_number || "").toLowerCase().includes(q),
      );
    }
    if (departmentId) rows = rows.filter((r) => r.department_id === departmentId);
    if (status) rows = rows.filter((r) => r.status === status);
    if (institutionId) rows = rows.filter((r) => r.institution_id === institutionId);
    if (programId) rows = rows.filter((r) => r.program_id === programId);
    if (supervisorId && createdBy) {
      rows = rows.filter((r) => r.supervisor_id === supervisorId || r.created_by === createdBy);
    } else if (supervisorId) rows = rows.filter((r) => r.supervisor_id === supervisorId);
    else if (createdBy) rows = rows.filter((r) => r.created_by === createdBy);
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize).map((r) => ({
      ...r,
      department: { name: departmentName(r.department_id) },
      supervisor: { full_name: supervisorName(r.supervisor_id), email: null },
      institution: r.institution_id
        ? { institution_name: institutionName(r.institution_id) }
        : null,
      program: r.program_id ? { program_name: programName(r.program_id) } : null,
    }));
    return { data, count: total, page, pageSize };
  },
  async getIntern(id) {
    return clone(db.interns.find((i) => i.id === id) ?? null);
  },
  async createIntern(payload) {
    const row = {
      id: uid("int"),
      created_at: new Date().toISOString(),
      avatar_url: null,
      status: payload.status ?? "active",
      ...payload,
    };
    db.interns.push(row);
    if (row.profile_id) {
      const p = db.profiles.find((x) => x.id === row.profile_id);
      if (p) p.intern_id = row.id;
    }
    saveDB(db);
    return clone(row);
  },
  async updateIntern(id, payload) {
    const row = db.interns.find((i) => i.id === id);
    if (row) Object.assign(row, payload);
    saveDB(db);
    return clone(row);
  },
  async reconcilePrograms(institutionId, programs = []) {
    const existing = db.programs.filter((p) => p.institution_id === institutionId);
    const incomingIds = new Set(programs.filter((p) => p.program_id).map((p) => p.program_id));
    // Delete removed programs.
    db.programs = db.programs.filter(
      (p) => p.institution_id !== institutionId || incomingIds.has(p.program_id),
    );
    // Upsert incoming programs.
    for (const p of programs) {
      const base = {
        program_name: p.program_name,
        abbreviation: p.abbreviation || null,
        program_code: p.program_code || null,
        required_hours: Number(p.required_hours) || 0,
      };
      if (p.program_id) {
        const row = db.programs.find((x) => x.program_id === p.program_id);
        if (row) Object.assign(row, base, { updated_at: new Date().toISOString() });
      } else {
        db.programs.push({
          program_id: uid("prog"),
          institution_id: institutionId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...base,
        });
      }
    }
    saveDB(db);
    return true;
  },
  async removeIntern(id) {
    db.interns = db.interns.filter((i) => i.id !== id);
    db.profiles.forEach((p) => {
      if (p.intern_id === id) p.intern_id = null;
    });
    saveDB(db);
  },

  // ----- attendance -----
  async getOpenAttendance(internId) {
    const today = todayISO();
    return (
      clone(
        db.attendance.find(
          (a) => a.intern_id === internId && a.date === today && !a.time_out,
        ),
      ) ?? null
    );
  },
  async timeIn(internId, method = "manual") {
    const today = todayISO();
    // Enforce one attendance record per day: reuse today's record if it exists.
    const existing = db.attendance.find((a) => a.intern_id === internId && a.date === today);
    if (existing) {
      const now = new Date().toISOString();
      existing.time_in = now;
      existing.time_out = null;
      existing.total_hours = 0;
      existing.status = "present";
      existing.method = method;
      saveDB(db);
      return clone(existing);
    }
    const row = {
      id: uid("att"),
      intern_id: internId,
      date: today,
      time_in: new Date().toISOString(),
      time_out: null,
      total_hours: 0,
      method,
      status: "present",
    };
    db.attendance.push(row);
    saveDB(db);
    return clone(row);
  },
  async timeOut(recordId, timeInISO) {
    const row = db.attendance.find((a) => a.id === recordId);
    if (!row) return null;
    const out = new Date().toISOString();
    const start = new Date(timeInISO).getTime();
    const end = new Date(out).getTime();
    const hours = start && end > start ? Math.round(((end - start) / 3600000) * 100) / 100 : 0;
    row.time_out = out;
    row.total_hours = hours;
    saveDB(db);
    return clone(row);
  },
  async listAttendance({ internId, date, page = 1, pageSize = 15 } = {}) {
    let rows = clone(db.attendance);
    if (internId) rows = rows.filter((r) => r.intern_id === internId);
    if (date) rows = rows.filter((r) => r.date === date);
    rows.sort((a, b) => {
      const byDate = (b.date || "").localeCompare(a.date || "");
      if (byDate !== 0) return byDate;
      return (b.time_in || "").localeCompare(a.time_in || "");
    });
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize).map((r) => ({
      ...r,
      intern: {
        full_name: internName(r.intern_id),
        student_number: internStudentNo(r.intern_id),
        supervisor_id: db.interns.find((i) => i.id === r.intern_id)?.supervisor_id ?? null,
      },
    }));
    return { data, count: total, page, pageSize };
  },
  async adminListAttendance({ date, page = 1, pageSize = 15 } = {}) {
    return this.listAttendance({ date, page, pageSize });
  },

  // ----- journals -----
  async listJournals({ internId, status, supervisorId, page = 1, pageSize = 15 } = {}) {
    let rows = clone(db.daily_journals);
    if (internId) rows = rows.filter((r) => r.intern_id === internId);
    if (status) rows = rows.filter((r) => r.status === status);
    if (supervisorId) rows = rows.filter((r) => r.supervisor_id === supervisorId);
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize).map((r) => ({
      ...r,
      intern: { full_name: internName(r.intern_id), student_number: internStudentNo(r.intern_id) },
    }));
    return { data, count: total, page, pageSize };
  },
  async createJournal(payload) {
    const row = { id: uid("jr"), created_at: new Date().toISOString(), supervisor_comment: null, ...payload };
    db.daily_journals.push(row);
    saveDB(db);
    return clone(row);
  },
  async reviewJournal(id, status, supervisorId, comment) {
    const row = db.daily_journals.find((j) => j.id === id);
    if (row) {
      row.status = status;
      row.supervisor_id = supervisorId ?? row.supervisor_id;
      row.supervisor_comment = comment;
    }
    saveDB(db);
    return clone(row);
  },

  // ----- documents -----
  async listDocuments({ internId, status, page = 1, pageSize = 15 } = {}) {
    let rows = clone(db.documents);
    if (internId) rows = rows.filter((r) => r.intern_id === internId);
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize).map((r) => ({
      ...r,
      intern: { full_name: internName(r.intern_id), student_number: internStudentNo(r.intern_id) },
    }));
    return { data, count: total, page, pageSize };
  },
  async uploadDocument({ internId, type, label, file_name }) {
    const row = {
      id: uid("doc"),
      intern_id: internId,
      type,
      label: label || type,
      file_path: `${internId}/${file_name}`,
      file_url: null,
      file_name,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    db.documents.push(row);
    saveDB(db);
    return clone(row);
  },
  async reviewDocument(id, status) {
    const row = db.documents.find((d) => d.id === id);
    if (row) row.status = status;
    saveDB(db);
    return clone(row);
  },
  async removeDocument(id) {
    db.documents = db.documents.filter((d) => d.id !== id);
    saveDB(db);
  },

  // ----- evaluations -----
  async listEvaluations({ internId, supervisorId, status, page = 1, pageSize = 15 } = {}) {
    let rows = clone(db.evaluations);
    if (internId) rows = rows.filter((r) => r.intern_id === internId);
    if (supervisorId) rows = rows.filter((r) => r.supervisor_id === supervisorId);
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize).map((r) => ({
      ...r,
      intern: { full_name: internName(r.intern_id), student_number: internStudentNo(r.intern_id) },
    }));
    return { data, count: total, page, pageSize };
  },
  async createEvaluation(payload) {
    const row = { id: uid("ev"), created_at: new Date().toISOString(), status: "pending", ...payload };
    db.evaluations.push(row);
    saveDB(db);
    return clone(row);
  },

  // ----- announcements -----
  async listAnnouncements({ category, page = 1, pageSize = 20 } = {}) {
    let rows = clone(db.announcements);
    if (category) rows = rows.filter((r) => r.category === category);
    rows.sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { data: rows.slice(start, start + pageSize), count: total, page, pageSize };
  },
  async createAnnouncement(payload) {
    const row = {
      id: uid("ann"),
      pinned: false,
      created_at: new Date().toISOString(),
      ...payload,
    };
    db.announcements.unshift(row);
    saveDB(db);
    return clone(row);
  },
  async updateAnnouncement(id, payload) {
    const row = db.announcements.find((a) => a.id === id);
    if (row) Object.assign(row, payload);
    saveDB(db);
    return clone(row);
  },
  async removeAnnouncement(id) {
    db.announcements = db.announcements.filter((a) => a.id !== id);
    saveDB(db);
  },

  // ----- notifications -----
  async listNotifications({ userId, onlyUnread = false, limit = 50 } = {}) {
    let rows = clone(db.notifications.filter((n) => n.user_id === userId));
    if (onlyUnread) rows = rows.filter((n) => !n.is_read);
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return rows.slice(0, limit);
  },
  async unreadNotificationCount(userId) {
    return db.notifications.filter((n) => n.user_id === userId && !n.is_read).length;
  },
  async markNotificationRead(id) {
    const row = db.notifications.find((n) => n.id === id);
    if (row) {
      row.is_read = true;
      row.read_at = new Date().toISOString();
    }
    saveDB(db);
    return clone(row);
  },
  async markAllNotificationsRead(userId) {
    db.notifications.forEach((n) => {
      if (n.user_id === userId && !n.is_read) {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      }
    });
    saveDB(db);
  },
  async createNotification(payload) {
    const row = {
      id: uid("ntf"),
      is_read: false,
      read_at: null,
      metadata: {},
      created_at: new Date().toISOString(),
      ...payload,
    };
    db.notifications.unshift(row);
    saveDB(db);
    return clone(row);
  },

  // ----- audit_logs -----
  async listAuditLogs({ resourceType = "", resourceId = "", limit = 100 } = {}) {
    let rows = clone(db.audit_logs);
    if (resourceType) rows = rows.filter((r) => r.resource_type === resourceType);
    if (resourceId) rows = rows.filter((r) => String(r.resource_id) === String(resourceId));
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return rows.slice(0, limit);
  },
  async createAuditLog(payload) {
    const row = {
      id: uid("log"),
      changes: {},
      created_at: new Date().toISOString(),
      ...payload,
    };
    db.audit_logs.unshift(row);
    saveDB(db);
    return clone(row);
  },

  // ----- settings -----
  async getSettings() {
    return clone(db.settings);
  },
  async upsertSettings(payload) {
    db.settings = { ...db.settings, ...payload, updated_at: new Date().toISOString() };
    saveDB(db);
    return clone(db.settings);
  },

  // ----- dashboard aggregates -----
  async adminStats() {
    const today = todayISO();
    const totalInterns = db.interns.length;
    const activeInterns = db.interns.filter((i) => i.status === "active").length;
    const completedInternships = db.interns.filter((i) => i.status === "completed").length;
    const pendingEvaluations = db.evaluations.filter((e) => e.status === "pending").length;
    const attendanceToday = db.attendance.filter((a) => a.date === today).length;
    return { totalInterns, activeInterns, completedInternships, pendingEvaluations, attendanceToday };
  },
  async supervisorStats(supervisorId) {
    const today = todayISO();
    const assigned = db.interns.filter((i) => i.supervisor_id === supervisorId && i.status === "active").length;
    const attendanceToday = db.attendance.filter(
      (a) => a.date === today && db.interns.find((i) => i.id === a.intern_id)?.supervisor_id === supervisorId,
    ).length;
    const pendingJournals = db.daily_journals.filter(
      (j) => j.supervisor_id === supervisorId && j.status === "pending",
    ).length;
    const pendingEvaluations = db.evaluations.filter(
      (e) => e.supervisor_id === supervisorId && e.status === "pending",
    ).length;
    return { assignedInterns: assigned, attendanceToday, pendingJournals, pendingEvaluations };
  },
  async internStats(internId) {
    const today = todayISO();
    const hoursRows = db.attendance.filter((a) => a.intern_id === internId);
    const rendered = hoursRows.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);
    const intern = db.interns.find((i) => i.id === internId);
    const requiredHours = Number(intern?.required_hours) || 0;
    const todayAttendance = db.attendance.filter((a) => a.intern_id === internId && a.date === today).length;
    const announcements = db.announcements.length;
    return {
      hoursRendered: Math.round(rendered * 100) / 100,
      requiredHours,
      remainingHours: Math.max(0, requiredHours - rendered),
      todayAttendance,
      latestAnnouncements: announcements,
    };
  },
};

export default mockBackend;
