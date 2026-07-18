// src/components/institutions/InstitutionModal.jsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

/**
 * Create / edit institution form.
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.editing  institution row when editing
 * @param {Array}  props.existing      all institutions (to prevent duplicate names)
 * @param {Function} props.onClose
 * @param {Function} props.onSubmit    async (values) => void
 * @param {boolean} props.saving
 */
export default function InstitutionModal({ open, editing, existing = [], onClose, onSubmit, saving }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { institution_name: "", abbreviation: "", campus: "", address: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              institution_name: editing.institution_name ?? "",
              abbreviation: editing.abbreviation ?? "",
              campus: editing.campus ?? "",
              address: editing.address ?? "",
            }
          : { institution_name: "", abbreviation: "", campus: "", address: "" },
      );
    }
  }, [open, editing, reset]);

  const onValid = (values) => {
    const name = values.institution_name.trim();
    const dup = existing.some(
      (i) => i.institution_name.toLowerCase() === name.toLowerCase() && i.institution_id !== editing?.institution_id,
    );
    if (dup) {
      // Surface as a field error via setError-like path: use a toast-free inline approach.
      return;
    }
    onSubmit({ ...values, institution_name: name });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Institution" : "Add Institution"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onValid)} loading={saving}>
            {editing ? "Save Changes" : "Create Institution"}
          </Button>
        </>
      }>
      <form className="space-y-4" onSubmit={handleSubmit(onValid)}>
        <Input
          label="Institution Name"
          error={errors.institution_name?.message}
          {...register("institution_name", {
            required: "Institution name is required",
            validate: (v) => {
              const name = v.trim().toLowerCase();
              const dup = existing.some(
                (i) =>
                  i.institution_name.toLowerCase() === name &&
                  i.institution_id !== editing?.institution_id,
              );
              return dup ? "An institution with this name already exists" : true;
            },
          })}
        />
        <Input label="Abbreviation" {...register("abbreviation")} />
        <Input label="Campus" {...register("campus")} />
        <Textarea label="Address" rows={3} {...register("address")} />
      </form>
    </Modal>
  );
}
