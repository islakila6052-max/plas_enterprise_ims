"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { internService } from "@/services/internService";
import { supervisorService } from "@/services/supervisorService";
import { departmentService } from "@/services/departmentService";
import { institutionService } from "@/services/institutionService";
import { programService } from "@/services/programService";
import { attendanceService } from "@/services/attendanceService";
import { journalService } from "@/services/journalService";
import { evaluationService } from "@/services/evaluationService";
import { settingsService } from "@/services/settingsService";
import { formatDate, formatTime, formatHours } from "@/utils/format";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  INTERN_STATUS,
  INTERN_STATUS_LABELS,
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_LABELS,
  JOURNAL_STATUS,
  JOURNAL_STATUS_LABELS,
  EVALUATION_RECOMMENDATIONS,
} from "@/lib/constants";

const REPORTS = [
  {
    key: "intern_list",
    label: "Intern List",
    columns: [
      { key: "Name", header: "Name" },
      { key: "Student No.", header: "Student No." },
      { key: "Department", header: "Department" },
      { key: "Institution", header: "Institution" },
      { key: "Program", header: "Program" },
      { key: "Status", header: "Status" },
      { key: "Required Hours", header: "Required Hours" },
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    columns: [
      { key: "Intern", header: "Intern" },
      { key: "Student No.", header: "Student No." },
      { key: "Date", header: "Date" },
      { key: "Time In", header: "Time In" },
      { key: "Time Out", header: "Time Out" },
      { key: "Hours", header: "Hours" },
      { key: "Status", header: "Status" },
    ],
  },
  {
    key: "journals",
    label: "Daily Journals",
    columns: [
      { key: "Intern", header: "Intern" },
      { key: "Student No.", header: "Student No." },
      { key: "Date", header: "Date" },
      { key: "Hours Worked", header: "Hours Worked" },
      { key: "Status", header: "Status" },
    ],
  },
  {
    key: "evaluations",
    label: "Evaluation Summary",
    columns: [
      { key: "Intern", header: "Intern" },
      { key: "Overall Rating", header: "Overall Rating" },
      { key: "Recommendation", header: "Recommendation" },
      { key: "Status", header: "Status" },
    ],
  },
  {
    key: "hours",
    label: "Hours Rendered",
    columns: [
      { key: "Name", header: "Name" },
      { key: "Required Hours", header: "Required Hours" },
      { key: "Rendered Hours", header: "Rendered Hours" },
    ],
  },
];

// --- Default filter helpers ---
function defaultInternListFilters() {
  return {
    departmentId: "",
    status: "",
    institutionId: "",
    programId: "",
    createdFrom: "",
    createdTo: "",
  };
}

function defaultAttendanceFilters() {
  return {
    dateFrom: "",
    dateTo: "",
    internId: "",
    status: "",
    supervisorId: "",
  };
}

function defaultJournalsFilters() {
  return {
    dateFrom: "",
    dateTo: "",
    internId: "",
    status: "",
    supervisorId: "",
    departmentId: "",
  };
}

function defaultEvaluationsFilters() {
  return {
    ratingMin: "",
    ratingMax: "",
    recommendation: "",
    internId: "",
    supervisorId: "",
  };
}

function defaultHoursFilters() {
  return {
    dateFrom: "",
    dateTo: "",
    internId: "",
    departmentId: "",
    minHours: "",
  };
}

function lastThirtyDaysRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: to.toISOString().split("T")[0],
  };
}

// --- Persisted filter state, one object per report type ---
function defaultFiltersMap() {
  const range = lastThirtyDaysRange();
  return {
    intern_list: defaultInternListFilters(),
    attendance: { ...defaultAttendanceFilters(), ...range },
    journals: { ...defaultJournalsFilters(), ...range },
    evaluations: defaultEvaluationsFilters(),
    hours: { ...defaultHoursFilters(), ...range },
  };
}

/** Count truthy (non-empty) filter values in a single report type's filter set. */
function countActiveFilters(f) {
  if (!f || typeof f !== "object") return 0;
  return Object.values(f).filter((v) => v !== "" && v != null && v !== false)
    .length;
}

// --- Build filter objects per report type ---
function buildInternListFilters(f) {
  const {
    departmentId,
    status,
    institutionId,
    programId,
    createdFrom,
    createdTo,
  } = f;
  const obj = {};
  if (departmentId) obj.departmentId = departmentId;
  if (status) obj.status = status;
  if (institutionId) obj.institutionId = institutionId;
  if (programId) obj.programId = programId;
  if (createdFrom) obj.createdFrom = createdFrom;
  if (createdTo) obj.createdTo = createdTo;
  return obj;
}

