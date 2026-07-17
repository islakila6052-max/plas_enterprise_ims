// src/components/ui/Input.jsx
import { forwardRef } from "react";
import { cn } from "@/utils/cn";

const base =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-400";

/** Labeled text input with error message support. */
export const Input = forwardRef(function Input(
  { label, error, className = "", id, ...props },
  ref,
) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(base, error && "border-red-400 focus:ring-red-400/30", className)}
        {...props}
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});

/** Labeled select. */
export const Select = forwardRef(function Select(
  { label, error, className = "", id, children, ...props },
  ref,
) {
  const selectId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          base,
          "pr-8",
          error && "border-red-400 focus:ring-red-400/30",
          className,
        )}
        {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});

/** Labeled textarea. */
export const Textarea = forwardRef(function Textarea(
  { label, error, className = "", id, rows = 4, ...props },
  ref,
) {
  const areaId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={areaId}
          className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        className={cn(
          base,
          "resize-y",
          error && "border-red-400 focus:ring-red-400/30",
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});
