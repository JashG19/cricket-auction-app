import { useState, useEffect } from 'react'
import { IoCheckmarkCircle, IoClose, IoAlert, IoWarning } from 'react-icons/io5'

export const Toast = ({ message, type = 'success', duration = 4000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose && onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const iconStyles = {
    success: <IoCheckmarkCircle className="text-green-600" />,
    error: <IoAlert className="text-red-600" />,
    warning: <IoWarning className="text-yellow-600" />,
    info: <IoCheckmarkCircle className="text-blue-600" />,
  }

  return (
    <div className={`fixed bottom-4 right-4 border rounded-lg p-4 flex items-center gap-3 shadow-lg animate-slideIn ${typeStyles[type]}`}>
      <div className="text-xl">{iconStyles[type]}</div>
      <span className="flex-1 font-medium">{message}</span>
      <button
        onClick={() => setIsVisible(false)}
        className="text-lg hover:opacity-70 transition"
      >
        <IoClose />
      </button>
    </div>
  )
}

export const useToast = () => {
  const [toasts, setToasts] = useState([])

  const showToast = (message, type = 'success', duration = 4000) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type, duration }])

    return id
  }

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return {
    toasts,
    showToast,
    removeToast,
    success: (msg, duration) => showToast(msg, 'success', duration),
    error: (msg, duration) => showToast(msg, 'error', duration),
    warning: (msg, duration) => showToast(msg, 'warning', duration),
    info: (msg, duration) => showToast(msg, 'info', duration),
  }
}

export default Toast
