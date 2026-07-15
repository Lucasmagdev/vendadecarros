import { useState } from 'react';
import { Calendar, Clock, MessageSquare, Phone } from 'lucide-react';
import { Lead } from '../types';

interface Props {
  lead: Lead;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const temperatureConfig = {
  quente: { badge: 'bg-rose-400/10 text-rose-200', border: 'border-l-rose-400' },
  morno: { badge: 'bg-amber-400/10 text-amber-200', border: 'border-l-amber-400/70' },
  frio: { badge: 'bg-slate-500/15 text-slate-300', border: 'border-l-slate-600' },
};

function minutesSinceLastMessage(lead: Lead): number | null {
  const last = lead.messages[lead.messages.length - 1];
  if (!last) return null;
  const [h, m] = last.time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const diff = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
  return diff >= 0 ? diff : null;
}

function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ''}`;
}

export default function LeadCard({ lead, onClick, onDragStart }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const temp = temperatureConfig[lead.temperature];
  const waitingReply = lead.messages[lead.messages.length - 1]?.sender === 'lead';
  const waitMinutes = waitingReply ? minutesSinceLastMessage(lead) : null;

  return (
    <article
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart(e);
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={onClick}
      className={`group animate-card-in cursor-pointer rounded-lg border border-l-2 border-slate-800 bg-navy-950/45 p-3 shadow-md shadow-black/20 transition hover:-translate-y-0.5 hover:border-gold/30 hover:bg-navy-900/70 hover:shadow-lg ${
        temp.border
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <img
          src={lead.vehicleImage}
          alt={lead.vehicle}
          className="h-12 w-12 shrink-0 rounded-md object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-bold text-slate-100">{lead.clientName}</h3>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${temp.badge}`}>
              {lead.temperature}
            </span>
          </div>
          <p className="truncate text-xs font-semibold text-gold">{lead.vehicle}</p>
          <p className="truncate text-[11px] text-slate-500">
            {lead.source} · {lead.budgetRange}
          </p>
        </div>
      </div>

      {waitMinutes !== null && waitMinutes >= 15 && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-rose-400/10 px-2 py-1.5">
          <Clock size={12} className="text-rose-300" />
          <p className="text-[11px] font-semibold text-rose-200">
            Sem resposta há {formatWait(waitMinutes)}
          </p>
        </div>
      )}

      <div className="mt-2.5 rounded-md bg-navy-900/70 px-2.5 py-1.5">
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-300">{lead.status}</p>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800 pt-2">
        <div className="flex gap-1">
          <IconButton label="Abrir conversa" onClick={onClick} icon={MessageSquare} />
          <IconButton label="Agendar" icon={Calendar} />
          <IconButton label="Ligar" icon={Phone} />
        </div>
        <span className="text-[10px] text-slate-500">
          {new Date(lead.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    </article>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof MessageSquare;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className="rounded-md p-1.5 text-slate-500 transition hover:bg-gold/10 hover:text-gold"
      title={label}
    >
      <Icon size={15} />
    </button>
  );
}