function buildAttendanceFilters(f) {
  const { dateFrom, dateTo, internId, status, supervisorId } = f;
  const obj = {};
  if (dateFrom) obj.dateFrom = dateFrom;
  if (dateTo) obj.dateTo = dateTo;
  if (internId) obj.internId = internId;
  if (status) obj.status = status;
  if (supervisorId) obj.supervisorId = supervisorId;
  return obj;
}

function buildJournalsFilters(f) {
  const { dateFrom, dateTo, internId, status, supervisorId, departmentId } = f;
  const obj = {};
  if (dateFrom) obj.dateFrom = dateFrom;
  if (dateTo) obj.dateTo = dateTo;
  if (internId) obj.internId = internId;
  if (status) obj.status = status;
  if (supervisorId) obj.supervisorId = supervisorId;
  if (departmentId) obj.departmentId = departmentId;
  return obj;
}

function buildEvaluationsFilters(f) {
  const { ratingMin, ratingMax, recommendation, internId, supervisorId } = f;
  const obj = {};
  if (ratingMin) obj.ratingMin = Number(ratingMin);
  if (ratingMax) obj.ratingMax = Number(ratingMax);
  if (recommendation) obj.recommendation = recommendation;
  if (internId) obj.internId = internId;
  if (supervisorId) obj.supervisorId = supervisorId;
  return obj;
}

// --- Report-specific filter UI components ---
function InternListFilters({ filters, setFilters, onReset }) {
  const [departments, setDepartments] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      departmentService.list(),
      institutionService.list(),
      programService.list(),
    ])
      .then(([depts, insts, progs]) => {
        if (cancelled) return;
        setDepartments(depts ?? []);
        setInstitutions(insts ?? []);
        setPrograms(progs ?? []);
      })
      .catch((err) => toast.error(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Department
        </label>
        <Select
          value={filters.departmentId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, departmentId: e.target.value }))
          }
          className="w-full">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id || d.name}>
              {d.name || d.institution_name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Status
        </label>
        <Select
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
          className="w-full">
          <option value="">All</option>
          {Object.values(INTERN_STATUS).map((s) => (
            <option key={s} value={s}>
              {INTERN_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Institution
        </label>
        <Select
          value={filters.institutionId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, institutionId: e.target.value }))
          }
          className="w-full">
          <option value="">All Institutions</option>
          {institutions.map((i) => (
            <option key={i.institution_id} value={i.institution_id}>
              {i.institution_name || i.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Program
        </label>
        <Select
          value={filters.programId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, programId: e.target.value }))
          }
          className="w-full">
          <option value="">All Programs</option>
          {programs.map((p) => (
            <option key={p.program_id} value={p.program_id}>
              {p.program_name || p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            From
          </label>
          <Input
            type="date"
            value={filters.createdFrom || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, createdFrom: e.target.value }))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            To
          </label>
          <Input
            type="date"
            value={filters.createdTo || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, createdTo: e.target.value }))
            }
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full">
          Reset Filters
        </Button>
      </div>
    </div>
  );
}

