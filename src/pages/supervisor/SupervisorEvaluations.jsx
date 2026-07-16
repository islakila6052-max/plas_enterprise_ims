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
import { EVALUATION_CRITERIA, EVALUATION_RECOMMENDATIONS } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const REC_LABEL = Object.fromEntries(EVALUATION_RECOMMENDATIONS.map((r) => [r.value, r.label]));

export default function SupervisorEvaluations() {
  const { profile, supervisorId } = useAuth();
  const [rows, setRows] = useState([]);
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
  } = useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sid = supervisorId;
      const res = await evaluationService.list({ supervisorId: sid, page: 1, pageSize: 100 });
      setRows(res.data);
      const internsRes = await internService.list({ supervisorId: sid, page: 1 });
      setInterns(internsRes.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [supervisorId]);

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
      const sid = supervisorId;
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
        status: "pending",
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
      render: (r) => (
        <button onClick={() => setDetail(r)} className="text-left font-medium text-slate-800 hover:text-brand-700">
          {r.intern?.full_name ?? "—"}
        </button>
      ),
    },
    { key: "overall", header: "Overall", render: (r) => `${r.overall_rating ?? "—"}/5` },
    {
      key: "rec",
      header: "Recommendation",
      render: (r) => <Badge tone="brand">{REC_LABEL[r.final_recommendation] ?? r.final_recommendation ?? "—"}</Badge>,
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
            empty={<div className="p-4 text-center text-sm text-slate-500">No evaluations yet.</div>}
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
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>Submit</Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Select label="Intern" {...register("intern_id", { required: "Select an intern" })}>
            <option value="">Select intern…</option>
            {interns.map((i) => (
              <option key={i.id} value={i.id}>{i.full_name}</option>
            ))}
          </Select>
          {EVALUATION_CRITERIA.map((c) => (
            <Input key={c.key} label={`${c.label} (1-5)`} type="number" min={1} max={5} {...register(c.key, { required: true })} />
          ))}
          <Input label="Overall rating (1-5)" type="number" min={1} max={5} {...register("overall_rating", { required: true })} />
          <Select label="Final recommendation" {...register("final_recommendation", { required: true })}>
            {EVALUATION_RECOMMENDATIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
          <Textarea label="Comments" {...register("comments")} />
        </form>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Evaluation Details" size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800">{detail.intern?.full_name}</p>
              <Badge tone="brand">{REC_LABEL[detail.final_recommendation] ?? detail.final_recommendation}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {EVALUATION_CRITERIA.map((c) => (
                <div key={c.key} className="flex items-center justify-between rounded-lg bg-brand-50/50 px-3 py-2 text-sm">
                  <span className="text-slate-600">{c.label}</span>
                  <span className="font-semibold text-slate-800">{detail[c.key] ?? "—"}/5</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <span className="text-slate-600">Overall: </span>
              <span className="font-semibold text-brand-700">{detail.overall_rating ?? "—"}/5</span>
            </div>
            {detail.comments && (
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">Comments</p>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{detail.comments}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
