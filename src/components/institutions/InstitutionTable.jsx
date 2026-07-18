// src/components/institutions/InstitutionTable.jsx
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

/** Table of institutions with row actions. */
export default function InstitutionTable({ rows, onEdit, onDelete, onViewPrograms, loading }) {
  const columns = [
    { key: "institution_name", header: "Institution Name", render: (r) => r.institution_name },
    {
      key: "abbreviation",
      header: "Abbreviation",
      render: (r) => r.abbreviation || "—",
    },
    { key: "campus", header: "Campus", render: (r) => r.campus || "—" },
    {
      key: "address",
      header: "Address",
      render: (r) => r.address || "—",
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onViewPrograms(r)}>
            View Programs
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onEdit(r)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(r) => r.institution_id}
      empty={
        <EmptyState
          icon="building"
          title="No institutions yet"
          description="Add your first institution to start managing programs."
        />
      }
    />
  );
}
