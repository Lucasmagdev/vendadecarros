export type KanbanStage = 'pre-atendimento' | 'follow-up' | 'agendado' | 'atendimento-humano' | 'venda-concluida';

export type AIAction =
  | 'Enviou fotos'
  | 'Enviou descrição'
  | 'Tirou dúvida'
  | 'Aguardando lead'
  | 'Enviou proposta'
  | 'Agendou visita'
  | 'Follow-up programado'
  | 'Transferiu para humano';

export type MessageSender = 'lead' | 'ai' | 'human';

export interface WhatsAppMessage {
  id: string;
  sender: MessageSender;
  text: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  attachment?: {
    type: 'image' | 'catalog';
    label: string;
  };
}

export interface Lead {
  id: string;
  clientName: string;
  vehicle: string;
  vehicleImage: string;
  stage: KanbanStage;
  status: string;
  aiActions?: AIAction[];
  scheduledAt?: string;
  budgetRange: string;
  phone: string;
  avatarInitials: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  source: string;
  intent: string;
  temperature: 'quente' | 'morno' | 'frio';
  nextAction: string;
  followUpAt?: string;
  aiSummary: string;
  handoffReason?: string;
  messages: WhatsAppMessage[];
  automation?: Record<string, AutomationFire>;
  lastActivityAt?: number;
}

export type AutomationTrigger =
  | 'sem-resposta'
  | 'proposta-sem-resposta'
  | 'visita-agendada'
  | 'lead-frio';

export type MessageMode = 'template' | 'ia';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  enabled: boolean;
  waitLabel: string;
  waitMinutes: number[];
  maxAttempts: number | null;
  mode: MessageMode;
  template: string;
  aiInstruction: string;
  sendPhoto: boolean;
}

export interface AutomationFire {
  count: number;
  lastAt: number;
}

export interface ActivityEvent {
  id: string;
  at: number;
  leadName: string;
  ruleName: string;
  mode: MessageMode;
  withPhoto: boolean;
  text: string;
}

export interface InventoryVehicle {
  id: string;
  model: string;
  year: string;
  price: string;
  mileage: string;
  status: 'disponivel' | 'reservado' | 'vendido' | 'revisao';
  source: 'manual' | 'planilha' | 'site' | 'dms';
  lastSync: string;
  image: string;
  highlights: string[];
}
