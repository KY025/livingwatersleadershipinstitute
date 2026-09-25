import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex gap-4">
        {danger && (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        )}
        <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => {
            onCancel?.();
            onClose();
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
            danger
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-teal-600 hover:bg-teal-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
