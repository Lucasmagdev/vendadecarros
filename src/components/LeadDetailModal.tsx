import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Calendar,
  Car,
  CheckCheck,
  Clock,
  Loader2,
  MessageCircle,
  Phone,
  Send,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { Lead, WhatsAppMessage } from '../types';
import AIActionTag from './AIActionTag';
import { EvolutionSendResult, sendWhatsAppText } from '../services/evolutionApi';

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onSendMessage: (leadId: string, message: WhatsAppMessage) => void;
  onDelete: (leadId: string) => Promise<void>;
}

const statusLabel = {
  sent: 'enviada',
  delivered: 'entregue',
  read: 'lida',
};

export default function LeadDetailModal({ lead, onClose, onSendMessage, onDelete }: Props) {
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<EvolutionSendResult | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageCount = lead?.messages.length ?? 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messageCount]);

  useEffect(() => {
    setConfirmingDelete(false);
    setDeleteError('');
  }, [lead?.id]);

  if (!lead) return null;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setSendResult(null);

    try {
      const result = await sendWhatsAppText({
        number: lead.phone.replace(/\D/g, ''),
        text,
      });
      setSendResult(result);
      if (result.ok) {
        onSendMessage(lead.id, {
          id: `human-${Date.now()}`,
          sender: 'human',
          text,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'sent',
        });
        setDraft('');
      }
    } catch (error) {
      setSendResult({
        ok: false,
        mode: 'demo',
        dryRun: true,
        error: error instanceof Error ? error.message : 'Não foi possível chamar a ponte Evolution API',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDelete(lead.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir o lead');
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-lg border border-gold/30 bg-navy-900 shadow-2xl lg:grid-cols-[1.05fr_0.95fr]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-navy-950/70 p-2 text-slate-300 backdrop-blur-sm transition hover:bg-navy-950 hover:text-gold"
          title="Fechar"
        >
          <X size={18} />
        </button>

        <section className="overflow-y-auto border-b border-gold/15 lg:border-b-0 lg:border-r">
          <div className="relative h-44 overflow-hidden">
            <img src={lead.vehicleImage} alt={lead.vehicle} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/35 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                <MessageCircle size={13} />
                WhatsApp em atendimento
              </div>
              <h2 className="text-2xl font-bold text-slate-50">{lead.clientName}</h2>
              <p className="text-sm text-gold/90">{lead.vehicle}</p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={Phone} label="Telefone" value={lead.phone} />
              <InfoRow icon={Wallet} label="Orçamento" value={lead.budgetRange} />
              <InfoRow icon={Car} label="Origem" value={lead.source} />
              <InfoRow icon={User} label="Temperatura" value={lead.temperature} />
              {lead.scheduledAt && (
                <InfoRow
                  icon={Calendar}
                  label="Agendado"
                  value={new Date(lead.scheduledAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              )}
              {lead.followUpAt && (
                <InfoRow
                  icon={Clock}
                  label="Follow-up"
                  value={new Date(lead.followUpAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              )}
            </div>

            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                <Bot size={14} />
                Diagnóstico da IA
              </div>
              <p className="text-sm leading-relaxed text-slate-200">{lead.aiSummary}</p>
              <div className="mt-3 rounded-md border border-slate-700/50 bg-navy-950/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Intenção detectada</p>
                <p className="mt-1 text-xs text-slate-300">{lead.intent}</p>
              </div>
              {lead.handoffReason && (
                <div className="mt-3 rounded-md border border-rose-400/25 bg-rose-400/5 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-rose-300">Motivo do handoff</p>
                  <p className="mt-1 text-xs text-slate-300">{lead.handoffReason}</p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">Ações executadas</p>
              <div className="flex flex-wrap gap-2">
                {lead.aiActions?.map((action) => (
                  <AIActionTag key={action} action={action} />
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gold/30 bg-gold/10 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20">
                <MessageCircle size={16} /> Abrir WhatsApp
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gold/30 bg-gold py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-gold-light">
                <Calendar size={16} /> Agendar visita
              </button>
            </div>

            {confirmingDelete ? (
              <div className="rounded-lg border border-rose-400/30 bg-rose-400/5 p-3">
                <p className="text-sm font-semibold text-rose-200">Excluir este lead do CRM?</p>
                <p className="mt-1 text-xs text-slate-400">
                  A conversa continuará no WhatsApp. Uma nova mensagem desse número criará um novo lead.
                </p>
                {deleteError && <p className="mt-2 text-xs text-rose-300">{deleteError}</p>}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={isDeleting}
                    className="rounded-md px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-2 rounded-md bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Confirmar exclusão
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-400/20 py-2.5 text-sm font-semibold text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-400/5"
              >
                <Trash2 size={15} /> Excluir lead
              </button>
            )}
          </div>
        </section>

        <section className="flex max-h-[92vh] flex-col overflow-hidden">
          <div className="border-b border-gold/15 bg-navy-950/50 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Conversa WhatsApp</p>
                <h3 className="text-lg font-bold text-slate-100">Pré-atendimento automatizado</h3>
              </div>
              <div className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                Instância conectada
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#0b1b17] p-4">
            <div className="space-y-3">
              {lead.messages.map((message) => (
                <WhatsAppBubble key={message.id} message={message} />
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="border-t border-gold/15 bg-navy-950 p-4">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-700/60 bg-navy-900/70 px-3 py-2">
              <Zap size={13} className="shrink-0 text-gold" />
              <p className="truncate text-xs text-slate-300" title={lead.nextAction}>
                <span className="font-semibold text-gold">Próxima automação:</span> {lead.nextAction}
              </p>
            </div>

            {sendResult && (
              <div className={`mb-2 rounded-md border px-3 py-2 text-xs ${sendResult.ok ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200' : 'border-rose-400/30 bg-rose-400/5 text-rose-200'}`}>
                {sendResult.ok
                  ? sendResult.dryRun
                    ? 'Envio simulado (dry-run). Mensagem registrada na conversa.'
                    : 'Mensagem enviada pelo WhatsApp via Evolution API.'
                  : sendResult.error}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                placeholder="Escreva uma mensagem para o lead... (Enter envia)"
                className="max-h-28 flex-1 resize-none rounded-lg border border-slate-700 bg-navy-900/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-gold/50"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !draft.trim()}
                title="Enviar pelo WhatsApp"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gold text-navy-950 transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700/40 bg-navy-950/40 px-3 py-2.5">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        <Icon size={11} /> {label}
      </div>
      <p className="truncate text-sm text-slate-200">{value}</p>
    </div>
  );
}

function WhatsAppBubble({ message }: { message: WhatsAppMessage }) {
  const isLead = message.sender === 'lead';
  const senderLabel = message.sender === 'ai' ? 'IA' : message.sender === 'human' ? 'Vendedor' : 'Lead';

  return (
    <div className={`flex ${isLead ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[82%] rounded-lg px-3 py-2 shadow-sm ${
          isLead
            ? 'bg-slate-100 text-slate-950'
            : message.sender === 'human'
              ? 'bg-gold text-navy-950'
              : 'bg-emerald-600 text-white'
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-4">
          <span className={`text-[10px] font-bold ${isLead ? 'text-slate-500' : 'text-white/80'}`}>{senderLabel}</span>
          <span className={`text-[10px] ${isLead ? 'text-slate-500' : 'text-white/75'}`}>{message.time}</span>
        </div>
        <p className="text-sm leading-relaxed">{message.text}</p>
        {message.attachment && (
          <div className={`mt-2 rounded-md border px-2 py-1.5 text-xs ${isLead ? 'border-slate-300 bg-slate-200' : 'border-white/25 bg-white/10'}`}>
            {message.attachment.label}
          </div>
        )}
        {message.status && (
          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.status === 'read' ? 'text-cyan-200' : 'text-white/70'}`}>
            <CheckCheck size={12} />
            {statusLabel[message.status]}
          </div>
        )}
      </div>
    </div>
  );
}
