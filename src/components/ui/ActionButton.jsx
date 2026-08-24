// src/components/ui/ActionButton.jsx
/**
 * Icon-only action button used across all tables/lists/cards.
 * Colors: blue=edit, green=view/restore, amber=archive, red=delete,
 *         indigo=download.
 */
const COLORS = {
  blue: "text-blue-500 hover:bg-blue-500",
  green: "text-green-500 hover:bg-green-500",
  amber: "text-amber-500 hover:bg-amber-500",
  red: "text-red-500 hover:bg-red-500",
  indigo: "text-indigo-500 hover:bg-indigo-500",
};

export default function ActionButton({
  icon: Icon,
  onClick,
  color = "blue",
  tooltip,
  disabled = false,
  loading = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      disabled={disabled || loading}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-md transition-all hover:scale-105 active:scale-95 ${
        COLORS[color] ?? COLORS.blue
      } hover:bg-opacity-10 disabled:opacity-40 disabled:pointer-events-none`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}
