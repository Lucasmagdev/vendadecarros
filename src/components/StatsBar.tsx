import { Bot, CalendarCheck, RotateCcw, TrendingUp, Trophy, UserCheck } from 'lucide-react';
import { Lead } from '../types';

interface Props {
  leads: Lead[];
}

export default function StatsBar({ leads }: Props) {
  const count = (stage: Lead['stage']) => leads.filter((lead) => lead.stage === stage).length;
  const vendas = count('venda-concluida');
  const conversao = leads.length > 0 ? Math.round((vendas / leads.length) * 100) : 0;

  const stats = [
    { label: 'IA atendendo', value: count('pre-atendimento'), icon: Bot, accent: 'text-cyan-300' },
    { label: 'Follow-ups', value: count('follow-up'), icon: RotateCcw, accent: 'text-amber-300' },
    { label: 'Visitas', value: count('agendado'), icon: CalendarCheck, accent: 'text-gold' },
    { label: 'Humano', value: count('atendimento-humano'), icon: UserCheck, accent: 'text-sky-300' },
    { label: 'Vendas', value: vendas, icon: Trophy, accent: 'text-emerald-300' },
    { label: 'Conversão', value: `${conversao}%`, icon: TrendingUp, accent: 'text-emerald-300' },
  ];

  return (
    <section className="px-4 pt-4 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-800 bg-navy-900/35 p-3 shadow-md shadow-black/10"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <stat.icon size={16} className={stat.accent} />
              <p className={`text-xl font-bold ${stat.accent}`}>{stat.value}</p>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
