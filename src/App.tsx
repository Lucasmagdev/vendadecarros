import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityEvent, AutomationRule, Lead, KanbanStage } from './types';
import { initialLeads } from './data/leads';
import { initialAutomationRules } from './data/automations';
import { deleteLead, loadState, saveStateDebounced } from './services/db';
import { useAutomationEngine } from './hooks/useAutomationEngine';
import { useInboundSync } from './hooks/useInboundSync';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import KanbanColumn from './components/KanbanColumn';
import LeadDetailModal from './components/LeadDetailModal';
import AdminPanel from './components/AdminPanel';
import AutomationsPanel from './components/AutomationsPanel';
import ActivityFeed from './components/ActivityFeed';

const columns: { stage: KanbanStage; title: string; subtitle: string }[] = [
  { stage: 'pre-atendimento', title: 'Pré-atendimento', subtitle: 'IA respondendo' },
  { stage: 'follow-up', title: 'Follow-up', subtitle: 'Retorno automático' },
  { stage: 'agendado', title: 'Agendado', subtitle: 'Visita marcada' },
  { stage: 'atendimento-humano', title: 'Humano', subtitle: 'Negociação' },
  { stage: 'venda-concluida', title: 'Vendido', subtitle: 'Fechado' },
];

function leadsSignature(leads: Lead[]) {
  return leads
    .map((lead) => `${lead.id}:${lead.stage}:${lead.lastActivityAt || 0}:${lead.messages.length}`)
    .join('|');
}

function App() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [rules, setRules] = useState<AutomationRule[]>(initialAutomationRules);
  const [hydrated, setHydrated] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState<KanbanStage | null>(null);
  const [activeView, setActiveView] = useState<'pipeline' | 'automacoes' | 'admin'>('pipeline');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const skipNextSave = useRef(true);

  useEffect(() => {
    loadState().then((state) => {
      if (state) {
        setLeads(state.leads);
        setRules(
          state.rules.map((rule) => ({
            ...initialAutomationRules.find((base) => base.id === rule.id),
            ...rule,
          }))
        );
      }
      skipNextSave.current = true;
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveStateDebounced(leads, rules);
  }, [leads, rules, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const sync = () => {
      loadState().then((state) => {
        if (!state) return;
        setLeads((current) =>
          leadsSignature(current) === leadsSignature(state.leads) ? current : state.leads
        );
      });
    };
    const interval = setInterval(sync, 5_000);
    return () => clearInterval(interval);
  }, [hydrated]);

  const pushActivity = useCallback((event: ActivityEvent) => {
    setEvents((prev) => [...prev.slice(-9), event]);
    setTimeout(() => {
      setEvents((prev) => prev.filter((existing) => existing.id !== event.id));
    }, 12_000);
  }, []);

  useAutomationEngine(leads, rules, setLeads, pushActivity, hydrated);
  useInboundSync(leads, setLeads, pushActivity, hydrated);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;

  const handleDrop = (e: React.DragEvent, stage: KanbanStage) => {
    e.preventDefault();
    setDraggingOver(null);
    const leadId = e.dataTransfer.getData('text/plain');
    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, stage } : lead))
    );
  };

  const handleDragOver = (e: React.DragEvent, stage: KanbanStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggingOver(stage);
  };

  const updateRule = (id: string, patch: Partial<AutomationRule>) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const handleDeleteLead = async (leadId: string) => {
    await deleteLead(leadId);
    setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
    setSelectedLeadId(null);
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-200">
      <Header />

      <nav className="px-4 pt-4 sm:px-6">
        <div className="flex w-fit gap-1 rounded-lg border border-slate-800 bg-navy-900/40 p-1">
          <ViewTab label="Pipeline" active={activeView === 'pipeline'} onClick={() => setActiveView('pipeline')} />
          <ViewTab label="Automações" active={activeView === 'automacoes'} onClick={() => setActiveView('automacoes')} />
          <ViewTab label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
        </div>
      </nav>

      {activeView === 'admin' ? (
        <AdminPanel />
      ) : activeView === 'automacoes' ? (
        <AutomationsPanel rules={rules} onUpdateRule={updateRule} />
      ) : (
        <>
          <StatsBar leads={leads} />

          <main className="px-4 pb-8 pt-5 sm:px-6">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Pipeline de vendas</h2>
                <p className="text-sm text-slate-400">Leads recebidos pelo WhatsApp, qualificados pela IA e prontos para visita.</p>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-lg bg-emerald-400/5 px-3 py-2 text-sm text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                WhatsApp conectado
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {columns.map((col) => (
                <KanbanColumn
                  key={col.stage}
                  stage={col.stage}
                  title={col.title}
                  subtitle={col.subtitle}
                  leads={leads.filter((lead) => lead.stage === col.stage)}
                  onCardClick={(lead) => setSelectedLeadId(lead.id)}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setDraggingOver(null)}
                  isDraggingOver={draggingOver === col.stage}
                />
              ))}
            </div>
          </main>
        </>
      )}

      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLeadId(null)}
        onDelete={handleDeleteLead}
        onSendMessage={(leadId, message) =>
          setLeads((prev) =>
            prev.map((lead) =>
              lead.id === leadId
                ? { ...lead, messages: [...lead.messages, message], lastActivityAt: Date.now() }
                : lead
            )
          )
        }
      />
      <ActivityFeed
        events={events}
        onDismiss={(id) => setEvents((prev) => prev.filter((event) => event.id !== id))}
      />
    </div>
  );
}

function ViewTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
        active
          ? 'bg-gold/15 text-gold shadow-sm'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

export default App;
