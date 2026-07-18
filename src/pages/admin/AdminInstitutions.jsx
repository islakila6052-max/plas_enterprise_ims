// src/pages/admin/AdminInstitutions.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";
import InstitutionTable from "@/components/institutions/InstitutionTable";
import InstitutionModal from "@/components/institutions/InstitutionModal";
import ProgramTable from "@/components/institutions/ProgramTable";
import ProgramModal from "@/components/institutions/ProgramModal";
import DatabaseConnectionCard from "@/components/institutions/DatabaseConnectionCard";
import { institutionService } from "@/services/institutionService";
import { programService, uploadMoa, moaUrl } from "@/services/programService";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 8;

export default function AdminInstitutions() {
  const { isConfigured } = useAuth();

  // Institutions
  const [institutions, setInstitutions] = useState([]);
  const [instLoading, setInstLoading] = useState(true);
  const [instSearch, setInstSearch] = useState("");
  const [instPage, setInstPage] = useState(1);
  const [instModalOpen, setInstModalOpen] = useState(false);
  const [editingInst, setEditingInst] = useState(null);
  const [savingInst, setSavingInst] = useState(false);
  const [instToDelete, setInstToDelete] = useState(null);

  // Programs
  const [programs, setPrograms] = useState([]);
  const [progLoading, setProgLoading] = useState(true);
  const [progSearch, setProgSearch] = useState("");
  const [progPage, setProgPage] = useState(1);
  const [filterInstitutionId, setFilterInstitutionId] = useState("");
  const [progModalOpen, setProgModalOpen] = useState(false);
  const [editingProg, setEditingProg] = useState(null);
  const [savingProg, setSavingProg] = useState(false);
  const [progToDelete, setProgToDelete] = useState(null);

  const loadInstitutions = useCallback(async () => {
    setInstLoading(true);
    try {
      const rows = await institutionService.list({ search: instSearch });
      setInstitutions(rows);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setInstLoading(false);
    }
  }, [instSearch]);

  const loadPrograms = useCallback(async () => {
    setProgLoading(true);
    try {
      const rows = await programService.list({
        institutionId: filterInstitutionId,
        search: progSearch,
      });
      setPrograms(rows);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProgLoading(false);
    }
  }, [filterInstitutionId, progSearch]);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // Reset to page 1 when filters change.
  useEffect(() => setInstPage(1), [instSearch]);
  useEffect(() => setProgPage(1), [progSearch, filterInstitutionId]);

  // ---- Institution handlers ----
  function openCreateInst() {
    setEditingInst(null);
    setInstModalOpen(true);
  }
  function openEditInst(r) {
    setEditingInst(r);
    setInstModalOpen(true);
  }
  async function onInstSubmit(values) {
    setSavingInst(true);
    try {
      if (editingInst) {
        await institutionService.update(editingInst.institution_id, values);
        toast.success("Institution updated.");
      } else {
        await institutionService.create(values);
        toast.success("Institution added.");
      }
      setInstModalOpen(false);
      await loadInstitutions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingInst(false);
    }
  }
  async function confirmDeleteInst() {
    try {
      await institutionService.remove(instToDelete.institution_id);
      toast.success("Institution deleted (programs removed too).");
      setInstToDelete(null);
      await loadInstitutions();
      await loadPrograms();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // ---- Program handlers ----
  function openCreateProg(preselectedId = filterInstitutionId) {
    setEditingProg(null);
    setProgModalOpen(true);
    // defaultInstitutionId is passed via state below
    setFilterInstitutionId(preselectedId || filterInstitutionId);
  }
  function openEditProg(r) {
    setEditingProg(r);
    setProgModalOpen(true);
  }
  async function onProgSubmit({ values, file }) {
    setSavingProg(true);
    try {
      let memo_of_agreement = editingProg?.memo_of_agreement ?? null;
      if (file) {
        memo_of_agreement = await uploadMoa(file, values.institution_id);
      }
      if (editingProg) {
        await programService.update(editingProg.program_id, { ...values, memo_of_agreement });
        toast.success("Program updated.");
      } else {
        await programService.create({ ...values, memo_of_agreement });
        toast.success("Program added.");
      }
      setProgModalOpen(false);
      await loadPrograms();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingProg(false);
    }
  }
  async function confirmDeleteProg() {
    try {
      await programService.remove(progToDelete.program_id);
      toast.success("Program deleted.");
      setProgToDelete(null);
      await loadPrograms();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function viewMoa(prog) {
    if (!prog.memo_of_agreement) return;
    const url = await moaUrl(prog.memo_of_agreement);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open MOA.");
  }

  // Pagination slices
  const instTotal = institutions.length;
  const instRows = institutions.slice((instPage - 1) * PAGE_SIZE, instPage * PAGE_SIZE);
  const progTotal = programs.length;
  const progRows = programs.slice((progPage - 1) * PAGE_SIZE, progPage * PAGE_SIZE);

  if (instLoading && programs.length === 0 && !isConfigured) {
    // still render; demo mode shows empty states
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutions"
        description="Manage educational institutions, their academic programs, and system configuration."
      />

      {/* Section 1 — Institution Management */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-brand-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-800">Institution Management</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Search institutions…"
              value={instSearch}
              onChange={(e) => setInstSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={openCreateInst}>+ Add Institution</Button>
          </div>
        </div>
        <InstitutionTable
          rows={instRows}
          loading={instLoading}
          onEdit={openEditInst}
          onDelete={setInstToDelete}
          onViewPrograms={(r) => {
            setFilterInstitutionId(r.institution_id);
            toast.success(`Showing programs for ${r.institution_name}`);
          }}
        />
        {instTotal > PAGE_SIZE && (
          <Pagination
            page={instPage}
            pageSize={PAGE_SIZE}
            total={instTotal}
            onPageChange={setInstPage}
          />
        )}
      </Card>

      {/* Section 2 — Program Management */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-brand-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-800">Program Management</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterInstitutionId}
              onChange={(e) => setFilterInstitutionId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="">All Institutions</option>
              {institutions.map((i) => (
                <option key={i.institution_id} value={i.institution_id}>
                  {i.institution_name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Search programs…"
              value={progSearch}
              onChange={(e) => setProgSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={() => openCreateProg()}>Add Program</Button>
          </div>
        </div>
        <ProgramTable
          rows={progRows}
          loading={progLoading}
          institutions={institutions}
          onEdit={openEditProg}
          onDelete={setProgToDelete}
        />
        {progTotal > PAGE_SIZE && (
          <Pagination
            page={progPage}
            pageSize={PAGE_SIZE}
            total={progTotal}
            onPageChange={setProgPage}
          />
        )}
      </Card>

      {/* Section 3 — System Configuration */}
      <DatabaseConnectionCard />

      {/* Modals */}
      <InstitutionModal
        open={instModalOpen}
        editing={editingInst}
        existing={institutions}
        onClose={() => setInstModalOpen(false)}
        onSubmit={onInstSubmit}
        saving={savingInst}
      />

      <ProgramModal
        open={progModalOpen}
        editing={editingProg}
        institutions={institutions}
        defaultInstitutionId={filterInstitutionId}
        existing={programs}
        onClose={() => setProgModalOpen(false)}
        onSubmit={onProgSubmit}
        saving={savingProg}
      />

      <ConfirmDialog
        open={Boolean(instToDelete)}
        onClose={() => setInstToDelete(null)}
        onConfirm={confirmDeleteInst}
        title="Delete institution?"
        message="This will also delete all programs linked to this institution. This cannot be undone."
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={Boolean(progToDelete)}
        onClose={() => setProgToDelete(null)}
        onConfirm={confirmDeleteProg}
        title="Delete program?"
        message="This action cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
