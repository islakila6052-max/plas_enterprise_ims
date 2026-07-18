// src/pages/admin/AdminInstitutions.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { institutionService } from "@/services/institutionService";
import { programService } from "@/services/programService";
import { internService } from "@/services/internService";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 8;

export default function AdminInstitutions() {
  const [institutions, setInstitutions] = useState([]);
  const [instLoading, setInstLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "institution_name", dir: "asc" });
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInst, setEditingInst] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 500);

  const loadInstitutions = useCallback(async () => {
    setInstLoading(true);
    try {
      const rows = await institutionService.list({ search: debouncedSearch });
      setInstitutions(rows);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setInstLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  useEffect(() => setPage(1), [debouncedSearch, sort]);

  // Enrich each institution with program count + active intern count.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [programs, interns] = await Promise.all([
          programService.list({}),
          internService.list({ pageSize: 1000 }),
        ]);
        if (!active) return;
        const progByInst = new Map();
        programs.forEach((p) => {
          progByInst.set(p.institution_id, (progByInst.get(p.institution_id) || 0) + 1);
        });
        const activeByInst = new Map();
        (interns.data || []).forEach((i) => {
          if (i.status === "active" && i.institution_id) {
            activeByInst.set(i.institution_id, (activeByInst.get(i.institution_id) || 0) + 1);
          }
        });
        setInstitutions((prev) =>
          prev.map((inst) => ({
            ...inst,
            program_count: progByInst.get(inst.institution_id) || 0,
            active_intern_count: activeByInst.get(inst.institution_id) || 0,
          })),
        );
      } catch {
        /* stats are best-effort */
      }
    })();
    return () => {
      active = false;
    };
  }, [institutions]);

  const sorted = useMemo(() => {
    const arr = [...institutions];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === "updated_at") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else {
        av = (av ?? 0);
        bv = (bv ?? 0);
      }
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [institutions, sort]);

  const total = sorted.length;
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function onSort(key) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function openCreate() {
    setEditingInst(null);
    setModalOpen(true);
  }
  function openEdit(inst) {
    setEditingInst(inst);
    setModalOpen(true);
  }

  async function onModalSubmit({ institution, programs }) {
    setSaving(true);
    try {
      let institutionId;
      if (editingInst) {
        await institutionService.update(editingInst.institution_id, institution);
        institutionId = editingInst.institution_id;
        toast.success("Institution updated.");
      } else {
        const created = await institutionService.create(institution);
        institutionId = created.institution_id;
        toast.success("Institution added.");
      }
      await programService.reconcile(institutionId, programs);
      setModalOpen(false);
      await loadInstitutions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await institutionService.remove(toDelete.institution_id);
      toast.success("Institution deleted (programs removed too).");
      setToDelete(null);
      await loadInstitutions();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutions"
        description="Manage educational institutions, their academic programs, and linked interns."
        action={<Button onClick={openCreate}>+ Add Institution</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-brand-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-800">Institution Management</h3>
          <Input
            placeholder="Search institutions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {instLoading ? (
          <Spinner label="Loading institutions…" />
        ) : (
          <InstitutionTable
            rows={rows}
            sort={sort}
            onSort={onSort}
            onEdit={openEdit}
            onDelete={setToDelete}
            onView={(r) => (window.location.href = `/admin/institutions/${r.institution_id}`)}
          />
        )}

        {!instLoading && total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Card>

      <InstitutionModal
        open={modalOpen}
        editing={editingInst}
        existing={institutions}
        onClose={() => setModalOpen(false)}
        onSubmit={onModalSubmit}
        saving={saving}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete institution?"
        message="This will also delete all programs linked to this institution. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
