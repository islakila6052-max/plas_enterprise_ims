import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { internService } from "@/services/internService";
import { attendanceService } from "@/services/attendanceService";
import { journalService } from "@/services/journalService";
import { evaluationService } from "@/services/evaluationService";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatHours } from "@/utils/format";

const REPORTS = [
  { key: "intern_list", label: "Intern List" },
  { key: "attendance", label: "Attendance" },
  { key: "journals", label: "Daily Journals" },
  { key: "evaluations", label: "Evaluation Summary" },
  { key: "hours", label: "Hours Rendered" },
];

export default function AdminReports() {
  const { isConfigured } = useAuth();
  const [type, setType] = useState("intern_list");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  async function fetchData() {
    switch (type) {
      case "intern_list": {
        const res = await internService.list({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Name: r.full_name,
          StudentNo: r.student_number,
          School: r.school,
          Course: r.course,
          Status: r.status,
          RequiredHours: r.required_hours,
        }));
      }
      case "attendance": {
        const res = await attendanceService.adminList({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Intern: r.intern?.full_name,
          Date: formatDate(r.date),
          TimeIn: r.time_in,
          TimeOut: r.time_out,
          Hours: formatHours(r.total_hours),
          Status: r.status,
        }));
      }
      case "journals": {
        const res = await journalService.list({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Intern: r.intern?.full_name,
          Date: formatDate(r.date),
          Hours: r.hours_worked,
          Status: r.status,
        }));
      }
      case "evaluations": {
        const res = await evaluationService.list({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Intern: r.intern?.full_name,
          Overall: r.overall_rating,
          Recommendation: r.final_recommendation,
        }));
      }
      case "hours": {
        const [internsRes, attRes] = await Promise.all([
          internService.list({ page: 1, pageSize: 1000 }),
          attendanceService.adminList({ page: 1, pageSize: 5000 }),
        ]);
        const renderedByIntern = (attRes.data ?? []).reduce((acc, r) => {
          if (r.intern?.full_name) {
            acc[r.intern.full_name] =
              (acc[r.intern.full_name] ?? 0) + (Number(r.total_hours) || 0);
          }
          return acc;
        }, {});
        return internsRes.data.map((r) => ({
          Name: r.full_name,
          RequiredHours: r.required_hours,
          RenderedHours: Math.round((renderedByIntern[r.full_name] ?? 0) * 100) / 100,
        }));
      }
      default:
        return [];
    }
  }

  async function generatePreview() {
    if (!isConfigured) return toast.error("Connect Supabase to export.");
    setBusy(true);
    try {
      const data = await fetchData();
      setPreview(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportExcel() {
    if (!isConfigured) return toast.error("Connect Supabase to export.");
    setBusy(true);
    try {
      const data = await fetchData();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `ims-${type}-report.xlsx`);
      toast.success("Excel exported.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportPDF() {
    if (!isConfigured) return toast.error("Connect Supabase to export.");
    setBusy(true);
    try {
      const data = await fetchData();
      const doc = new jsPDF();
      const headers = data.length ? Object.keys(data[0]) : [];
      const rows = data.map((d) => Object.values(d));
      doc.text(`IMS Report — ${type}`, 14, 16);
      doc.autoTable({ head: [headers], body: rows, startY: 22 });
      doc.save(`ims-${type}-report.pdf`);
      toast.success("PDF exported.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function printPreview() {
    if (!preview || !preview.length) return toast.error("Generate a preview first.");
    const headers = Object.keys(preview[0]);
    const rows = preview.map((d) => Object.values(d));
    const html = `
      <h2>IMS Report — ${type}</h2>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-size:12px">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
    const w = window.open("", "_blank");
    w.document.write(`<html><body>${html}</body></html>`);
    w.document.close();
    w.print();
  }

  const previewColumns = useMemo(() => {
    if (!preview || !preview.length) return [];
    return Object.keys(preview[0]).map((k) => ({ key: k, header: k }));
  }, [preview]);

  return (
    <div>
      <PageHeader title="Reports" description="Generate and export internship reports." />
      <Card>
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Select report</p>
            <div className="flex flex-wrap gap-2">
              {REPORTS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setType(r.key);
                    setPreview(null);
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    type === r.key
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-brand-100 text-slate-600 hover:bg-brand-50"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={generatePreview} loading={busy}>Preview</Button>
            <Button variant="secondary" onClick={exportExcel} loading={busy}>Export Excel</Button>
            <Button variant="secondary" onClick={exportPDF} loading={busy}>Export PDF</Button>
            <Button variant="ghost" onClick={printPreview}>Print</Button>
          </div>
        </div>
      </Card>

      {preview && (
        <Card className="mt-6">
          <div className="border-b border-brand-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">
              Preview — {REPORTS.find((r) => r.key === type)?.label}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">{preview.length} records</p>
          </div>
          <Table columns={previewColumns} rows={preview} rowKey={(_, i) => i} />
        </Card>
      )}
    </div>
  );
}
