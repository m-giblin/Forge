import type { ReactNode } from "react";

export type FormField = {
  key: string;
  label: string;
  input: ReactNode;
  /** Span both columns — for wide/multiline fields (e.g. a textarea). */
  wide?: boolean;
};

/** §3.2 `form` block — 2-column labeled field grid + Cancel/Submit. */
export default function FormGrid({
  fields,
  onCancel,
  onSubmit,
  submitLabel = "Save",
}: {
  fields: FormField[];
  onCancel?: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="fw-card px-4 py-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.key}
            className={`flex flex-col gap-1.5 ${field.wide ? "md:col-span-2" : ""}`}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">
              {field.label}
            </span>
            {field.input}
          </label>
        ))}
      </div>
      {(onCancel || onSubmit) && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#e3ded0] pt-3.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
            >
              Cancel
            </button>
          )}
          {onSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8]"
              style={{
                background: "linear-gradient(160deg,#9a5138,#6e3324)",
              }}
            >
              {submitLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
