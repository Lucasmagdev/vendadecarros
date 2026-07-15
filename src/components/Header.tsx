import { Bell, Search, Settings } from 'lucide-react';
import ShieldLogo from './ShieldLogo';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-navy-950/95 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          <ShieldLogo size={36} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gold">AutoCRM IA</h1>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Loja multimarcas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-navy-900/50 px-3 py-2 md:flex">
            <Search size={16} className="text-slate-500" />
            <input
              type="text"
              placeholder="Buscar leads, veículos..."
              className="w-56 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
            />
          </div>

          <button className="relative rounded-lg border border-slate-800 bg-navy-900/50 p-2.5 text-slate-400 transition hover:border-gold/40 hover:text-gold" title="Notificações">
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold" />
          </button>
          <button className="rounded-lg border border-slate-800 bg-navy-900/50 p-2.5 text-slate-400 transition hover:border-gold/40 hover:text-gold" title="Configurações">
            <Settings size={18} />
          </button>

          <div className="ml-1 flex items-center gap-2 rounded-lg border border-slate-800 bg-navy-900/50 py-1.5 pl-1.5 pr-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gold text-xs font-bold text-navy-950">
              JP
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-100">João Pedro</p>
              <p className="text-[11px] text-slate-500">Gerente</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
