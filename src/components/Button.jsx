// src/components/Button.jsx
const Button = ({ children, className = "" }) => {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 ${className}`}>
      {children}
    </button>
  );
};

export default Button;
