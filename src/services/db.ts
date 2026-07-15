import { AutomationRule, Lead } from '../types';

export interface PersistedState {
  leads: Lead[];
  rules: AutomationRule[];
  savedAt: string;
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    const response = await fetch('/api/db/state');
    const data = await response.json();
    if (!data.ok || data.empty || !data.state) return null;
    const state = data.state as PersistedState;
    if (!Array.isArray(state.leads) || !Array.isArray(state.rules)) return null;
    return state;
  } catch {
    return null;
  }
}

export async function deleteLead(leadId: string): Promise<void> {
  const response = await fetch(`/api/db/leads/${encodeURIComponent(leadId)}`, {
    method: 'DELETE',
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Não foi possível excluir o lead');
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveStateDebounced(leads: Lead[], rules: AutomationRule[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch('/api/db/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads, rules, savedAt: new Date().toISOString() }),
    }).catch(() => undefined);
  }, 800);
}
