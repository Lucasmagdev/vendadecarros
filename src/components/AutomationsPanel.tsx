import { Bot, Camera, Clock, FileText, RotateCcw, Sparkles } from 'lucide-react';
import { AutomationRule, MessageMode } from '../types';

const VARIABLES = ['{nome}', '{veiculo}', '{parcela}', '{horario}'];

interface Props {
  rules: AutomationRule[];
  onUpdateRule: (id: string, patch: Partial<AutomationRule>) => void;
}

export default function AutomationsPanel({ rules, onUpdateRule }: Props) {
  const activeCount = rules.filter((rule) => rule.enabled).length;

  return (
    <main className="px-4 py-5 sm:px-6">
      <section className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Automações</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-50">Follow-ups automáticos</h2>
        <p className="mt-1 text-sm text-slate-400">
          {activeCount} de {rules.length} regras ativas · mensagens por template fixo ou geradas pela IA com contexto da conversa.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} onChange={(patch) => onUpdateRule(rule.id, patch)} />
        ))}
      </div>
    </main>
  );
}

function RuleCard({ rule, onChange }: { rule: AutomationRule; onChange: (patch: Partial<AutomationRule>) => void }) {
  return (
    <section
      className={`rounded-lg border bg-navy-900/35 p-4 transition ${
        rule.enabled ? 'border-slate-800' : 'border-slate-800/60 opacity-60'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-100">{rule.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{rule.description}</p>
        </div>
        <Toggle checked={rule.enabled} onChange={(enabled) => onChange({ enabled })} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-navy-950/60 px-2 py-1 text-slate-400">
          <Clock size={12} className="text-gold" />
          Espera: {rule.waitLabel}
        </span>
        {rule.maxAttempts !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-navy-950/60 px-2 py-1 text-slate-400">
            <RotateCcw size={12} className="text-gold" />
            Máx. {rule.maxAttempts} tentativa{rule.maxAttempts > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <ModeSelector mode={rule.mode} onChange={(mode) => onChange({ mode })} />

      {rule.mode === 'template' ? (
        <div className="mt-3">
          <textarea
            value={rule.template}
            onChange={(e) => onChange({ template: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-700 bg-navy-950/60 px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none transition focus:border-gold/50"
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Variáveis:</span>
            {VARIABLES.map((variable) => (
              <button
                key={variable}
                onClick={() => onChange({ template: `${rule.template} ${variable}` })}
                className="rounded-md bg-navy-950/60 px-2 py-1 font-mono text-[11px] text-cyan-300 transition hover:bg-cyan-400/10"
              >
                {variable}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-slate-400">Instrução para a IA</label>
          <textarea
            value={rule.aiInstruction}
            onChange={(e) => onChange({ aiInstruction: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-700 bg-navy-950/60 px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none transition focus:border-gold/50"
          />
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-cyan-400/5 px-3 py-2">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-cyan-300" />
            <p className="text-xs leading-relaxed text-slate-400">
              A IA escreve uma mensagem única por lead, usando o histórico da conversa, o veículo de interesse e esta instrução.
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-navy-950/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Camera size={14} className={rule.sendPhoto ? 'text-emerald-300' : 'text-slate-500'} />
          <div>
            <p className="text-xs font-semibold text-slate-200">Enviar foto do veículo</p>
            <p className="text-[10px] text-slate-500">Anexa a foto do carro de interesse junto com a mensagem</p>
          </div>
        </div>
        <Toggle checked={rule.sendPhoto} onChange={(sendPhoto) => onChange({ sendPhoto })} />
      </div>
    </section>
  );
}

function ModeSelector({ mode, onChange }: { mode: MessageMode; onChange: (mode: MessageMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-navy-950/40 p-1">
      <ModeButton
        active={mode === 'template'}
        onClick={() => onChange('template')}
        icon={FileText}
        label="Template fixo"
        hint="Mesma mensagem sempre"
      />
      <ModeButton
        active={mode === 'ia'}
        onClick={() => onChange('ia')}
        icon={Bot}
        label="Gerada por IA"
        hint="Única por lead"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-left transition ${
        active ? 'bg-gold/15 text-gold' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon size={15} className="shrink-0" />
      <span>
        <span className="block text-xs font-bold">{label}</span>
        <span className={`block text-[10px] ${active ? 'text-gold/70' : 'text-slate-600'}`}>{hint}</span>
      </span>
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-gold' : 'bg-slate-700'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-navy-950 transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
