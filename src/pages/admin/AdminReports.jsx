import { useState } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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

  async function fetchData() {
    switch (type) {
      case "intern_list": {
        const res = await internService.list({ page: 1 });
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
        const res = await internService.list({ page: 1 });
        return res.data.map((r) => ({
          Name: r.full_name,
          RequiredHours: r.required_hours,
        }));
      }
      default:
        return [];
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

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and export internship reports."
      />
      <Card>
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Select report
            </p>
            <div className="flex flex-wrap gap-2">
              {REPORTS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setType(r.key)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    type === r.key
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={exportExcel} loading={busy}>
              Export Excel
            </Button>
            <Button variant="secondary" onClick={exportPDF} loading={busy}>
              Export PDF
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
