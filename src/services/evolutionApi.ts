export interface SendTextInput {
  number: string;
  text: string;
  delay?: number;
  idempotencyKey?: string;
}

export interface EvolutionSendResult {
  ok: boolean;
  mode: 'demo' | 'real';
  dryRun: boolean;
  message?: string;
  error?: string;
  duplicate?: boolean;
  request?: {
    method: string;
    url: string;
    body: SendTextInput;
  };
  evolution?: unknown;
}

export interface EvolutionStatusResult {
  ok: boolean;
  mode: 'demo' | 'real';
  configured: boolean;
  dryRun: boolean;
  instance: string | null;
  evolution?: unknown;
}

export interface EvolutionConnectResult {
  ok: boolean;
  mode: 'demo' | 'real';
  dryRun: boolean;
  instance: string;
  connection?: string;
  qrcode?: {
    code?: string;
    base64?: string | null;
  };
  evolution?: unknown;
  error?: string;
}

export interface CreateInstanceInput {
  instanceName: string;
  integration?: string;
}

export async function sendWhatsAppText(input: SendTextInput): Promise<EvolutionSendResult> {
  const response = await fetch('/api/evolution/send-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      mode: data.mode || 'demo',
      dryRun: Boolean(data.dryRun),
      error: data.error || 'Falha ao enviar mensagem',
      ...data,
    };
  }

  return data;
}

export interface SendMediaInput {
  number: string;
  media: string;
  caption?: string;
  mediatype?: 'image' | 'video' | 'document';
  mimetype?: string;
  fileName?: string;
  idempotencyKey?: string;
}

export async function sendWhatsAppMedia(input: SendMediaInput): Promise<EvolutionSendResult> {
  const response = await fetch('/api/evolution/send-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      mode: data.mode || 'demo',
      dryRun: Boolean(data.dryRun),
      error: data.error || 'Falha ao enviar mídia',
      ...data,
    };
  }
  return data;
}

export async function acknowledgeInboundMessage(id: string): Promise<void> {
  const response = await fetch('/api/evolution/ack-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Falha ao confirmar mensagem recebida');
}

export async function getEvolutionStatus(): Promise<EvolutionStatusResult> {
  const response = await fetch('/api/evolution/status');
  return response.json();
}

export async function connectEvolutionInstance(): Promise<EvolutionConnectResult> {
  const response = await fetch('/api/evolution/connect', {
    method: 'POST',
  });
  return response.json();
}

export async function createEvolutionInstance(input: CreateInstanceInput): Promise<EvolutionConnectResult> {
  const response = await fetch('/api/evolution/create-instance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return response.json();
}
