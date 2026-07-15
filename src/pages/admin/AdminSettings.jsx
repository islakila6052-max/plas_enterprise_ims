import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { departmentService } from "@/services/departmentService";
import { settingsService } from "@/services/settingsService";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminSettings() {
  const { isConfigured } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { name: "", description: "" } });

  const {
    register: regSettings,
    handleSubmit: submitSettings,
    reset: resetSettings,
  } = useForm();

  useEffect(() => {
    if (!isConfigured) return setLoading(false);
    departmentService
      .list()
      .then(setDepartments)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    settingsService
      .get()
      .then((s) => {
        if (s)
          resetSettings({
            company_name: s.company_name ?? "",
            internship_duration: s.internship_duration ?? "",
            required_hours: s.required_hours ?? 300,
          });
      })
      .catch(() => {});
  }, [isConfigured, resetSettings]);

  function openCreate() {
    setEditing(null);
    reset({ name: "", description: "" });
    setModalOpen(true);
  }
  function openEdit(d) {
    setEditing(d);
    reset({ name: d.name, description: d.description ?? "" });
    setModalOpen(true);
  }

  async function onDeptSubmit(values) {
    setSaving(true);
    try {
      if (editing) await departmentService.update(editing.id, values);
      else await departmentService.create(values);
      toast.success("Department saved.");
      setModalOpen(false);
      const list = await departmentService.list();
      setDepartments(list);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeDept(d) {
    if (!confirm(`Delete department "${d.name}"?`)) return;
    try {
      await departmentService.remove(d.id);
      setDepartments((prev) => prev.filter((x) => x.id !== d.id));
      toast.success("Department deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function onSettingsSubmit(values) {
    try {
      await settingsService.upsert({
        company_name: values.company_name,
        internship_duration: values.internship_duration,
        required_hours: Number(values.required_hours) || 0,
      });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <Spinner label="Loading settings…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage departments and company information."
      />

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">Departments</h3>
          <Button onClick={openCreate}>+ Add Department</Button>
        </div>
        <Table
          columns={[
            { key: "name", header: "Name" },
            {
              key: "description",
              header: "Description",
              render: (d) => d.description || "—",
            },
            {
              key: "actions",
              header: "Actions",
              render: (d) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => removeDept(d)}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
          rows={departments}
          rowKey={(d) => d.id}
          empty={
            <div className="p-4 text-center text-sm text-slate-500">
              No departments yet.
            </div>
          }
        />
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">
            Company Information
          </h3>
        </div>
        <form
          onSubmit={submitSettings(onSettingsSubmit)}
          className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Company name"
              {...regSettings("company_name", { required: "Required" })}
            />
            <Input
              label="Internship duration"
              placeholder="e.g. 6 months"
              {...regSettings("internship_duration")}
            />
            <Input
              label="Required hours"
              type="number"
              {...regSettings("required_hours", { required: "Required" })}
            />
          </div>
          <Button type="submit">Save Settings</Button>
        </form>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Department" : "Add Department"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onDeptSubmit)} loading={saving}>
              Save
            </Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onDeptSubmit)}>
          <Input
            label="Name"
            error={errors.name?.message}
            {...register("name", { required: "Name is required" })}
          />
          <Textarea label="Description" {...register("description")} />
        </form>
      </Modal>
    </div>
  );
}
