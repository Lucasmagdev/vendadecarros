import { AutomationRule } from '../types';

export const initialAutomationRules: AutomationRule[] = [
  {
    id: 'r1',
    name: 'Lembrete rápido',
    description: 'Lead parou de responder durante o pré-atendimento',
    trigger: 'sem-resposta',
    enabled: true,
    waitLabel: '30 min',
    waitMinutes: [30, 1440],
    maxAttempts: 2,
    mode: 'ia',
    template: 'Oi {nome}! Ficou alguma dúvida sobre o {veiculo}? Estou por aqui 😊',
    sendPhoto: true,
    aiInstruction:
      'Retome a conversa de forma leve, referenciando a última dúvida do lead. Sem pressão, tom amigável.',
  },
  {
    id: 'r2',
    name: 'Proposta sem resposta',
    description: 'Lead recebeu proposta, visualizou e não respondeu',
    trigger: 'proposta-sem-resposta',
    enabled: true,
    waitLabel: '2h, 24h, 72h',
    waitMinutes: [120, 1440, 4320],
    maxAttempts: 3,
    mode: 'template',
    template:
      'Oi {nome}! A condição do {veiculo} com parcela de {parcela} vale até hoje. Quer que eu reserve a unidade pra você?',
    sendPhoto: false,
    aiInstruction:
      'Reforce a parcela e a condição enviada, crie urgência leve (validade da condição), sem pressionar.',
  },
  {
    id: 'r3',
    name: 'Confirmação de visita',
    description: 'Lembrete automático antes da visita agendada',
    trigger: 'visita-agendada',
    enabled: true,
    waitLabel: '1 dia antes + 2h antes',
    waitMinutes: [1440, 120],
    maxAttempts: null,
    mode: 'template',
    template:
      'Oi {nome}! Confirmando sua visita amanhã às {horario} para ver o {veiculo}. Te esperamos na loja! 🚗',
    sendPhoto: false,
    aiInstruction:
      'Confirme a visita citando horário e veículo, ofereça reagendar caso não possa comparecer.',
  },
  {
    id: 'r4',
    name: 'Reativação de lead frio',
    description: 'Lead sem contato há 7 dias',
    trigger: 'lead-frio',
    enabled: false,
    waitLabel: '7 dias',
    waitMinutes: [10080],
    maxAttempts: 1,
    mode: 'ia',
    template:
      'Oi {nome}! Chegou novidade no estoque parecida com o {veiculo} que você procurava. Quer ver?',
    sendPhoto: false,
    aiInstruction:
      'Reative o lead oferecendo veículo do estoque atual compatível com o que ele procurava. Mencione preço e diferencial.',
  },
];
