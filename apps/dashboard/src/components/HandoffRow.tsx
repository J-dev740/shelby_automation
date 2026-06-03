import React from 'react';
import { User, CheckCircle2 } from 'lucide-react';
import { Session } from '../types';

interface HandoffRowProps {
  session: Session;
  onResolve: () => void;
}

export function HandoffRow({ session, onResolve }: HandoffRowProps) {
  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-100 truncate">{session.customers?.display_name || session.customers?.phone_e164}</p>
          <p className="text-xs text-red-400/80">Needs Staff Assistance</p>
        </div>
      </div>
      <button
        onClick={onResolve}
        className="px-4 py-2 rounded-lg font-bold text-xs bg-red-500 hover:bg-red-400 text-white transition-all flex items-center justify-center gap-1.5"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Resolve
      </button>
    </div>
  );
}
