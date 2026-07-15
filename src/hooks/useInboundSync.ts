import { useEffect, useRef } from 'react';
import { ActivityEvent, Lead, WhatsAppMessage } from '../types';
import { generateAutoReply } from '../services/ai';
import {
  acknowledgeInboundMessages,
  sendWhatsAppMedia,
  sendWhatsAppText,
} from '../services/evolutionApi';
import { asksForPhoto, matchInventoryVehicle } from '../services/inventoryMatch';

const POLL_MS = 4_000;

// Compartilhado entre instâncias do hook (React StrictMode monta em dobro):
// garante que cada mensagem recebida seja processada uma única vez.
const processedIds = new Set<string>();
const inboundBusy = { current: false };

const AUTO_REPLY_INSTRUCTION =
  'Leia as últimas mensagens como uma conversa contínua e responda ao conjunto mais recente em uma única mensagem. Não repita saudação nem apresentação. Se forem frases fragmentadas, junte o sentido antes de responder. Se a conversa for casual ou fora do assunto, responda em no máximo uma frase e redirecione com leveza para a busca do carro, sem insistir. Se ele pediu detalhes, use a ficha oficial. Ofereça visita somente quando houver interesse real. Se confirmar dia e horário, confirme o agendamento. Nunca invente informação.';

interface InboundRecord {
  id: string;
  fromMe: boolean;
  remoteJid: string;
  pushName: string;
  text: string;
  timestamp: number;
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

function findLeadByJid(leads: Lead[], remoteJid: string): Lead | undefined {
  const jidDigits = digitsOf(remoteJid.split('@')[0]);
  if (jidDigits.length < 8) return undefined;
  return leads.find((lead) => {
    const phone = digitsOf(lead.phone);
    return phone.slice(-8) === jidDigits.slice(-8);
  });
}

function createLeadFromInbound(record: InboundRecord, message: WhatsAppMessage): Lead {
  const phone = digitsOf(record.remoteJid.split('@')[0]);
  const name = record.pushName || `WhatsApp ${phone.slice(-4)}`;
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    id: `wa-${phone}`,
    clientName: name,
    vehicle: 'Interesse a identificar',
    vehicleImage:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Onix_Activ_2017_%2849170997611%29.jpg?width=900',
    stage: 'pre-atendimento',
    status: 'Novo lead entrou pelo WhatsApp — IA em atendimento',
    budgetRange: 'A qualificar',
    phone: `+${phone}`,
    avatarInitials: initials,
    priority: 'medium',
    createdAt: new Date().toISOString(),
    source: 'WhatsApp',
    intent: 'A identificar',
    temperature: 'morno',
    nextAction: 'IA qualificando o lead automaticamente',
    aiSummary: 'Lead novo, entrou pelo WhatsApp conectado. IA iniciou qualificação.',
    messages: [message],
  };
}

function buildWelcomeMessage(lead: Lead): string {
  const firstName = lead.clientName.split(' ')[0];
  if (lead.vehicle !== 'Interesse a identificar') {
    return `Oi, ${firstName}! Sou a assistente virtual da loja. Temos o ${lead.vehicle} no estoque. Posso ajudar com preço, financiamento, troca ou agendar uma visita?`;
  }
  return `Oi, ${firstName}! Sou a assistente virtual da loja. Como posso te ajudar? Você procura algum modelo ou faixa de preço específica?`;
}

function findRecentVehicle(messages: WhatsAppMessage[]) {
  return [...messages]
    .reverse()
    .filter((message) => message.sender === 'lead')
    .map((message) => matchInventoryVehicle(message.text))
    .find(Boolean) || null;
}

function buildPhotoCaption(stock: NonNullable<ReturnType<typeof matchInventoryVehicle>>): string {
  return `Aqui está o ${stock.model}, ano ${stock.year}, com ${stock.mileage}, por ${stock.price}. Destaques: ${stock.highlights.join(', ')}. Quer agendar uma visita para conhecer?`;
}

