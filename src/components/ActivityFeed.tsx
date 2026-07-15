import { Bot, Camera, FileText, X } from 'lucide-react';
import { ActivityEvent } from '../types';

interface Props {
  events: ActivityEvent[];
  onDismiss: (id: string) => void;
}

export default function ActivityFeed({ events, onDismiss }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[340px] flex-col gap-2">
      {events.slice(-3).map((event) => (
        <div
          key={event.id}
          className="rounded-lg border border-emerald-400/30 bg-navy-900 p-3 shadow-2xl shadow-black/50"
        >
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {event.mode === 'ia' ? (
                <Bot size={14} className="text-cyan-300" />
              ) : (
                <FileText size={14} className="text-gold" />
              )}
              <p className="text-xs font-bold text-slate-100">
                Follow-up enviado · {event.leadName}
              </p>
            </div>
            <button
              onClick={() => onDismiss(event.id)}
              className="rounded p-0.5 text-slate-500 transition hover:text-slate-200"
            >
              <X size={13} />
            </button>
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-300">{event.text}</p>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
            <span>Regra: {event.ruleName}</span>
            <span>· {event.mode === 'ia' ? 'Gerada por IA' : 'Template'}</span>
            {event.withPhoto && (
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Camera size={11} /> com foto
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
