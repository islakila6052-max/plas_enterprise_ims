import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import { internService } from "@/services/internService";
import { evaluationService } from "@/services/evaluationService";
import { useAuth } from "@/contexts/AuthContext";
import {
  EVALUATION_CRITERIA,
  EVALUATION_RECOMMENDATIONS,
} from "@/lib/constants";
import { formatDate } from "@/utils/format";

export default function SupervisorEvaluations() {
  const { isConfigured, profile, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
  } = useForm();

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const sid = profile?.supervisor_id ?? user?.id;
      const res = await evaluationService.list({ supervisorId: sid, page: 1, pageSize: 100 });
      setRows(res.data);
      const internsRes = await internService.list({ supervisorId: sid, page: 1 });
      setInterns(internsRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, profile, user]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    reset({ intern_id: "", overall_rating: 3, final_recommendation: "recommend" });
    setModalOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      const sid = profile?.supervisor_id ?? user?.id;
      const criteria = {};
      EVALUATION_CRITERIA.forEach((c) => {
        criteria[c.key] = Number(values[c.key]) || 0;
      });
      await evaluationService.create({
        intern_id: values.intern_id,
        supervisor_id: sid,
        ...criteria,
        overall_rating: Number(values.overall_rating) || 0,
        comments: values.comments,
        final_recommendation: values.final_recommendation,
        status: "completed",
      });
      toast.success("Evaluation submitted.");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "intern",
      header: "Intern",
      render: (r) => r.intern?.full_name ?? "—",
    },
    {
      key: "overall",
      header: "Overall",
      render: (r) => r.overall_rating ?? "—",
    },
    {
      key: "rec",
      header: "Recommendation",
      render: (r) => (
        <Badge tone="brand">{r.final_recommendation ?? "—"}</Badge>
      ),
    },
    { key: "date", header: "Date", render: (r) => formatDate(r.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="Evaluate your assigned interns."
        action={<Button onClick={openCreate}>+ New Evaluation</Button>}
      />
      <Card>
        {loading ? (
          <Spinner label="Loading evaluations…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No evaluations yet.
              </div>
            }
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title="New Evaluation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>
              Submit
            </Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Select
            label="Intern"
            {...register("intern_id", { required: "Select an intern" })}>
            <option value="">Select intern…</option>
            {interns.map((i) => (
              <option key={i.id} value={i.id}>
                {i.full_name}
              </option>
            ))}
          </Select>
          {EVALUATION_CRITERIA.map((c) => (
            <Input
              key={c.key}
              label={`${c.label} (1-5)`}
              type="number"
              min={1}
              max={5}
              {...register(c.key, { required: true })}
            />
          ))}
          <Input
            label="Overall rating (1-5)"
            type="number"
            min={1}
            max={5}
            {...register("overall_rating", { required: true })}
          />
          <Select
            label="Final recommendation"
            {...register("final_recommendation", { required: true })}>
            {EVALUATION_RECOMMENDATIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Textarea label="Comments" {...register("comments")} />
        </form>
      </Modal>
    </div>
  );
}