export function useInboundSync(
  leads: Lead[],
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>,
  onActivity: (event: ActivityEvent) => void,
  running: boolean
) {
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  useEffect(() => {
    if (!running) return;

    const tick = async () => {
      if (inboundBusy.current) return;
      inboundBusy.current = true;
      try {
        const response = await fetch('/api/evolution/find-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset: 50 }),
        });
        const data = await response.json();
        const records: InboundRecord[] = Array.isArray(data.records) ? data.records : [];
        const inbound = records.filter(
          (record) => !record.fromMe && !record.remoteJid.includes('@g.us')
        );
        if (inbound.length === 0) return;

        const groups = new Map<string, InboundRecord[]>();
        for (const record of inbound.sort((a, b) => a.timestamp - b.timestamp)) {
          const key = record.remoteJid.split('@')[0];
          groups.set(key, [...(groups.get(key) || []), record]);
        }

        for (const records of groups.values()) {
          const current = leadsRef.current;
          const firstRecord = records[0];
          const lastRecord = records[records.length - 1];
          const existing = findLeadByJid(current, firstRecord.remoteJid);
          const pending = records.filter(
            (record) =>
              !processedIds.has(record.id) &&
              !existing?.messages.some((message) => message.id === `auto-reply-${record.id}`)
          );
          if (pending.length === 0) continue;

          const inboundMessages: WhatsAppMessage[] = pending.map((record) => ({
            id: record.id,
            sender: 'lead',
            text: record.text,
            time: record.timestamp
              ? new Date(record.timestamp * 1000).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          }));

          let lead: Lead;
          if (existing) {
            const knownIds = new Set(existing.messages.map((message) => message.id));
            lead = {
              ...existing,
              messages: [...existing.messages, ...inboundMessages.filter((message) => !knownIds.has(message.id))],
              lastActivityAt: Date.now(),
            };
          } else {
            lead = {
              ...createLeadFromInbound(firstRecord, inboundMessages[0]),
              messages: inboundMessages,
              lastActivityAt: Date.now(),
            };
          }

          const combinedText = pending.map((record) => record.text).join('\n');
          const previousVehicle = lead.vehicle;
          const cited =
            matchInventoryVehicle(combinedText) ||
            matchInventoryVehicle(lead.vehicle) ||
            findRecentVehicle(lead.messages);
          if (cited && lead.vehicle !== cited.model) {
            lead = {
              ...lead,
              vehicle: cited.model,
              vehicleImage: cited.image,
              budgetRange: cited.price,
              intent: `Interessado no ${cited.model}`,
              status: `IA atendendo — interesse identificado: ${cited.model}`,
            };
          }

          if (lead.stage !== 'pre-atendimento') {
            setLeads((prev) => prev.map((item) => (item.id === lead.id ? lead : item)));
            leadsRef.current = current.map((item) => (item.id === lead.id ? lead : item));
            pending.forEach((record) => processedIds.add(record.id));
            await acknowledgeInboundMessages(pending.map((record) => record.id));
            continue;
          }

          const stock = matchInventoryVehicle(lead.vehicle);
          const identifiedNow = Boolean(cited) && previousVehicle !== cited?.model;
          const photoAlreadySent = Boolean(stock) && lead.messages.some(
            (item) => item.attachment?.type === 'image' && item.attachment.label.includes(stock!.model)
          );
          const sendPhoto =
            Boolean(stock) && (asksForPhoto(combinedText) || (identifiedNow && !photoAlreadySent));
          const generated = sendPhoto && stock
            ? { ok: true as const, mode: 'demo' as const, text: buildPhotoCaption(stock), scheduledAt: null }
            : existing
              ? await generateAutoReply(
                  AUTO_REPLY_INSTRUCTION,
                  lead,
                  'Entendi. Me conta qual carro você procura e eu te ajudo por aqui.'
                )
              : { ok: true as const, mode: 'demo' as const, text: buildWelcomeMessage(lead), scheduledAt: null };
          const scheduledAt = generated.scheduledAt || null;
          const idempotencyKey = `inbound-reply:${firstRecord.id}:${lastRecord.id}:${pending.length}`;
          const sendResult =
            sendPhoto && stock
              ? await sendWhatsAppMedia({
                  number: digitsOf(lead.phone),
                  media: stock.image,
                  caption: generated.text,
                  mediatype: 'image',
                  mimetype: 'image/jpeg',
                  fileName: `${stock.id}-veiculo.jpg`,
                  idempotencyKey,
                })
              : await sendWhatsAppText({
                  number: digitsOf(lead.phone),
                  text: generated.text,
                  idempotencyKey,
                });

          if (!sendResult.ok) throw new Error(sendResult.error || 'Falha ao responder lead');
          if (sendResult.duplicate) {
            pending.forEach((record) => processedIds.add(record.id));
            await acknowledgeInboundMessages(pending.map((record) => record.id));
            continue;
          }

          const reply: WhatsAppMessage = {
            id: `auto-reply-${lastRecord.id}`,
            sender: 'ai',
            text: generated.text,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: 'delivered',
            ...(sendPhoto && stock
              ? { attachment: { type: 'image' as const, label: `📷 Foto — ${stock.model}` } }
              : {}),
          };
          const updatedLead: Lead = {
            ...lead,
            messages: [...lead.messages, reply],
            lastActivityAt: Date.now(),
          };
          if (scheduledAt) {
            updatedLead.stage = 'agendado';
            updatedLead.scheduledAt = scheduledAt;
            updatedLead.status = `Visita agendada pela IA para ${new Date(scheduledAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}`;
            updatedLead.nextAction = 'Confirmar visita 1 dia antes (automático)';
            updatedLead.aiActions = [...(lead.aiActions || []), 'Agendou visita'];
          }

          setLeads((prev) => {
            const exists = prev.some((item) => item.id === updatedLead.id);
            return exists
              ? prev.map((item) => (item.id === updatedLead.id ? updatedLead : item))
              : [...prev, updatedLead];
          });
          leadsRef.current = current.some((item) => item.id === updatedLead.id)
            ? current.map((item) => (item.id === updatedLead.id ? updatedLead : item))
            : [...current, updatedLead];

          onActivity({
            id: `inbound-${lastRecord.id}`,
            at: Date.now(),
            leadName: updatedLead.clientName,
            ruleName: scheduledAt ? 'Visita agendada pela IA' : 'Atendimento automático',
            mode: 'ia',
            withPhoto: sendPhoto,
            text: generated.text,
          });
          pending.forEach((record) => processedIds.add(record.id));
          await acknowledgeInboundMessages(pending.map((record) => record.id));
        }
      } catch {
        // bridge fora do ar — tenta no próximo ciclo
      } finally {
        inboundBusy.current = false;
      }
    };

    const interval = setInterval(tick, POLL_MS);
    const kickoff = setTimeout(tick, 5_000);
    return () => {
      clearInterval(interval);
      clearTimeout(kickoff);
    };
  }, [running, setLeads, onActivity]);
}
