import { useState, useEffect, useCallback, useRef } from "react";
import {
  IoCheckmarkCircle,
  IoClose,
  IoAlert,
  IoWarning,
} from "react-icons/io5";

export const Toast = ({
  message,
  type = "success",
  duration = 4000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onCloseRef.current?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    onCloseRef.current?.();
  };

  if (!isVisible) return null;

  const typeStyles = {
    success:
      "bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700 text-green-800 dark:text-green-300",
    error:
      "bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300",
    warning:
      "bg-yellow-50 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300",
    info: "bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300",
  };

  const iconStyles = {
    success: (
      <IoCheckmarkCircle className="text-green-600 dark:text-green-400" />
    ),
    error: <IoAlert className="text-red-600 dark:text-red-400" />,
    warning: <IoWarning className="text-yellow-600 dark:text-yellow-400" />,
    info: <IoCheckmarkCircle className="text-blue-600 dark:text-blue-400" />,
  };

  return (
    <div
      className={`border rounded-lg p-4 flex items-center gap-3 shadow-lg animate-slideIn ${typeStyles[type]}`}
    >
      <div className="text-xl">{iconStyles[type]}</div>
      <span className="flex-1 font-medium">{message}</span>
      <button
        onClick={handleClose}
        className="text-lg hover:opacity-70 transition"
      >
        <IoClose />
      </button>
    </div>
  );
};

let toastCounter = 0;

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(
    (message, type = "success", duration = 4000) => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      return id;
    },
    [],
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    success: (msg, duration) => showToast(msg, "success", duration),
    error: (msg, duration) => showToast(msg, "error", duration),
    warning: (msg, duration) => showToast(msg, "warning", duration),
    info: (msg, duration) => showToast(msg, "info", duration),
  };
};

export default Toast;
