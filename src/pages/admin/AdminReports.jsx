// src/pages/admin/AdminReports.jsx
import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { internService } from "@/services/internService";
import { attendanceService } from "@/services/attendanceService";
import { journalService } from "@/services/journalService";
import { evaluationService } from "@/services/evaluationService";
import { settingsService } from "@/services/settingsService";
import { formatDate, formatTime, formatHours } from "@/utils/format";

const REPORTS = [
  { key: "intern_list", label: "Intern List" },
  { key: "attendance", label: "Attendance" },
  { key: "journals", label: "Daily Journals" },
  { key: "evaluations", label: "Evaluation Summary" },
  { key: "hours", label: "Hours Rendered" },
];

export default function AdminReports() {
  const [type, setType] = useState("intern_list");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  async function fetchData() {
    switch (type) {
      case "intern_list": {
        const res = await internService.list({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Name: r.full_name,
          "Student No.": r.student_number,
          Institution: r.institution?.institution_name ?? "",
          Program: r.program?.program_name ?? "",
          Status: r.status,
          "Required Hours": r.required_hours,
        }));
      }
      case "attendance": {
        const res = await attendanceService.adminList({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Intern: r.intern?.full_name,
          Date: formatDate(r.date),
          "Time In": r.time_in ? formatTime(r.time_in) : "—",
          "Time Out": r.time_out ? formatTime(r.time_out) : "—",
          Hours: formatHours(r.total_hours),
          Status: r.status,
        }));
      }
      case "journals": {
        const res = await journalService.list({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Intern: r.intern?.full_name,
          Date: formatDate(r.date),
          "Hours Worked": r.hours_worked,
          "Status": r.status,
        }));
      }
      case "evaluations": {
        const res = await evaluationService.list({ page: 1, pageSize: 1000 });
        return res.data.map((r) => ({
          Intern: r.intern?.full_name,
          "Overall Rating": `${r.overall_rating ?? "—"}/5`,
          "Recommendation": r.final_recommendation,
        }));
      }
      case "hours": {
        const [internsRes, attRes] = await Promise.all([
          internService.list({ page: 1, pageSize: 1000 }),
          attendanceService.adminList({ page: 1, pageSize: 5000 }),
        ]);
        const renderedByIntern = (attRes.data ?? []).reduce((acc, r) => {
          if (r.intern_id) {
            acc[r.intern_id] =
              (acc[r.intern_id] ?? 0) + (Number(r.total_hours) || 0);
          }
          return acc;
        }, {});
        return (internsRes.data ?? []).map((r) => ({
          Name: r.full_name,
          "Required Hours": r.required_hours,
          "Rendered Hours": formatHours(renderedByIntern[r.id] ?? 0),
        }));
      }
      default:
        return [];
    }
  }

  async function generatePreview() {
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

  async function exportPDF() {
    setBusy(true);
    try {
      const data = await fetchData();
      if (!data.length) {
        toast.error("No data to export.");
        return;
      }

      // Fetch company name for the header.
      let companyName = "Internship Management System";
      try {
        const settings = await settingsService.get();
        if (settings?.company_name) companyName = settings.company_name;
      } catch { /* use default */ }

      const jsPDF = (await import("jspdf")).default;
      const { autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: data.length > 5 ? "landscape" : "portrait" });

      const reportLabel = REPORTS.find((r) => r.key === type)?.label ?? type;
      const generated = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      const rows = data.map((d) => Object.values(d));
      const rawHeaders = Object.keys(data[0]);
      // Format headers: StudentNo → Student No., RequiredHours → Required Hours, etc.
      const headers = rawHeaders.map((h) =>
        h.replace(/([A-Z])/g, " $1").replace(/^\s/, "").replace(/\s+/g, " ").trim(),
      );

      // ── Header ──
      doc.setFontSize(16);
      doc.setTextColor(21, 128, 61); // brand-700
      doc.text(companyName, 14, 18);
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(`Report: ${reportLabel}`, 14, 26);
      doc.text(`Generated: ${generated}  ·  ${data.length} records`, 14, 33);

      // ── Table ──
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 40,
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [21, 128, 61],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          textColor: [51, 65, 85],
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [240, 253, 244],
        },
        columnStyles: {
          // Left-align text columns, center numeric columns.
        },
        didDrawPage: (hookData) => {
          // Footer with page number on every page.
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${hookData.pageNumber}`,
            doc.internal.pageSize.getWidth() - 20,
            doc.internal.pageSize.getHeight() - 10,
            { align: "right" },
          );
          doc.text(
            `IMS Report — ${reportLabel}`,
            14,
            doc.internal.pageSize.getHeight() - 10,
          );
        },
      });

      doc.save(`IMS-${type}-Report.pdf`);
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
            <Button variant="secondary" onClick={exportPDF} loading={busy}>Download PDF</Button>
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
