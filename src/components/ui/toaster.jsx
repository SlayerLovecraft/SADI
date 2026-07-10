import * as React from "react"
import { X } from "lucide-react"

const ToastContext = React.createContext({})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([])

  const toast = React.useCallback(({ title, description, variant = "default" }) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, title, description, variant }])
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              p-4 rounded-lg shadow-lg min-w-[300px] animate-slide-in
              ${t.variant === "destructive" ? "bg-red-600 text-white" : "bg-white border"}
            `}
          >
            <div className="flex justify-between items-start">
              <div>
                {t.title && <div className="font-semibold">{t.title}</div>}
                {t.description && <div className="text-sm mt-1">{t.description}</div>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
                className="ml-4"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return React.useContext(ToastContext)
}

export function Toaster() {
  return null // El ToastProvider maneja todo
}