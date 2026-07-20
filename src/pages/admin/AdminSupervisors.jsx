import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { departmentService } from "@/services/departmentService";
import { supervisorService } from "@/services/supervisorService";
import { userService } from "@/services/userService";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/utils/format";
import { recordAudit } from "@/services/activityService";

export default function AdminSupervisors() {
  const { user } = useAuth();
  const [supervisors, setSupervisors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

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
      department_id: "",
    },
  });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load separately so one failure doesn't block the other.
      let supData = [];
      let deptData = [];

      try {
        supData = await supervisorService.list();
      } catch (err) {
        toast.error("Failed to load supervisors: " + err.message);
      }

      try {
        deptData = await departmentService.list();
      } catch (err) {
        toast.error("Failed to load departments: " + err.message);
      }

      setSupervisors(supData);
      setDepartments(deptData);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    reset({ full_name: "", email: "", password: "", department_id: "" });
    setModalOpen(true);
  }

  function openEdit(sup) {
    setEditing(sup);
    reset({
      full_name: sup.full_name || sup.profile?.full_name || "",
      email: sup.email || sup.profile?.email || "",
      password: "",
      department_id: sup.department_id || "",
    });
    setModalOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      if (editing) {
        // Update supervisor
        await supervisorService.update(editing.id, {
          full_name: values.full_name,
          email: values.email,
          department_id: values.department_id,
        });
        await recordAudit({ user_id: user?.id, action: "update", resource_type: "supervisor", resource_id: editing.id, changes: { full_name: values.full_name } });
        toast.success("Supervisor updated.");
      } else {
        // Create new supervisor with auth user
        // Step 1: Create auth user via the serverless admin API.
        const newUser = await userService.createAuthUser({
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          role: "supervisor",
        });

        // Step 2: Update profile role + name (the create-user API already
        // sets these via user_metadata, but keep it in sync defensively).
        if (supabase && newUser?.id) {
          await supabase
            .from("profiles")
            .update({
              role: "supervisor",
              full_name: values.full_name,
            })
            .eq("id", newUser.id);
        } else if (!newUser?.id) {
          throw new Error("User creation did not return an id. Check the create-user API response.");
        }

        // Step 3: Create supervisor record
        await supervisorService.create({
          profile_id: newUser.id,
          department_id: values.department_id,
          full_name: values.full_name,
          email: values.email,
          created_by: user?.id,
        });

        await recordAudit({ user_id: user?.id, action: "create", resource_type: "supervisor", resource_id: newUser?.id, changes: { full_name: values.full_name, department_id: values.department_id } });
        toast.success(`Supervisor ${values.full_name} created successfully!`);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSupervisor() {
    try {
      await supervisorService.remove(confirm.id);
      await recordAudit({ user_id: user?.id, action: "delete", resource_type: "supervisor", resource_id: confirm.id, changes: { full_name: confirm?.full_name || confirm?.profile?.full_name } });
      toast.success("Supervisor removed.");
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
      render: (r) => r.profile?.full_name || r.full_name || "—",
    },
    {
      key: "email",
      header: "Email",
      render: (r) => r.profile?.email || r.email || "—",
    },
    {
      key: "department",
      header: "Department",
      render: (r) => r.department?.name || "Unassigned",
    },
    {
      key: "created_at",
      header: "Created",
      render: (r) => formatDate(r.created_at),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirm(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Supervisor Management"
        description="Create and manage department supervisors."
        action={<Button onClick={openCreate}>+ Create Supervisor</Button>}
      />

      <Card>
        {loading ? (
          <Spinner label="Loading supervisors..." />
        ) : (
          <Table
            columns={columns}
            rows={supervisors}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No supervisors created yet.
              </div>
            }
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={editing ? "Edit Supervisor" : "Create Supervisor"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>
              {editing ? "Update" : "Create"}
            </Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
          {!editing && (
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
          )}
          <Select
            label="Department"
            error={errors.department_id?.message}
            {...register("department_id", {
              required: "Department is required",
            })}>
            <option value="">Select Department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {!editing && (
            <p className="text-xs text-slate-500">
              Supervisor will receive these credentials and can create interns.
            </p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={removeSupervisor}
        title="Delete Supervisor?"
        message={`Delete ${confirm?.full_name || confirm?.profile?.full_name}? This removes the supervisor and ALL their evaluations, journals, and notifications, disables their login, and unassigns their interns (intern records are kept). This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
}
