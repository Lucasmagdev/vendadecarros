import { CalendarCheck, Camera, Clock, FileSignature, FileText, HelpCircle, Send, UserCheck } from 'lucide-react';
import { AIAction } from '../types';

const actionConfig: Record<AIAction, { icon: typeof Camera; color: string }> = {
  'Enviou fotos': { icon: Camera, color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5' },
  'Enviou descrição': { icon: FileText, color: 'text-sky-400 border-sky-400/30 bg-sky-400/5' },
  'Tirou dúvida': { icon: HelpCircle, color: 'text-violet-400 border-violet-400/30 bg-violet-400/5' },
  'Aguardando lead': { icon: Clock, color: 'text-amber-400 border-amber-400/30 bg-amber-400/5' },
  'Enviou proposta': { icon: FileSignature, color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' },
  'Agendou visita': { icon: CalendarCheck, color: 'text-gold border-gold/30 bg-gold/5' },
  'Follow-up programado': { icon: Send, color: 'text-amber-400 border-amber-400/30 bg-amber-400/5' },
  'Transferiu para humano': { icon: UserCheck, color: 'text-rose-300 border-rose-400/30 bg-rose-400/5' },
};

export default function AIActionTag({ action }: { action: AIAction }) {
  const config = actionConfig[action];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${config.color}`}>
      <Icon size={11} />
      {action}
    </span>
  );
}
