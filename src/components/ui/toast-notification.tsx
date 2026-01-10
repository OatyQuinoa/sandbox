import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ToastType = "success" | "error";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  onRetry?: () => void;
}

interface ToastNotificationProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm
              ${
                toast.type === "success"
                  ? "bg-lime/10 border-lime/20 text-lime"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }
            `}
          >
            {toast.type === "success" ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 flex-shrink-0" />
            )}
            
            <span className="font-mono text-sm">{toast.message}</span>
            
            {toast.onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toast.onRetry}
                className="text-inherit hover:bg-white/10 ml-2"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDismiss(toast.id)}
              className="h-6 w-6 text-inherit hover:bg-white/10 ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
