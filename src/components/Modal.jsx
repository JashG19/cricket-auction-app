import { useEffect } from "react";
import { IoClose } from "react-icons/io5";

export const Modal = ({
  isOpen,
  title,
  children,
  onClose,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
}) => {
  // Escape key handler and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border dark:border-gray-700">
          <h2 className="text-xl font-bold text-text dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-textLight dark:text-gray-400 hover:text-text dark:hover:text-white transition"
          >
            <IoClose size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-text dark:text-gray-200">{children}</div>

        {/* Footer */}
        {(onConfirm || onCancel) && (
          <div className="flex gap-3 p-6 border-t border-border dark:border-gray-700 justify-end">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded border border-border dark:border-gray-600 text-text dark:text-gray-200 hover:bg-lightBg dark:hover:bg-gray-700 transition"
              >
                {cancelText}
              </button>
            )}
            {onConfirm && (
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded text-white transition ${isDanger ? "bg-danger hover:bg-red-700" : "bg-primary hover:bg-accent"}`}
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
