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
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/utils/format";

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
      const [supData, deptData] = await Promise.all([
        supervisorService.list(),
        departmentService.list(),
      ]);
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
        toast.success("Supervisor updated.");
      } else {
        // Create new supervisor with auth user
        // Step 1: Create auth user via API
        const response = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            user_metadata: {
              full_name: values.full_name,
              role: "supervisor",
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create user");
        }

        const { user: newUser } = await response.json();

        // Step 2: Update profile role
        await supabase
          .from("profiles")
          .update({
            role: "supervisor",
            full_name: values.full_name,
          })
          .eq("id", newUser.id);

        // Step 3: Create supervisor record
        await supervisorService.create({
          profile_id: newUser.id,
          department_id: values.department_id,
          full_name: values.full_name,
          email: values.email,
          created_by: user?.id,
        });

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
        message={`Delete ${confirm?.full_name || confirm?.profile?.full_name}? This will also remove their access.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
}
