import { useEffect, useRef } from 'react';
import { ActivityEvent, AutomationRule, Lead, WhatsAppMessage } from '../types';
import { fillTemplate, generateFollowUpMessage } from '../services/ai';
import { sendWhatsAppMedia, sendWhatsAppText } from '../services/evolutionApi';
import { vehicleImageFor } from '../services/inventoryMatch';

// Clock acelerado do demo: 1 tick = 1 "janela de espera" vencida.
const TICK_MS = 20_000;

// Trava compartilhada entre instâncias do hook (React StrictMode monta em dobro)
// para impedir disparo duplicado da mesma regra.
const engineBusy = { current: false };

function ruleMatchesLead(rule: AutomationRule, lead: Lead): boolean {
  const lastMessage = lead.messages[lead.messages.length - 1];
  switch (rule.trigger) {
    case 'sem-resposta':
      return lead.stage === 'pre-atendimento' && lastMessage?.sender !== 'lead';
    case 'proposta-sem-resposta':
      return lead.stage === 'follow-up' && lastMessage?.sender !== 'lead';
    case 'visita-agendada':
      return lead.stage === 'agendado';
    case 'lead-frio':
      return lead.temperature === 'frio' && lead.stage !== 'venda-concluida';
    default:
      return false;
  }
}

function canFire(rule: AutomationRule, lead: Lead, now: number): boolean {
  const fired = lead.automation?.[rule.id];
  const max = rule.maxAttempts ?? 1;
  const attempt = fired?.count ?? 0;
  if (attempt >= max) return false;

  if (attempt === 0 && lead.followUpAt) {
    const scheduled = Date.parse(lead.followUpAt);
    if (!Number.isNaN(scheduled)) return now >= scheduled;
  }

  const delayMinutes = rule.waitMinutes[attempt] ?? rule.waitMinutes[rule.waitMinutes.length - 1] ?? 60;
  const reference = fired?.lastAt ?? lead.lastActivityAt ?? Date.parse(lead.createdAt);
  return Number.isFinite(reference) && now - reference >= delayMinutes * 60_000;
}

export function useAutomationEngine(
  leads: Lead[],
  rules: AutomationRule[],
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>,
  onActivity: (event: ActivityEvent) => void,
  running: boolean
) {
  const leadsRef = useRef(leads);
  const rulesRef = useRef(rules);
  leadsRef.current = leads;
  rulesRef.current = rules;

  useEffect(() => {
    if (!running) return;

    const tick = async () => {
      if (engineBusy.current) return;
      engineBusy.current = true;
      try {
        const now = Date.now();
        let target: { rule: AutomationRule; lead: Lead } | null = null;

        for (const rule of rulesRef.current) {
          if (!rule.enabled) continue;
          const lead = leadsRef.current.find(
            (candidate) => ruleMatchesLead(rule, candidate) && canFire(rule, candidate, now)
          );
          if (lead) {
            target = { rule, lead };
            break;
          }
        }

        if (!target) return;
        const { rule, lead } = target;

        const templateText = fillTemplate(rule.template, lead);
        let text = templateText;
        let mode: 'template' | 'ia' = 'template';
        if (rule.mode === 'ia') {
          const generated = await generateFollowUpMessage(rule.aiInstruction, lead, templateText);
          text = generated.text;
          mode = 'ia';
        }

        const number = lead.phone.replace(/\D/g, '');
        const attempt = (lead.automation?.[rule.id]?.count ?? 0) + 1;
        const idempotencyKey = `automation:${lead.id}:${rule.id}:${attempt}`;
        const result = rule.sendPhoto
          ? await sendWhatsAppMedia({
            number,
            media: vehicleImageFor(lead),
            caption: text,
            mediatype: 'image',
            mimetype: 'image/jpeg',
            fileName: `${lead.id}-veiculo.jpg`,
            idempotencyKey,
          })
          : await sendWhatsAppText({ number, text, idempotencyKey });

        if (!result.ok) throw new Error(result.error || 'Falha ao enviar automação');
        if (result.duplicate) return;

        const message: WhatsAppMessage = {
          id: `auto-${rule.id}-${now}`,
          sender: 'ai',
          text,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'delivered',
          ...(rule.sendPhoto
            ? { attachment: { type: 'image' as const, label: `📷 Foto — ${lead.vehicle}` } }
            : {}),
        };

        setLeads((prev) =>
          prev.map((candidate) => {
            if (candidate.id !== lead.id) return candidate;
            const fired = candidate.automation?.[rule.id];
            return {
              ...candidate,
              messages: [...candidate.messages, message],
              lastActivityAt: now,
              automation: {
                ...candidate.automation,
                [rule.id]: { count: (fired?.count ?? 0) + 1, lastAt: now },
              },
            };
          })
        );

        onActivity({
          id: `evt-${now}`,
          at: now,
          leadName: lead.clientName,
          ruleName: rule.name,
          mode,
          withPhoto: rule.sendPhoto,
          text,
        });
      } finally {
        engineBusy.current = false;
      }
    };

    const interval = setInterval(tick, TICK_MS);
    const kickoff = setTimeout(tick, 3_000);
    return () => {
      clearInterval(interval);
      clearTimeout(kickoff);
    };
  }, [running, setLeads, onActivity]);
}
