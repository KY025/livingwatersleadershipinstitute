import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
