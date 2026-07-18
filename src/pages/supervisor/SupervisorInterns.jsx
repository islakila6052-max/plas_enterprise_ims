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
  school: "",
  course: "",
  start_date: "",
  end_date: "",
};

export default function SupervisorInterns() {
  const { profile, supervisorId, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
        data = data.filter((r) => r.full_name.toLowerCase().includes(q));
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
    formState: { errors },
  } = useForm({ defaultValues: EMPTY });

  function openCreate() {
    reset(EMPTY);
    setModalOpen(true);
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
        school: values.school,
        course: values.course,
        department_id: departmentId,
        supervisor_id: supervisorRecordId,
        created_by: user?.id,
        start_date: values.start_date,
        end_date: values.end_date || null,
        status: "active",
      });

      await recordAudit({ user_id: user?.id, action: "create", resource_type: "intern", resource_id: newUser?.id, changes: { full_name: values.full_name, supervisor_id } });
      await notify({ user_id: newUser.id, type: "account_created", title: "Your account is ready", message: "Your internship account was created. You can now log in.", link: "/intern" });
      toast.success(`Intern ${values.full_name} created successfully!`);
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
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
              { key: "school", header: "School", render: (r) => r.school ?? "—" },
              { key: "department", header: "Department", render: (r) => r.department?.name ?? "—" },
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
                <p className="text-sm text-slate-500">{detail.course} · {detail.school}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Student No." value={detail.student_number} />
              <Detail label="Email" value={detail.email} />
              <Detail label="Contact" value={detail.contact_number} />
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
            <Input label="School" error={errors.school?.message} {...register("school", { required: "School is required" })} />
            <Input label="Course" error={errors.course?.message} {...register("course", { required: "Course is required" })} />
            <Input label="Start Date" type="date" error={errors.start_date?.message} {...register("start_date", { required: "Start date is required" })} />
            <Input label="End Date" type="date" {...register("end_date")} />
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