function AttendanceFilters({ filters, setFilters, onReset }) {
  const [interns, setInterns] = useState([]);
  const [supervisors, setSupervisors] = useState([]);

  useEffect(() => {
    Promise.all([
      internService.list({ page: 1, pageSize: 200 }),
      supervisorService.list(),
    ]).then(([internRes, supRes]) => {
      setInterns(internRes.data ?? []);
      setSupervisors(supRes ?? []);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Date From
        </label>
        <Input
          type="date"
          value={filters.dateFrom || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateFrom: e.target.value }))
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Date To
        </label>
        <Input
          type="date"
          value={filters.dateTo || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateTo: e.target.value }))
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Intern
        </label>
        <Select
          value={filters.internId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, internId: e.target.value }))
          }
          className="w-full">
          <option value="">All Interns</option>
          {interns.map((i) => (
            <option key={i.id} value={i.id}>
              {i.full_name || "—"}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Status
        </label>
        <Select
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
          className="w-full">
          <option value="">All Statuses</option>
          {Object.values(ATTENDANCE_STATUS).map((s) => (
            <option key={s} value={s}>
              {ATTENDANCE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Supervisor
        </label>
        <Select
          value={filters.supervisorId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, supervisorId: e.target.value }))
          }
          className="w-full">
          <option value="">All Supervisors</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.profile?.full_name || s.full_name || "—"}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full">
          Reset Filters
        </Button>
      </div>
    </div>
  );
}

function JournalsFilters({ filters, setFilters, onReset }) {
  const [interns, setInterns] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    Promise.all([
      internService.list({ page: 1, pageSize: 200 }),
      departmentService.list(),
    ]).then(([internRes, deptRes]) => {
      setInterns(internRes.data ?? []);
      setDepartments(deptRes ?? []);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Date From
        </label>
        <Input
          type="date"
          value={filters.dateFrom || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateFrom: e.target.value }))
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Date To
        </label>
        <Input
          type="date"
          value={filters.dateTo || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateTo: e.target.value }))
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Intern
        </label>
        <Select
          value={filters.internId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, internId: e.target.value }))
          }
          className="w-full">
          <option value="">All Interns</option>
          {interns.map((i) => (
            <option key={i.id} value={i.id}>
              {i.full_name || "—"}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Status
        </label>
        <Select
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
          className="w-full">
          <option value="">All</option>
          {Object.values(JOURNAL_STATUS).map((s) => (
            <option key={s} value={s}>
              {JOURNAL_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Department
        </label>
        <Select
          value={filters.departmentId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, departmentId: e.target.value }))
          }
          className="w-full">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id || d.name}>
              {d.name || d.institution_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full">
          Reset Filters
        </Button>
      </div>
    </div>
  );
}

function EvaluationsFilters({ filters, setFilters, onReset }) {
  const [interns, setInterns] = useState([]);
  const [ratingOptions] = useState([
    { value: "1", label: "1 Star" },
    { value: "2", label: "2 Stars" },
    { value: "3", label: "3 Stars" },
    { value: "4", label: "4 Stars" },
    { value: "5", label: "5 Stars" },
    { value: "1-5", label: "1-5 Stars (All)" },
  ]);

  useEffect(() => {
    let cancelled = false;
    internService
      .list({ page: 1, pageSize: 200 })
      .then((res) => {
        if (!cancelled) setInterns(res?.data ?? []);
      })
      .catch((err) => toast.error(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Minimum Rating
        </label>
        <Select
          value={filters.ratingMin || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, ratingMin: e.target.value }))
          }
          className="w-full">
          <option value="">All Ratings</option>
          {ratingOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Maximum Rating
        </label>
        <Select
          value={filters.ratingMax || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, ratingMax: e.target.value }))
          }
          className="w-full">
          <option value="">All Ratings</option>
          {ratingOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Recommendation
        </label>
        <Select
          value={filters.recommendation || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, recommendation: e.target.value }))
          }
          className="w-full">
          <option value="">All</option>
          {EVALUATION_RECOMMENDATIONS.map((rec) => (
            <option key={rec.value} value={rec.value}>
              {rec.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Intern
        </label>
        <Select
          value={filters.internId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, internId: e.target.value }))
          }
          className="w-full">
          <option value="">All Interns</option>
          {interns.map((i) => (
            <option key={i.id} value={i.id}>
              {i.full_name || "—"}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full">
          Reset Filters
        </Button>
      </div>
    </div>
  );
}

function HoursFilters({ filters, setFilters, onReset }) {
  const [interns, setInterns] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      internService.list({ page: 1, pageSize: 200 }),
      departmentService.list(),
    ])
      .then(([internRes, deptRes]) => {
        if (cancelled) return;
        setInterns(internRes?.data ?? []);
        setDepartments(deptRes ?? []);
      })
      .catch((err) => toast.error(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Date From
        </label>
        <Input
          type="date"
          value={filters.dateFrom || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateFrom: e.target.value }))
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Date To
        </label>
        <Input
          type="date"
          value={filters.dateTo || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, dateTo: e.target.value }))
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Intern
        </label>
        <Select
          value={filters.internId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, internId: e.target.value }))
          }
          className="w-full">
          <option value="">All Interns</option>
          {interns.map((i) => (
            <option key={i.id} value={i.id}>
              {i.full_name || "—"}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Department
        </label>
        <Select
          value={filters.departmentId || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, departmentId: e.target.value }))
          }
          className="w-full">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id || d.name}>
              {d.name || d.institution_name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Minimum Hours
        </label>
        <Input
          type="number"
          value={filters.minHours || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, minHours: e.target.value }))
          }
          className="w-full"
          placeholder="e.g., 100"
        />
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full">
          Reset Filters
        </Button>
      </div>
    </div>
  );
}

