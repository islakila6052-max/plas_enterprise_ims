// src/components/ui/Input.jsx
import { forwardRef } from "react";
import { cn } from "@/utils/cn";

const base =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-400";

/** Labeled text input with error message support. */
export const Input = forwardRef(function Input(
  { label, error, className = "", id, rightIcon, ...props },
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
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            base,
            rightIcon && "pr-10",
            error && "border-red-400 focus:ring-red-400/30",
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});

/**
 * Phone input with a fixed "+63" country prefix. The user only types the
 * local number; non-digit characters are stripped and the value is capped
 * at 10 digits. The stored value is the bare digits (e.g. "9123456789").
 */
export const PhoneInput = forwardRef(function PhoneInput(
  props,
  ref,
) {
  const { label, error, className = "", id, value = "", onChange, ...rest } = props;
  const inputId = id || rest.name;
  // react-hook-form's register() returns its own onChange via the spread.
  // Capture it before destructuring so we can call it after stripping the
  // +63 prefix; otherwise the register handler would override our handler.
  const rhOnChange = rest.onChange;
  const formatted = value ? `+63 ${value}` : "+63";
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    // Strip the leading "63" if the user pasted the full prefix.
    const local = digits.startsWith("63") ? digits.slice(2) : digits;
    const next = local.slice(0, 10);
    onChange?.(next);
    rhOnChange?.({ target: { name: rest.name, value: next } });
  };
  // Don't let the register() onChange override our composed handler.
  delete rest.onChange;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-slate-500">
          +63
        </span>
        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="numeric"
          value={formatted}
          onChange={handleChange}
          className={cn(
            base,
            "pl-12",
            error && "border-red-400 focus:ring-red-400/30",
            className,
          )}
          placeholder="9xx xxx xxxx"
          maxLength={13}
          {...rest}
        />
      </div>
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

/**
 * Live character counter shown beneath a textarea. Renders nothing when no
 * limit is supplied. Turns red once the value exceeds the limit.
 */
export function CharCounter({ value, limit }) {
  if (limit == null) return null;
  const len = String(value ?? "").length;
  const remaining = limit - len;
  return (
    <p
      className={`mt-1 text-xs ${remaining < 0 ? "text-red-600" : "text-slate-400"}`}
      aria-live="polite"
    >
      {len}/{limit} characters
    </p>
  );
}

/** Labeled textarea. */
export const Textarea = forwardRef(function Textarea(
  { label, error, className = "", id, rows = 4, maxLength, ...props },
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
        maxLength={maxLength}
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
