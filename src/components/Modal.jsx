import { useState } from "react";
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-slideIn">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-textLight hover:text-text transition"
          >
            <IoClose size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {(onConfirm || onCancel) && (
          <div className="flex gap-3 p-6 border-t border-border justify-end">
            {onCancel && (
              <button
                onClick={onCancel || onClose}
                className="px-4 py-2 rounded border border-border text-text hover:bg-lightBg transition"
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
