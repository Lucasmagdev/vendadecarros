import { useEffect, useRef } from 'react';
import { ActivityEvent, Lead, WhatsAppMessage } from '../types';
import { generateAutoReply } from '../services/ai';
import {
  acknowledgeInboundMessage,
  sendWhatsAppMedia,
  sendWhatsAppText,
} from '../services/evolutionApi';
import { asksForPhoto, matchInventoryVehicle } from '../services/inventoryMatch';

const POLL_MS = 12_000;

// Compartilhado entre instâncias do hook (React StrictMode monta em dobro):
// garante que cada mensagem recebida seja processada uma única vez.
const processedIds = new Set<string>();
const inboundBusy = { current: false };

const AUTO_REPLY_INSTRUCTION =
  'Responda a última mensagem do cliente de forma útil e objetiva. Se ele pediu detalhes/ficha do carro, use os dados oficiais da ficha (ano, km, preço, destaques). Ofereça agendar uma visita quando fizer sentido. Se o cliente confirmar dia e horário, confirme o agendamento na resposta. Se faltar informação, diga que vai confirmar com a equipe.';

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

        for (const record of inbound) {
          const current = leadsRef.current;
          const existing = findLeadByJid(current, record.remoteJid);
          const alreadyKnown =
            processedIds.has(record.id) ||
            existing?.messages.some((message) => message.id === `auto-reply-${record.id}`);
          if (alreadyKnown) continue;

          const message: WhatsAppMessage = {
            id: record.id,
            sender: 'lead',
            text: record.text,
            time: record.timestamp
              ? new Date(record.timestamp * 1000).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          };

          let lead: Lead;
          if (existing) {
            const hasInbound = existing.messages.some((item) => item.id === record.id);
            lead = {
              ...existing,
              messages: hasInbound ? existing.messages : [...existing.messages, message],
              lastActivityAt: Date.now(),
            };
          } else {
            lead = { ...createLeadFromInbound(record, message), lastActivityAt: Date.now() };
          }

          // Cliente citou um carro? Casa com o estoque e qualifica o lead.
          const previousVehicle = lead.vehicle;
          const cited = matchInventoryVehicle(record.text);
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

          if (existing) {
            setLeads((prev) => prev.map((item) => (item.id === lead.id ? lead : item)));
          } else {
            setLeads((prev) => [...prev, lead]);
          }
          leadsRef.current = leadsRef.current.some((item) => item.id === lead.id)
            ? leadsRef.current.map((item) => (item.id === lead.id ? lead : item))
            : [...leadsRef.current, lead];

          // IA responde sozinha apenas leads em pré-atendimento.
          if (lead.stage !== 'pre-atendimento') continue;

          const generated = existing
            ? await generateAutoReply(
                AUTO_REPLY_INSTRUCTION,
                lead,
                `Oi ${lead.clientName.split(' ')[0]}! Recebi sua mensagem e já te ajudo com os detalhes.`
              )
            : { ok: true as const, mode: 'demo' as const, text: buildWelcomeMessage(lead), scheduledAt: null };
          const scheduledAt = generated.scheduledAt || null;
          // Envia a foto ao identificar o modelo pela primeira vez ou quando o cliente pedir.
          const stock = matchInventoryVehicle(lead.vehicle);
          const identifiedNow = Boolean(cited) && previousVehicle !== cited?.model;
          const photoAlreadySent = Boolean(stock) && lead.messages.some(
            (item) => item.attachment?.type === 'image' && item.attachment.label.includes(stock!.model)
          );
          const sendPhoto = Boolean(stock) && (asksForPhoto(record.text) || (identifiedNow && !photoAlreadySent));

          const idempotencyKey = `inbound-reply:${record.id}`;
          const sendResult = sendPhoto && stock
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
            processedIds.add(record.id);
            await acknowledgeInboundMessage(record.id);
            continue;
          }

          const reply: WhatsAppMessage = {
            id: `auto-reply-${record.id}`,
            sender: 'ai',
            text: generated.text,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: 'delivered',
            ...(sendPhoto && stock
              ? { attachment: { type: 'image' as const, label: `📷 Foto — ${stock.model}` } }
              : {}),
          };
          setLeads((prev) =>
            prev.map((item) => {
              if (item.id !== lead.id) return item;
              const updated: Lead = {
                ...item,
                messages: [...item.messages, reply],
                lastActivityAt: Date.now(),
              };
              // Cliente confirmou visita → IA agenda e move o card sozinha.
              if (scheduledAt) {
                updated.stage = 'agendado';
                updated.scheduledAt = scheduledAt;
                updated.status = `Visita agendada pela IA para ${new Date(scheduledAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`;
                updated.nextAction = 'Confirmar visita 1 dia antes (automático)';
                updated.aiActions = [...(item.aiActions || []), 'Agendou visita'];
              }
              return updated;
            })
          );

          onActivity({
            id: `inbound-${record.id}`,
            at: Date.now(),
            leadName: lead.clientName,
            ruleName: scheduledAt ? 'Visita agendada pela IA' : 'Atendimento automático',
            mode: 'ia',
            withPhoto: sendPhoto,
            text: generated.text,
          });
          processedIds.add(record.id);
          await acknowledgeInboundMessage(record.id);
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
