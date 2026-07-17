import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { internService } from "@/services/internService";
import { useAuth } from "@/contexts/AuthContext";
import { INTERN_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { active: "green", completed: "blue", archived: "gray" };

export default function SupervisorInterns() {
  const { profile, supervisorId } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
      school: "",
      course: "",
      start_date: "",
      end_date: "",
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internService.list({
        supervisorId: supervisorId,
        page: 1,
        pageSize: 100,
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
  }, [supervisorId, search]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    reset({
      full_name: "",
      email: "",
      password: "",
      student_number: "",
      school: "",
      course: "",
      start_date: "",
      end_date: "",
    });
    setModalOpen(true);
  }

  async function onCreateIntern(values) {
    setSaving(true);
    try {
      // Step 1: Create auth user via API
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          user_metadata: {
            full_name: values.full_name,
            role: "intern",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }

      const { user: newUser } = await response.json();

      // Step 2: Get supervisor's department
      const { data: supData, error: supError } = await supabase
        .from("supervisors")
        .select("department_id")
        .eq("id", supervisorId)
        .single();

      if (supError) throw supError;

      // Step 3: Create intern record
      await internService.create({
        profile_id: newUser.id,
        full_name: values.full_name,
        email: values.email,
        student_number: values.student_number,
        school: values.school,
        course: values.course,
        department_id: supData.department_id,
        supervisor_id: supervisorId,
        start_date: values.start_date,
        end_date: values.end_date || null,
        created_by: supervisorId,
        status: "active",
      });

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
        description="Manage interns under your supervision."
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
                  <button
                    onClick={() => setDetail(r)}
                    className="text-left font-medium text-slate-800 hover:text-brand-700">
                    {r.full_name}
                  </button>
                ),
              },
              {
                key: "school",
                header: "School",
                render: (r) => r.school ?? "—",
              },
              {
                key: "department",
                header: "Department",
                render: (r) => r.department?.name ?? "—",
              },
              {
                key: "start",
                header: "Start",
                render: (r) => formatDate(r.start_date),
              },
              {
                key: "end",
                header: "End",
                render: (r) => formatDate(r.end_date),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <Badge tone={TONE[r.status] ?? "gray"}>
                    {INTERN_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No interns assigned yet.
              </div>
            }
          />
        )}
      </Card>

      {/* Create Intern Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Intern"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onCreateIntern)} loading={saving}>
              Create Intern
            </Button>
          </>
        }>
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={handleSubmit(onCreateIntern)}>
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
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Enter a valid email",
              },
            })}
          />
          <Input
            label="Temporary Password"
            type="password"
            error={errors.password?.message}
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters",
              },
            })}
          />
          <Input
            label="Student Number"
            error={errors.student_number?.message}
            {...register("student_number", {
              required: "Student number is required",
            })}
          />
          <Input
            label="School"
            error={errors.school?.message}
            {...register("school", { required: "School is required" })}
          />
          <Input
            label="Course"
            error={errors.course?.message}
            {...register("course", { required: "Course is required" })}
          />
          <Input
            label="Start Date"
            type="date"
            error={errors.start_date?.message}
            {...register("start_date", { required: "Start date is required" })}
          />
          <Input label="End Date" type="date" {...register("end_date")} />
          <div className="col-span-2 text-xs text-slate-500">
            Intern will receive these credentials and can log in immediately.
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Intern Details"
        size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={detail.full_name} size="lg" />
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  {detail.full_name}
                </p>
                <p className="text-sm text-slate-500">
                  {detail.course} · {detail.school}
                </p>
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
              <Detail
                label="Status"
                value={INTERN_STATUS_LABELS[detail.status]}
              />
            </dl>
          </div>
        )}
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
