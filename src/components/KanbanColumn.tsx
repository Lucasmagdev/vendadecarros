import { Bot, CalendarClock, Inbox, Plus, RotateCcw, Trophy, UserCheck } from 'lucide-react';
import { Lead, KanbanStage } from '../types';
import LeadCard from './LeadCard';

interface Props {
  stage: KanbanStage;
  title: string;
  subtitle: string;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  onDrop: (e: React.DragEvent, stage: KanbanStage) => void;
  onDragOver: (e: React.DragEvent, stage: KanbanStage) => void;
  onDragLeave: () => void;
  isDraggingOver: boolean;
}

const stageConfig: Record<KanbanStage, { icon: typeof Bot; accent: string; bar: string }> = {
  'pre-atendimento': { icon: Bot, accent: 'text-cyan-300', bar: 'bg-cyan-400' },
  'follow-up': { icon: RotateCcw, accent: 'text-amber-300', bar: 'bg-amber-400' },
  agendado: { icon: CalendarClock, accent: 'text-gold', bar: 'bg-gold' },
  'atendimento-humano': { icon: UserCheck, accent: 'text-sky-300', bar: 'bg-sky-400' },
  'venda-concluida': { icon: Trophy, accent: 'text-emerald-300', bar: 'bg-emerald-400' },
};

export default function KanbanColumn({
  stage,
  title,
  subtitle,
  leads,
  onCardClick,
  onDrop,
  onDragOver,
  onDragLeave,
  isDraggingOver,
}: Props) {
  const config = stageConfig[stage];
  const Icon = config.icon;

  return (
    <section
      onDrop={(e) => onDrop(e, stage)}
      onDragOver={(e) => onDragOver(e, stage)}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeave();
      }}
      className={`flex w-[290px] shrink-0 flex-col overflow-hidden rounded-lg border transition ${
        isDraggingOver
          ? 'border-gold/60 bg-navy-900/50 shadow-lg shadow-black/30'
          : 'border-slate-800 bg-navy-900/25'
      }`}
    >
      <div className={`h-[3px] w-full ${config.bar}`} />

      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className={config.accent} />
          <div>
            <h2 className="text-sm font-bold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <span className="grid h-6 min-w-6 place-items-center rounded-md bg-navy-950/60 px-1.5 text-xs font-bold text-slate-300">
          {leads.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3 xl:max-h-[calc(100vh-330px)] xl:overflow-y-auto">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onCardClick(lead)}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', lead.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
          />
        ))}

        {isDraggingOver && (
          <div className="grid place-items-center rounded-lg border-2 border-dashed border-gold/50 bg-gold/5 py-6">
            <p className="text-xs font-semibold text-gold">Solte aqui</p>
          </div>
        )}

        {leads.length === 0 && !isDraggingOver && (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-slate-800 py-10 text-center">
            <div className="flex flex-col items-center gap-2">
              <Inbox size={20} className="text-slate-600" />
              <p className="text-xs text-slate-500">Sem leads nesta etapa</p>
            </div>
          </div>
        )}

        <button className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-800 py-2 text-xs text-slate-500 transition hover:border-gold/40 hover:text-gold">
          <Plus size={14} />
          Adicionar lead
        </button>
      </div>
    </section>
  );
}
