import { Lead } from '../types';
import { buildVehicleSheet, matchInventoryVehicle } from './inventoryMatch';

export interface AiGenerateResult {
  ok: boolean;
  mode: 'real' | 'fallback' | 'demo';
  text: string;
  scheduledAt?: string | null;
  note?: string;
}

async function callGenerate(
  instruction: string,
  lead: Lead,
  fallback: string,
  detectSchedule: boolean
): Promise<AiGenerateResult> {
  try {
    const stock = matchInventoryVehicle(lead.vehicle);
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        fallback,
        detectSchedule,
        lead: {
          clientName: lead.clientName,
          vehicle: lead.vehicle,
          vehicleSheet: stock ? buildVehicleSheet(stock) : undefined,
          budgetRange: lead.budgetRange,
          intent: lead.intent,
          messages: lead.messages.slice(-6),
        },
      }),
    });
    const data = await response.json();
    if (!data.ok || !data.text) throw new Error('resposta vazia');
    return data as AiGenerateResult;
  } catch {
    return { ok: true, mode: 'fallback', text: fallback, note: 'Bridge indisponível — fallback local.' };
  }
}

export function generateFollowUpMessage(instruction: string, lead: Lead, fallback: string) {
  return callGenerate(instruction, lead, fallback, false);
}

export function generateAutoReply(instruction: string, lead: Lead, fallback: string) {
  return callGenerate(instruction, lead, fallback, true);
}

export function fillTemplate(template: string, lead: Lead): string {
  const firstName = lead.clientName.split(' ')[0];
  const horario = lead.scheduledAt
    ? new Date(lead.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : 'a combinar';
  return template
    .split('{nome}').join(firstName)
    .split('{veiculo}').join(lead.vehicle)
    .split('{parcela}').join(lead.budgetRange)
    .split('{horario}').join(horario);
}
