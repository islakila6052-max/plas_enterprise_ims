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
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { departmentService } from "@/services/departmentService";
import { settingsService } from "@/services/settingsService";
import { resetDemoDB } from "@/lib/mockBackend";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminSettings() {
  const { isConfigured } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

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

  function handleResetDemo() {
    resetDemoDB();
    toast.success("Demo data reset. Reloading…");
    setTimeout(() => window.location.reload(), 800);
  }

  if (loading) return <Spinner label="Loading settings…" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage departments and company information." />

      <Card>
        <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">Departments</h3>
          <Button onClick={openCreate}>+ Add Department</Button>
        </div>
        <Table
          columns={[
            { key: "name", header: "Name" },
            { key: "description", header: "Description", render: (d) => d.description || "—" },
            {
              key: "actions",
              header: "Actions",
              render: (d) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => removeDept(d)}>Delete</Button>
                </div>
              ),
            },
          ]}
          rows={departments}
          rowKey={(d) => d.id}
          empty={<div className="p-4 text-center text-sm text-slate-500">No departments yet.</div>}
        />
      </Card>

      <Card>
        <div className="border-b border-brand-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">Company Information</h3>
        </div>
        <form onSubmit={submitSettings(onSettingsSubmit)} className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Company name" {...regSettings("company_name", { required: "Required" })} />
            <Input label="Internship duration" placeholder="e.g. 6 months" {...regSettings("internship_duration")} />
            <Input label="Required hours" type="number" {...regSettings("required_hours", { required: "Required" })} />
          </div>
          <Button type="submit">Save Settings</Button>
        </form>
      </Card>

      <Card>
        <div className="border-b border-brand-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">Theme</h3>
          <p className="mt-0.5 text-sm text-slate-500">The system uses a green palette by default.</p>
        </div>
        <div className="flex items-center gap-3 p-5">
          <span className="h-8 w-8 rounded-lg bg-brand-700" />
          <span className="h-8 w-8 rounded-lg bg-brand-600" />
          <span className="h-8 w-8 rounded-lg bg-brand-500" />
          <span className="h-8 w-8 rounded-lg bg-brand-100" />
          <span className="text-sm text-slate-500">Primary #15803D · Secondary #16A34A · Accent #22C55E</span>
        </div>
      </Card>

      {!isConfigured && (
        <Card>
          <div className="border-b border-brand-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">Demo Data</h3>
          </div>
          <div className="flex items-center justify-between p-5">
            <p className="text-sm text-slate-500">
              Running in demo mode with sample data. Reset to restore the original seed data.
            </p>
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>Reset Demo Data</Button>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Department" : "Add Department"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onDeptSubmit)} loading={saving}>Save</Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onDeptSubmit)}>
          <Input label="Name" error={errors.name?.message} {...register("name", { required: "Name is required" })} />
          <Textarea label="Description" {...register("description")} />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleResetDemo}
        title="Reset demo data?"
        message="This restores the original sample data and clears any changes you made in this session."
        confirmLabel="Reset"
        tone="primary"
      />
    </div>
  );
}
