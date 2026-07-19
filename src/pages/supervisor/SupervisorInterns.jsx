// src/pages/supervisor/SupervisorInterns.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { internService } from "@/services/internService";
import { supervisorService } from "@/services/supervisorService";
import { userService } from "@/services/userService";
import { institutionService } from "@/services/institutionService";
import { programService } from "@/services/programService";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useAuth } from "@/contexts/AuthContext";
import { INTERN_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/utils/format";
import { recordAudit, notify } from "@/services/activityService";

const TONE = { active: "green", completed: "blue", archived: "gray" };

const EMPTY = {
  full_name: "",
  email: "",
  password: "",
  student_number: "",
  contact_number: "",
  emergency_contact: "",
  start_date: "",
  end_date: "",
  required_hours: 300,
};

export default function SupervisorInterns() {
  const { profile, supervisorId, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [institutionLabel, setInstitutionLabel] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programLabel, setProgramLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internService.list({
        page: 1,
        pageSize: 100,
        supervisorId: supervisorId,
        createdBy: user?.id,
      });
      let data = res.data;
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((r) => (r.full_name ?? "").toLowerCase().includes(q));
      }
      setRows(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [supervisorId, user?.id, search]);

  useEffect(() => {
    load();
  }, [load]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({ defaultValues: EMPTY });

  function openCreate() {
    reset(EMPTY);
    setSelectedInstitutionId("");
    setInstitutionLabel("");
    setSelectedProgramId("");
    setProgramLabel("");
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
      // Step 1: Create auth user (serverless API in Supabase mode, mock in demo mode).
      const newUser = await userService.createAuthUser({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        role: "intern",
      });

      // Step 2: Resolve this supervisor's record id and department.
      // A supervisor's profile.supervisor_id is their supervisors.id (kept in sync
      // by the DB trigger). Fall back to looking up by profile_id so we never pass
      // an undefined id into the query.
      let supervisorRecordId = profile?.supervisor_id ?? null;
      let departmentId = profile?.department_id ?? null;
      if (!supervisorRecordId && profile?.id) {
        const supRow = await supervisorService.getByProfileId(profile.id);
        supervisorRecordId = supRow?.id ?? null;
        departmentId = supRow?.department_id ?? departmentId;
      } else if (supervisorRecordId) {
        const supRow = await supervisorService.getById(supervisorRecordId);
        departmentId = supRow?.department_id ?? departmentId;
      }

      // Step 3: Create intern record.
      await internService.create({
        profile_id: newUser.id,
        full_name: values.full_name,
        email: values.email,
        student_number: values.student_number,
        contact_number: values.contact_number || null,
        emergency_contact: values.emergency_contact || null,
        department_id: departmentId || null,
        supervisor_id: supervisorRecordId || null,
        institution_id: selectedInstitutionId || null,
        program_id: selectedProgramId || null,
        created_by: user?.id,
        start_date: values.start_date,
        end_date: values.end_date || null,
        required_hours: Number(values.required_hours) || 0,
        status: "active",
      });

      await recordAudit({ user_id: user?.id, action: "create", resource_type: "intern", resource_id: newUser?.id, changes: { full_name: values.full_name } });
      await notify({ user_id: newUser.id, type: "account_created", title: "Your account is ready", message: "Your internship account was created. You can now log in.", link: "/intern" });
      toast.success(`Intern ${values.full_name} created successfully!`);
      setModalOpen(false);
      load();
    } catch (err) {
      console.error("Supervisor intern create failed:", err);
      const detail = err?.details || err?.hint || err?.code || "";
      toast.error(detail ? `${err.message} (${detail})` : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Assigned Interns"
        description="Interns under your supervision or created by you."
        action={<Button onClick={openCreate}>+ Add Intern</Button>}
      />
      <Card>
        <div className="border-b border-brand-100 p-4">
          <Input
            placeholder="Search intern name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {loading ? (
          <Spinner label="Loading interns…" />
        ) : (
          <Table
            columns={[
              {
                key: "full_name",
                header: "Name",
                render: (r) => (
                  <button onClick={() => setDetail(r)} className="text-left font-medium text-slate-800 hover:text-brand-700">
                    {r.full_name}
                  </button>
                ),
              },
              { key: "school", header: "Institution", render: (r) => r.institution?.institution_name ?? "—" },
              { key: "program", header: "Program", render: (r) => r.program?.program_name ?? "—" },
              { key: "department", header: "Department", render: (r) => r.department?.name ?? "—" },
              { key: "required_hours", header: "Required Hrs", render: (r) => r.required_hours ?? "—" },
              { key: "start", header: "Start", render: (r) => formatDate(r.start_date) },
              { key: "end", header: "End", render: (r) => formatDate(r.end_date) },
              {
                key: "status",
                header: "Status",
                render: (r) => <Badge tone={TONE[r.status] ?? "gray"}>{INTERN_STATUS_LABELS[r.status] ?? r.status}</Badge>,
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No interns assigned yet.</div>}
          />
        )}
      </Card>

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
              <Detail label="Institution" value={detail.institution?.institution_name} />
              <Detail label="Program" value={detail.program?.program_name} />
              <Detail label="Department" value={detail.department?.name} />
              <Detail label="Start" value={formatDate(detail.start_date)} />
              <Detail label="End" value={formatDate(detail.end_date)} />
              <Detail label="Required Hrs" value={detail.required_hours} />
              <Detail label="Status" value={INTERN_STATUS_LABELS[detail.status]} />
            </dl>
          </div>
        )}
      </Modal>

      {/* Create Intern Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title="Add Intern"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>Create Intern</Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name" error={errors.full_name?.message} {...register("full_name", { required: "Name is required" })} />
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register("email", {
                required: "Email is required",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
              })}
            />
            <Input
              label="Temporary Password"
              type="password"
              error={errors.password?.message}
              {...register("password", {
                required: "Password is required",
                minLength: { value: 8, message: "Password must be at least 8 characters" },
              })}
            />
            <Input label="Student Number" error={errors.student_number?.message} {...register("student_number", { required: "Student number is required" })} />
            <Input label="Contact Number" {...register("contact_number")} />
            <Input label="Emergency Contact" {...register("emergency_contact")} />
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
            <Input label="Start Date" type="date" error={errors.start_date?.message} {...register("start_date", { required: "Start date is required" })} />
            <Input label="End Date" type="date" {...register("end_date")} />
            <Input label="Required Hours" type="number" {...register("required_hours")} />
          </div>
          <p className="text-xs text-slate-500">
            The intern will receive these credentials and can log in immediately.
          </p>
        </form>
      </Modal>
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