// --- Filter Indicator Badge ---
function FilterBadge({ activeCount }) {
  if (activeCount === 0) return null;
  return (
    <span className="rounded-full border px-2 py-1 text-xs font-medium text-brand-700 bg-brand-100">
      {activeCount} filter{activeCount !== 1 ? "s" : ""}
    </span>
  );
}

// --- Main Component ---
export default function AdminReports() {
  const [type, setType] = useState("intern_list");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  // Filters are persisted per report type in a nested object so that switching
  // between report types never loses filters the admin already configured.
  const [filters, setFilters] = useState(() => {
    const base = defaultFiltersMap();
    try {
      const stored = localStorage.getItem("adminReportsFilters");
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const key of Object.keys(base)) {
          if (
            parsed &&
            typeof parsed[key] === "object" &&
            parsed[key] !== null
          ) {
            base[key] = { ...base[key], ...parsed[key] };
          }
        }
      }
    } catch {
      // Ignore corrupted/unavailable storage; fall back to defaults.
    }
    return base;
  });

  useEffect(() => {
    try {
      localStorage.setItem("adminReportsFilters", JSON.stringify(filters));
    } catch {
      // Ignore storage quota / privacy errors.
    }
  }, [filters]);

  // fetchData with filters
  async function fetchData() {
    const typeFilters = filters[type] || {};
    switch (type) {
      case "intern_list": {
        const res = await internService.list({
          page: 1,
          pageSize: 1000,
          ...buildInternListFilters(typeFilters),
        });
        return (res.data ?? []).map((r) => ({
          Name: r.full_name ?? "—",
          "Student No.": r.student_number ?? "",
          Department: r.department?.name ?? "",
          Institution: r.institution?.institution_name ?? "",
          Program: r.program?.program_name ?? "",
          Status: r.status ?? "",
          "Required Hours": r.required_hours ?? 0,
        }));
      }
      case "attendance": {
        const res = await attendanceService.adminList({
          page: 1,
          pageSize: 1000,
          ...buildAttendanceFilters(typeFilters),
        });
        return (res.data ?? []).map((a) => ({
          Intern: a.intern?.full_name ?? "—",
          "Student No.": a.intern?.student_number ?? "",
          Date: formatDate(a.date),
          "Time In": a.time_in ? formatTime(a.time_in) : "—",
          "Time Out": a.time_out ? formatTime(a.time_out) : "—",
          Hours: formatHours(a.total_hours ?? 0),
          Status: a.status ?? "",
        }));
      }
      case "journals": {
        const res = await journalService.list({
          page: 1,
          pageSize: 1000,
          ...buildJournalsFilters(typeFilters),
        });
        return (res.data ?? []).map((j) => ({
          Intern: j.intern?.full_name ?? "—",
          "Student No.": j.intern?.student_number ?? "",
          Date: formatDate(j.date),
          "Hours Worked": j.hours_worked ?? 0,
          Status: j.status ?? "",
        }));
      }
      case "evaluations": {
        const res = await evaluationService.list({
          page: 1,
          pageSize: 1000,
          ...buildEvaluationsFilters(typeFilters),
        });
        return (res.data ?? []).map((e) => ({
          Intern: e.intern?.full_name ?? "—",
          "Overall Rating": `${e.overall_rating ?? "—"}/5`,
          Recommendation: e.final_recommendation ?? "—",
          Status: e.status ?? "",
        }));
      }
      case "hours": {
        // Filter interns by intern-level filters (department/status), attendance
        // by date/intern filters, then apply minHours + single-intern selection
        // client-side.
        const [internsRes, attRes] = await Promise.all([
          internService.list({
            page: 1,
            pageSize: 1000,
            ...buildInternListFilters(typeFilters),
          }),
          attendanceService.adminList({
            page: 1,
            pageSize: 5000,
            ...buildAttendanceFilters(typeFilters),
          }),
        ]);
        const renderedByIntern = (attRes.data ?? []).reduce((acc, r) => {
          if (r.intern_id) {
            acc[r.intern_id] =
              (acc[r.intern_id] ?? 0) + (Number(r.total_hours) || 0);
          }
          return acc;
        }, {});
        const minHours = Number(typeFilters.minHours) || 0;
        let interns = internsRes.data ?? [];
        if (typeFilters.internId) {
          const selected = String(typeFilters.internId);
          interns = interns.filter((i) => String(i.id) === selected);
        }
        return interns
          .filter((i) => (renderedByIntern[i.id] ?? 0) >= minHours)
          .map((i) => ({
            Name: i.full_name ?? "—",
            "Required Hours": i.required_hours ?? 0,
            "Rendered Hours": formatHours(renderedByIntern[i.id] ?? 0),
          }));
      }
      default:
        return [];
    }
  }

  async function generatePreview() {
    setBusy(true);
    try {
      const data = await fetchData();
      setPreview(data);
      toast.success(`Preview generated: ${data.length} records`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportPDF() {
    setBusy(true);
    try {
      const data = await fetchData();
      if (!data.length) {
        toast.error("No data to export.");
        return;
      }

      // Fetch company name for the header.
      let companyName = "Internship Management System";
      try {
        const settings = await settingsService.get();
        if (settings?.company_name) companyName = settings.company_name;
      } catch {
        /* use default */
      }

      const doc = new jsPDF({
        orientation: data.length > 5 ? "landscape" : "portrait",
      });

      const reportLabel = REPORTS.find((r) => r.key === type)?.label ?? type;
      const generated = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const rows = data.map((d) => Object.values(d));
      const rawHeaders = Object.keys(data[0]);
      // Format headers: StudentNo → Student No., RequiredHours → Required Hours, etc.
      const headers = rawHeaders.map((h) =>
        h
          .replace(/([A-Z])/g, " $1")
          .replace(/^\s/, "")
          .replace(/\s+/g, " ")
          .trim(),
      );

      // ── Header ──
      doc.setFontSize(16);
      doc.setTextColor(21, 128, 61); // brand-700
      doc.text(companyName, 14, 18);
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(`Report: ${reportLabel}`, 14, 26);
      doc.text(`Generated: ${generated}  ·  ${data.length} records`, 14, 33);

      // ── Table ──
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 40,
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [21, 128, 61],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          textColor: [51, 65, 85],
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [240, 253, 244],
        },
        columnStyles: {},
        didDrawPage: (hookData) => {
          // Footer with page number on every page.
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${hookData.pageNumber}`,
            doc.internal.pageSize.getWidth() - 20,
            doc.internal.pageSize.getHeight() - 10,
            { align: "right" },
          );
          doc.text(
            `IMS Report — ${reportLabel}`,
            14,
            doc.internal.pageSize.getHeight() - 10,
          );
        },
      });

      doc.save(`IMS-${type}-Report.pdf`);
      toast.success("PDF exported.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function printPreview() {
    if (!preview || !preview.length)
      return toast.error("Generate a preview first.");
    const headers = Object.keys(preview[0]);
    const rows = preview.map((d) => Object.values(d));
    const html = `
      <h2>IMS Report — ${type}</h2>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-size:12px">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
    const w = window.open("", "_blank");
    w.document.write(`<html><body>${html}</body></html>`);
    w.document.close();
    w.print();
  }

  // --- Filter Modals per report type ---
  const [showInternListFilter, setShowInternListFilter] = useState(false);
  const [showAttendanceFilter, setShowAttendanceFilter] = useState(false);
  const [showJournalsFilter, setShowJournalsFilter] = useState(false);
  const [showEvaluationsFilter, setShowEvaluationsFilter] = useState(false);
  const [showHoursFilter, setShowHoursFilter] = useState(false);

  const previewColumns = REPORTS.find((r) => r.key === type)?.columns ?? [];

  // Update filters for ONLY the currently selected report type (nested state).
  function updateTypeFilters(updater) {
    setFilters((f) => {
      const prev = f[type] || {};
      const next = typeof updater === "function" ? updater(prev) : updater;
      return { ...f, [type]: next };
    });
  }

  function openCurrentFilters() {
    switch (type) {
      case "intern_list":
        setShowInternListFilter(true);
        break;
      case "attendance":
        setShowAttendanceFilter(true);
        break;
      case "journals":
        setShowJournalsFilter(true);
        break;
      case "evaluations":
        setShowEvaluationsFilter(true);
        break;
      case "hours":
        setShowHoursFilter(true);
        break;
      default:
        break;
    }
  }

  // Handle report type click - opens filter modal automatically
  function handleReportClick(key) {
    setType(key);
    setPreview(null);
    // Open the filter modal for this report type
    switch (key) {
      case "intern_list":
        setShowInternListFilter(true);
        break;
      case "attendance":
        setShowAttendanceFilter(true);
        break;
      case "journals":
        setShowJournalsFilter(true);
        break;
      case "evaluations":
        setShowEvaluationsFilter(true);
        break;
      case "hours":
        setShowHoursFilter(true);
        break;
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and export internship reports."
      />
      <Card>
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Select report
            </p>
            <div className="flex flex-wrap gap-2">
              {REPORTS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => handleReportClick(r.key)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    type === r.key
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-brand-100 text-slate-600 hover:bg-brand-50"
                  }`}>
                  {r.label}
                  <FilterBadge
                    activeCount={countActiveFilters(filters[r.key])}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-brand-100 pt-4">
            <Button
              variant="outline"
              onClick={openCurrentFilters}
              disabled={busy}>
              Filters
              {countActiveFilters(filters[type]) > 0 && (
                <FilterBadge activeCount={countActiveFilters(filters[type])} />
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={generatePreview}
              disabled={busy}>
              Generate Preview
            </Button>
            <Button onClick={exportPDF} disabled={busy}>
              Download PDF
            </Button>
            <Button variant="secondary" onClick={printPreview} disabled={busy}>
              Print
            </Button>
          </div>

          {/* Filter Modals - opened via the "Filters" action button OR automatically on report click */}
          {type === "intern_list" && (
            <Modal
              open={showInternListFilter}
              onClose={() => setShowInternListFilter(false)}
              title="Intern List Filters"
              size="lg">
              <InternListFilters
                filters={filters.intern_list}
                setFilters={updateTypeFilters}
                onReset={() => updateTypeFilters(defaultInternListFilters)}
              />
              <div className="mt-4 flex justify-end gap-3 border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowInternListFilter(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowInternListFilter(false);
                    generatePreview();
                  }}
                  disabled={busy}>
                  Generate Preview
                </Button>
              </div>
            </Modal>
          )}

          {type === "attendance" && (
            <Modal
              open={showAttendanceFilter}
              onClose={() => setShowAttendanceFilter(false)}
              title="Attendance Filters"
              size="lg">
              <AttendanceFilters
                filters={filters.attendance}
                setFilters={updateTypeFilters}
                onReset={() => updateTypeFilters(defaultAttendanceFilters)}
              />
              <div className="mt-4 flex justify-end gap-3 border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowAttendanceFilter(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAttendanceFilter(false);
                    generatePreview();
                  }}
                  disabled={busy}>
                  Generate Preview
                </Button>
              </div>
            </Modal>
          )}

          {type === "journals" && (
            <Modal
              open={showJournalsFilter}
              onClose={() => setShowJournalsFilter(false)}
              title="Daily Journals Filters"
              size="lg">
              <JournalsFilters
                filters={filters.journals}
                setFilters={updateTypeFilters}
                onReset={() => updateTypeFilters(defaultJournalsFilters)}
              />
              <div className="mt-4 flex justify-end gap-3 border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowJournalsFilter(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowJournalsFilter(false);
                    generatePreview();
                  }}
                  disabled={busy}>
                  Generate Preview
                </Button>
              </div>
            </Modal>
          )}

          {type === "evaluations" && (
            <Modal
              open={showEvaluationsFilter}
              onClose={() => setShowEvaluationsFilter(false)}
              title="Evaluation Summary Filters"
              size="lg">
              <EvaluationsFilters
                filters={filters.evaluations}
                setFilters={updateTypeFilters}
                onReset={() => updateTypeFilters(defaultEvaluationsFilters)}
              />
              <div className="mt-4 flex justify-end gap-3 border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowEvaluationsFilter(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEvaluationsFilter(false);
                    generatePreview();
                  }}
                  disabled={busy}>
                  Generate Preview
                </Button>
              </div>
            </Modal>
          )}

          {type === "hours" && (
            <Modal
              open={showHoursFilter}
              onClose={() => setShowHoursFilter(false)}
              title="Hours Rendered Filters"
              size="lg">
              <HoursFilters
                filters={filters.hours}
                setFilters={updateTypeFilters}
                onReset={() => updateTypeFilters(defaultHoursFilters)}
              />
              <div className="mt-4 flex justify-end gap-3 border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowHoursFilter(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowHoursFilter(false);
                    generatePreview();
                  }}
                  disabled={busy}>
                  Generate Preview
                </Button>
              </div>
            </Modal>
          )}
        </div>
      </Card>

      {preview && (
        <Card className="mt-6">
          <div className="border-b border-brand-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">
              Preview — {REPORTS.find((r) => r.key === type)?.label}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {preview.length} records
            </p>
          </div>
          <Table columns={previewColumns} rows={preview} rowKey={(_, i) => i} />
        </Card>
      )}
    </div>
  );
}
