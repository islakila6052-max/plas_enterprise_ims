// src/pages/supervisor/SupervisorInterns.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { Input, Select } from "@/components/ui/Input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { internService } from "@/services/internService";
import { supervisorService } from "@/services/supervisorService";
import { institutionService } from "@/services/institutionService";
import { programService } from "@/services/programService";
import { userService } from "@/services/userService";
import { useAuth } from "@/contexts/AuthContext";
import { INTERN_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/utils/format";
import { recordAudit, notify } from "@/services/activityService";

const TONE = { active: "green", completed: "blue", archived: "gray" };

export default function SupervisorInterns() {
  const { supervisorId, user, profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);

  // Add Intern modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [institutionLabel, setInstitutionLabel] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programLabel, setProgramLabel] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      student_number: "",
      contact_number: "",
      emergency_contact: "",
      start_date: "",
      end_date: "",
      required_hours: 300,
    },
  });

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

  function openCreate() {
    reset({
      full_name: "",
      email: "",
      password: "",
      student_number: "",
      contact_number: "",
      emergency_contact: "",
      start_date: "",
      end_date: "",
      required_hours: 300,
    });
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
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      // Resolve the supervisor's department
      const supRow = await supervisorService.getById(supervisorId);
      const departmentId = supRow?.department_id ?? null;

      // Create auth user through the API
      const newUser = await userService.createAuthUser({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        role: "intern",
      });

      const payload = {
        profile_id: newUser.id,
        full_name: values.full_name,
        email: values.email,
        student_number: values.student_number || null,
        contact_number: values.contact_number || null,
        emergency_contact: values.emergency_contact || null,
        department_id: departmentId,
        supervisor_id: supervisorId,
        institution_id: selectedInstitutionId || null,
        program_id: selectedProgramId || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        required_hours: Number(values.required_hours) || 300,
        status: "active",
        created_by: user?.id,
      };

      await internService.create(payload);

      await recordAudit({
        user_id: user?.id,
        action: "create",
        resource_type: "intern",
        resource_id: newUser.id,
        changes: { full_name: values.full_name, supervisor_id: supervisorId },
      });

      // Notify the new intern
      if (newUser?.id) {
        await notify({
          user_id: newUser.id,
          type: "account_created",
          title: "Your account is ready",
          message: "Your internship account was created. You can now log in.",
          link: "/intern",
        }).catch(() => {});
      }

      toast.success("Intern added.");
      setModalOpen(false);
      load();
    } catch (err) {
      console.error("Intern creation failed:", err);
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
        description="Interns under your supervision."
        action={<Button onClick={openCreate}>+ Add Intern</Button>}
      />
      <Card>
        <div className="border-b border-brand-100 p-4">
          <input
            type="text"
            placeholder="Search intern name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

      {/* Add Intern Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title="Add Intern"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>
              Create
            </Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full Name"
              error={errors.full_name?.message}
              {...register("full_name", { required: "Name is required" })}
            />
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register("email", {
                required: "Email is required",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
              })}
            />
          </div>
          <Input
            label="Temporary Password"
            type="password"
            error={errors.password?.message}
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Password must be at least 8 characters" },
            })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Student Number" {...register("student_number")} />
            <Input label="Contact Number" {...register("contact_number")} />
          </div>
          <Input label="Emergency Contact" {...register("emergency_contact")} />
          <SearchableSelect
            label="Institution"
            value={selectedInstitutionId}
            displayText={institutionLabel}
            placeholder="Search institutions…"
            onSearch={onInstitutionSearch}
            onSelect={handleInstitutionSelect}
          />
          {selectedInstitutionId && (
            <SearchableSelect
              label="Program"
              value={selectedProgramId}
              displayText={programLabel}
              placeholder="Search programs…"
              onSearch={onProgramSearch}
              onSelect={(opt) => {
                setSelectedProgramId(opt.value);
                setProgramLabel(opt.label);
              }}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start Date" type="date" {...register("start_date")} />
            <Input label="End Date" type="date" {...register("end_date")} />
          </div>
          <Input
            label="Required Hours"
            type="number"
            {...register("required_hours", { valueAsNumber: true })}
          />
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
