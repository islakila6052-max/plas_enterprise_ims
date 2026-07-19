// src/pages/admin/InternManagement.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Avatar from "@/components/ui/Avatar";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { internService } from "@/services/internService";
import { departmentService } from "@/services/departmentService";
import { supervisorService } from "@/services/supervisorService";
import { institutionService } from "@/services/institutionService";
import { programService } from "@/services/programService";
import { userService } from "@/services/userService";
import { useAuth } from "@/contexts/AuthContext";
import { INTERN_STATUS, INTERN_STATUS_LABELS, PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/utils/format";
import { recordAudit, notify } from "@/services/activityService";

const STATUS_TONE = { active: "green", completed: "blue", archived: "gray" };

const EMPTY = {
  full_name: "",
  student_number: "",
  contact_number: "",
  email: "",
  emergency_contact: "",
  department_id: "",
  supervisor_id: "",
  start_date: "",
  end_date: "",
  required_hours: 300,
  status: "active",
};

export default function InternManagement() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");

  const [departments, setDepartments] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [institutionLabel, setInstitutionLabel] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programLabel, setProgramLabel] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type, row }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({ defaultValues: EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internService.list({ search, departmentId, status, page });
      setRows(res.data);
      setTotal(res.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, departmentId, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    departmentService.list().then(setDepartments).catch(() => {});
    supervisorService.list().then(setSupervisors).catch(() => {});
    institutionService.list({}).then(setInstitutions).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    reset(EMPTY);
    setSelectedInstitutionId("");
    setInstitutionLabel("");
    setSelectedProgramId("");
    setProgramLabel("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    reset({
      full_name: row.full_name ?? "",
      student_number: row.student_number ?? "",
      contact_number: row.contact_number ?? "",
      email: row.email ?? "",
      emergency_contact: row.emergency_contact ?? "",
      department_id: row.department_id ?? "",
      supervisor_id: row.supervisor_id ?? "",
      start_date: row.start_date ?? "",
      end_date: row.end_date ?? "",
      required_hours: row.required_hours ?? 300,
      status: row.status ?? "active",
    });
    setSelectedInstitutionId(row.institution_id ?? "");
    setInstitutionLabel(
      institutions.find((i) => i.institution_id === row.institution_id)?.institution_name ?? "",
    );
    setSelectedProgramId(row.program_id ?? "");
    setProgramLabel("");
    if (row.institution_id) {
      programService.list({ institutionId: row.institution_id }).then((ps) => {
        const p = ps.find((x) => x.program_id === row.program_id);
        setProgramLabel(p?.program_name ?? "");
      }).catch(() => {});
    }
    setModalOpen(true);
  }

  async function onInstitutionSearch(query) {
    try {
      const rows = await institutionService.list({ search: query });
      return rows.map((i) => ({ value: i.institution_id, label: i.institution_name }));
    } catch {
      return [];
    }
  }

  async function onProgramSearch(query) {
    if (!selectedInstitutionId) return [];
    try {
      const rows = await programService.list({ institutionId: selectedInstitutionId, search: query });
      return rows.map((p) => ({ value: p.program_id, label: p.program_name }));
    } catch {
      return [];
    }
  }

  function handleInstitutionSelect(opt) {
    setSelectedInstitutionId(opt.value);
    setInstitutionLabel(opt.label);
    setSelectedProgramId("");
    setProgramLabel("");
    programService.list({ institutionId: opt.value }).catch(() => {});
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      // `password` belongs to the auth user, not the interns table. Strip it
      // (and any confirm field) so we never send a non-existent column to Supabase.
      const { password, confirmPassword, ...internValues } = values;
      const payload = {
        ...internValues,
        required_hours: Number(internValues.required_hours) || 0,
        // Coerce empty-string selects ("Unassigned") to null so we never send
        // "" into a uuid column (which throws and aborts the insert).
        department_id: internValues.department_id || null,
        supervisor_id: internValues.supervisor_id || null,
        institution_id: selectedInstitutionId || null,
        program_id: internValues.program_id || null,
        created_by: user?.id,
      };
      if (editing) {
        await internService.update(editing.id, payload);
        await recordAudit({ user_id: user?.id, action: "update", resource_type: "intern", resource_id: editing.id, changes: { full_name: payload.full_name, supervisor_id: payload.supervisor_id } });
        toast.success("Intern updated.");
      } else {
        // Create a real auth user + linked intern record so the intern can log in.
        const newUser = await userService.createAuthUser({
          email: values.email,
          password: password,
          full_name: values.full_name,
          role: "intern",
        });

        const created = await internService.create({
          ...payload,
          profile_id: newUser.id,
        });
        await recordAudit({ user_id: user?.id, action: "create", resource_type: "intern", resource_id: created?.id, changes: { full_name: payload.full_name, supervisor_id: payload.supervisor_id } });
        if (payload.supervisor_id) {
          const sup = supervisors.find((x) => x.id === payload.supervisor_id);
          if (sup?.profile_id) await notify({ user_id: sup.profile_id, type: "intern_assigned", title: "New intern assigned", message: (payload.full_name || "An intern") + " was assigned to you.", link: "/supervisor/interns" });
        }
        if (newUser.id) {
          await notify({ user_id: newUser.id, type: "account_created", title: "Your account is ready", message: "Your internship account was created. You can now log in.", link: "/intern" });
        }
        toast.success("Intern added.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      // Surface the full Supabase error (code + details) for easier debugging.
      console.error("Intern create/update failed:", err);
      const detail = err?.details || err?.hint || err?.code || "";
      toast.error(detail ? `${err.message} (${detail})` : err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!confirm) return;
    try {
      if (confirm.type === "archive") {
        await internService.archive(confirm.row.id);
        toast.success("Intern archived.");
      } else if (confirm.type === "restore") {
        await internService.restore(confirm.row.id);
        toast.success("Intern restored.");
      } else {
        await internService.remove(confirm.row.id);
        await recordAudit({ user_id: user?.id, action: "delete", resource_type: "intern", resource_id: confirm.row.id, changes: { full_name: confirm.row.full_name } });
        toast.success("Intern deleted.");
      }
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    }
  }

  const columns = [
    {
      key: "full_name",
      header: "Name",
      render: (r) => (
        <button
          onClick={() => setDetail(r)}
          className="text-left font-medium text-slate-800 hover:text-brand-700">
          {r.full_name}
        </button>
      ),
    },
    { key: "student_number", header: "Student No.", render: (r) => r.student_number ?? "—" },
    { key: "institution", header: "Institution", render: (r) => r.institution?.institution_name ?? "—" },
    { key: "program", header: "Program", render: (r) => r.program?.program_name ?? "—" },
    { key: "department", header: "Department", render: (r) => r.department?.name ?? "—" },
    { key: "supervisor", header: "Supervisor", render: (r) => r.supervisor?.full_name ?? "—" },
    { key: "required_hours", header: "Required Hrs", render: (r) => r.required_hours ?? "—" },
    { key: "start_date", header: "Start", render: (r) => formatDate(r.start_date) },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] ?? "gray"}>{INTERN_STATUS_LABELS[r.status] ?? r.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Edit</Button>
          {r.status === "archived" ? (
            <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: "restore", row: r })}>Restore</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: "archive", row: r })}>Archive</Button>
          )}
          <Button size="sm" variant="danger" onClick={() => setConfirm({ type: "delete", row: r })}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Intern Management"
        description="Add, edit, assign and archive interns."
        action={<Button onClick={openCreate}>+ Add Intern</Button>}
      />

      <Card>
        <div className="grid gap-3 border-b border-brand-100 p-4 sm:grid-cols-3">
          <Input
            placeholder="Search name, number, institution…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}>
            <option value="">All Statuses</option>
            {Object.values(INTERN_STATUS).map((s) => (
              <option key={s} value={s}>{INTERN_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading interns…" />
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon="users"
              title="No interns found"
              description="Add your first intern or adjust the filters."
              action={<Button onClick={openCreate}>+ Add Intern</Button>}
            />
          </div>
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No records.</div>}
          />
        )}

        {rows.length > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Card>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title={editing ? "Edit Intern" : "Add Intern"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>
              {editing ? "Save Changes" : "Create Intern"}
            </Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" error={errors.full_name?.message} {...register("full_name", { required: "Name is required" })} />
            <Input label="Student number" error={errors.student_number?.message} {...register("student_number", { required: "Student number is required" })} />
            <Input label="Contact number" {...register("contact_number")} />
            <Input label="Email" type="email" error={errors.email?.message} {...register("email", { required: "Email is required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" } })} />
            {!editing && (
              <Input
                label="Temporary password"
                type="password"
                error={errors.password?.message}
                {...register("password", { required: !editing && "Password is required", minLength: { value: 8, message: "At least 8 characters" } })}
              />
            )}
            <Input label="Emergency contact" {...register("emergency_contact")} />
            <Input label="Student number" error={errors.student_number?.message} {...register("student_number", { required: "Student number is required" })} />
            <SearchableSelect
              label="Institution"
              value={selectedInstitutionId}
              displayText={institutionLabel}
              onSearch={onInstitutionSearch}
              onSelect={handleInstitutionSelect}
              placeholder="Search institutions…"
            />
            <SearchableSelect
              label="Program"
              value={selectedProgramId}
              displayText={programLabel}
              disabled={!selectedInstitutionId}
              onSearch={onProgramSearch}
              onSelect={(opt) => {
                setSelectedProgramId(opt.value);
                setProgramLabel(opt.label);
                setValue("program_id", opt.value);
              }}
              placeholder={selectedInstitutionId ? "Search programs…" : "Select an institution first"}
            />
            <input type="hidden" {...register("program_id")} />
            <Select label="Department" {...register("department_id")}>
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Select label="Supervisor" {...register("supervisor_id")}>
              <option value="">Unassigned</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name || s.profile?.full_name || "Supervisor"}</option>
              ))}
            </Select>
            <Input label="Start date" type="date" {...register("start_date")} />
            <Input label="End date" type="date" {...register("end_date")} />
            <Input label="Required hours" type="number" {...register("required_hours")} />
            <Select label="Status" {...register("status")}>
              {Object.values(INTERN_STATUS).map((s) => (
                <option key={s} value={s}>{INTERN_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Intern Details" size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={detail.full_name} size="lg" />
              <div>
                <p className="text-lg font-semibold text-slate-800">{detail.full_name}</p>
                <p className="text-sm text-slate-500">{detail.institution?.institution_name || detail.program?.program_name || "—"}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Student No." value={detail.student_number} />
              <Detail label="Email" value={detail.email} />
              <Detail label="Contact" value={detail.contact_number} />
              <Detail label="Emergency" value={detail.emergency_contact} />
              <Detail label="Department" value={detail.department?.name} />
              <Detail label="Supervisor" value={detail.supervisor?.full_name} />
              <Detail label="Start" value={formatDate(detail.start_date)} />
              <Detail label="End" value={formatDate(detail.end_date)} />
              <Detail label="Required Hrs" value={detail.required_hours} />
              <Detail label="Status" value={INTERN_STATUS_LABELS[detail.status]} />
            </dl>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={confirmAction}
        title={confirm?.type === "delete" ? "Delete intern?" : confirm?.type === "archive" ? "Archive intern?" : "Restore intern?"}
        message={
          confirm?.type === "delete"
            ? `Permanently delete ${confirm?.row.full_name}? This cannot be undone.`
            : confirm?.type === "archive"
              ? `${confirm?.row.full_name} will be moved to archived.`
              : `${confirm?.row.full_name} will be restored to active.`
        }
        confirmLabel={confirm?.type === "delete" ? "Delete" : confirm?.type === "archive" ? "Archive" : "Restore"}
        tone={confirm?.type === "delete" ? "danger" : "primary"}
      />
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-brand-50/50 px-3 py-2">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}
