const http = require('http');
const fs = require('fs');
const path = require('path');

loadDotEnv();

const PORT = Number(process.env.API_PORT || 8787);
const EVOLUTION_API_URL = trimTrailingSlash(process.env.EVOLUTION_API_URL || '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';
const EVOLUTION_DRY_RUN = process.env.EVOLUTION_DRY_RUN !== 'false';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const APP_USERNAME = process.env.APP_USERNAME || '';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const DATA_DIR = path.resolve(process.env.DATA_DIR || __dirname);
const DIST_PATH = path.resolve(__dirname, '..', 'dist');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'db.json');
const CONSUMED_PATH = path.join(DATA_DIR, 'consumed-messages.json');
const OUTBOUND_PATH = path.join(DATA_DIR, 'outbound-idempotency.json');
const DELETED_LEADS_PATH = path.join(DATA_DIR, 'deleted-leads.json');
const MESSAGE_LEASE_MS = 60_000;

// Ids de mensagens já entregues a um cliente do CRM — garante processamento único
// mesmo com o app aberto em várias abas/navegadores.
let consumedIds = new Set();
try {
  consumedIds = new Set(JSON.parse(fs.readFileSync(CONSUMED_PATH, 'utf8')));
} catch {
  // primeiro uso — arquivo ainda não existe
}

let outboundIds = new Set();
try {
  outboundIds = new Set(JSON.parse(fs.readFileSync(OUTBOUND_PATH, 'utf8')));
} catch {
  // Primeiro uso: ainda nao existem disparos registrados.
}

const claimedIds = new Map();
let deletedLeads = {};
try {
  deletedLeads = JSON.parse(fs.readFileSync(DELETED_LEADS_PATH, 'utf8'));
} catch {
  // Primeiro uso: nenhum lead foi excluido.
}

// Mensagens anteriores ao bridge subir são histórico — nunca devem gerar
// lead novo nem resposta automática. Só entra o que chegar daqui pra frente.
const BRIDGE_STARTED_AT = Math.floor(Date.now() / 1000);

function markConsumed(ids) {
  for (const id of ids) consumedIds.add(id);
  // guarda só os 500 mais recentes para o arquivo não crescer sem limite
  const all = Array.from(consumedIds).slice(-500);
  consumedIds = new Set(all);
  fs.writeFileSync(CONSUMED_PATH, JSON.stringify(all), 'utf8');
}

function reserveOutbound(id) {
  if (!id || outboundIds.has(id)) return false;
  outboundIds.add(id);
  persistOutboundIds();
  return true;
}

function releaseOutbound(id) {
  if (!id) return;
  outboundIds.delete(id);
  persistOutboundIds();
}

function persistOutboundIds() {
  const all = Array.from(outboundIds).slice(-2_000);
  outboundIds = new Set(all);
  fs.writeFileSync(OUTBOUND_PATH, JSON.stringify(all), 'utf8');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url !== '/api/health' && !isAuthorized(req)) {
    res.writeHead(401, {
      'Content-Type': 'application/json; charset=utf-8',
      'WWW-Authenticate': 'Basic realm="AutoCRM IA"',
    });
    res.end(JSON.stringify({ ok: false, error: 'Autenticação necessária' }));
    return;
  }

  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'autocrm-api', uptime: Math.round(process.uptime()) });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/evolution/status') {
      await handleStatus(res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/evolution/connect') {
      await handleConnect(res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/evolution/create-instance') {
      await handleCreateInstance(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/evolution/send-text') {
      await handleSendText(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/evolution/send-media') {
      await handleSendMedia(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/evolution/find-messages') {
      await handleFindMessages(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/evolution/ack-message') {
      await handleAckMessage(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai/generate') {
      await handleAiGenerate(req, res);
      return;
    }

    if (req.method === 'GET' && req.url === '/api/db/state') {
      handleDbGet(res);
      return;
    }

    if (req.method === 'PUT' && req.url === '/api/db/state') {
      await handleDbPut(req, res);
      return;
    }

    const deleteLeadMatch = req.url && req.url.match(/^\/api\/db\/leads\/([^/?]+)$/);
    if (req.method === 'DELETE' && deleteLeadMatch) {
      handleLeadDelete(decodeURIComponent(deleteLeadMatch[1]), res);
      return;
    }

    if (req.method === 'GET' && serveStatic(req, res)) return;

    sendJson(res, 404, { ok: false, error: 'Endpoint não encontrado' });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Erro inesperado',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Evolution API bridge listening on http://127.0.0.1:${PORT}`);
});

// EVOLUTION_DRY_RUN só bloqueia envio de mensagens (sendText/sendMedia).
// Status, connect e criação de instância sempre falam com a Evolution real quando configurada.
async function handleStatus(res) {
  const configured = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);

  if (!configured) {
    sendJson(res, 200, {
      ok: true,
      mode: 'demo',
      configured,
      dryRun: EVOLUTION_DRY_RUN,
      instance: EVOLUTION_INSTANCE || null,
    });
    return;
  }

  const url = `${EVOLUTION_API_URL}/instance/connectionState/${encodeURIComponent(EVOLUTION_INSTANCE)}`;
  const response = await fetch(url, {
    headers: {
      apikey: EVOLUTION_API_KEY,
    },
  });
  const data = await readJsonSafe(response);

  sendJson(res, response.ok ? 200 : response.status, {
    ok: response.ok,
    mode: 'real',
    configured,
    dryRun: EVOLUTION_DRY_RUN,
    instance: EVOLUTION_INSTANCE,
    evolution: data,
  });
}

async function handleConnect(res) {
  const configured = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);
  const evolutionUrl = configured
    ? `${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}`
    : null;

  if (!configured) {
    sendJson(res, 200, {
      ok: true,
      mode: 'demo',
      dryRun: true,
      instance: EVOLUTION_INSTANCE || 'loja-whatsapp',
      connection: 'connecting',
      qrcode: {
        code: 'DEMO-QR-AUTOCRM-IA',
        base64: null,
      },
      request: {
        method: 'GET',
        url: evolutionUrl || '{EVOLUTION_API_URL}/instance/connect/{EVOLUTION_INSTANCE}',
        headers: { apikey: configured ? '***configurado***' : '{EVOLUTION_API_KEY}' },
      },
    });
    return;
  }

  const response = await fetch(evolutionUrl, {
    headers: {
      apikey: EVOLUTION_API_KEY,
    },
  });
  const data = await readJsonSafe(response);

  sendJson(res, response.ok ? 200 : response.status, {
    ok: response.ok,
    mode: 'real',
    dryRun: false,
    instance: EVOLUTION_INSTANCE,
    evolution: data,
  });
}

async function handleCreateInstance(req, res) {
  const body = await readRequestJson(req);
  const instanceName = typeof body.instanceName === 'string' && body.instanceName.trim()
    ? body.instanceName.trim()
    : EVOLUTION_INSTANCE || 'loja-whatsapp';
  const configured = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY);
  const evolutionUrl = configured ? `${EVOLUTION_API_URL}/instance/create` : null;
  const payload = {
    instanceName,
    qrcode: true,
    integration: body.integration || 'WHATSAPP-BAILEYS',
  };

  if (!configured) {
    sendJson(res, 200, {
      ok: true,
      mode: 'demo',
      dryRun: true,
      instance: instanceName,
      message: 'Instância simulada. Configure a Evolution API para criar de verdade.',
      request: {
        method: 'POST',
        url: evolutionUrl || '{EVOLUTION_API_URL}/instance/create',
        headers: { apikey: configured ? '***configurado***' : '{EVOLUTION_API_KEY}' },
        body: payload,
      },
    });
    return;
  }

  const response = await fetch(evolutionUrl, {
    method: 'POST',
    headers: {
      apikey: EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe(response);

  sendJson(res, response.ok ? 200 : response.status, {
    ok: response.ok,
    mode: 'real',
    dryRun: false,
    instance: instanceName,
    evolution: data,
  });
}

async function handleSendText(req, res) {
  const body = await readRequestJson(req);
  const number = normalizePhone(body.number);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const delay = Number.isFinite(Number(body.delay)) ? Number(body.delay) : undefined;
  const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);

  if (!number || !text) {
    sendJson(res, 400, {
      ok: false,
      error: 'Informe number e text',
    });
    return;
  }

  const configured = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);
  const evolutionUrl = configured
    ? `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`
    : null;
  const payload = delay ? { number, text, delay } : { number, text };

  if (idempotencyKey && !reserveOutbound(idempotencyKey)) {
    sendJson(res, 200, {
      ok: true,
      mode: configured && !EVOLUTION_DRY_RUN ? 'real' : 'demo',
      dryRun: !configured || EVOLUTION_DRY_RUN,
      duplicate: true,
      message: 'Disparo ja processado; envio duplicado bloqueado.',
    });
    return;
  }

  if (!configured || EVOLUTION_DRY_RUN) {
    sendJson(res, 200, {
      ok: true,
      mode: 'demo',
      dryRun: true,
      message: 'Envio simulado. Configure EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE e EVOLUTION_DRY_RUN=false para enviar de verdade.',
      request: {
        method: 'POST',
        url: evolutionUrl || '{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}',
        headers: { apikey: configured ? '***configurado***' : '{EVOLUTION_API_KEY}' },
        body: payload,
      },
    });
    return;
  }

  let response;
  let data;
  try {
    response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        apikey: EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    data = await readJsonSafe(response);
  } catch (error) {
    releaseOutbound(idempotencyKey);
    throw error;
  }
  if (!response.ok) releaseOutbound(idempotencyKey);

  sendJson(res, response.ok ? 200 : response.status, {
    ok: response.ok,
    mode: 'real',
    dryRun: false,
    request: {
      method: 'POST',
      url: evolutionUrl,
      body: payload,
    },
    evolution: data,
  });
}

async function handleSendMedia(req, res) {
  const body = await readRequestJson(req);
  const number = normalizePhone(body.number);
  const media = typeof body.media === 'string' ? body.media.trim() : '';
  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  const mediatype = typeof body.mediatype === 'string' ? body.mediatype : 'image';
  const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);

  if (!number || !media) {
    sendJson(res, 400, { ok: false, error: 'Informe number e media (URL ou base64)' });
    return;
  }

  const configured = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);
  const evolutionUrl = configured
    ? `${EVOLUTION_API_URL}/message/sendMedia/${encodeURIComponent(EVOLUTION_INSTANCE)}`
    : null;
  const mediaData = await prepareMedia(media, body.mimetype, body.fileName);
  const payload = {
    number,
    mediatype,
    mimetype: mediaData.mimetype,
    media: mediaData.media,
    caption,
    fileName: mediaData.fileName,
  };

  if (idempotencyKey && !reserveOutbound(idempotencyKey)) {
    sendJson(res, 200, {
      ok: true,
      mode: configured && !EVOLUTION_DRY_RUN ? 'real' : 'demo',
      dryRun: !configured || EVOLUTION_DRY_RUN,
      duplicate: true,
      message: 'Disparo de midia ja processado; envio duplicado bloqueado.',
    });
    return;
  }

  if (!configured || EVOLUTION_DRY_RUN) {
    sendJson(res, 200, {
      ok: true,
      mode: 'demo',
      dryRun: true,
      message: 'Envio de mídia simulado. Configure a Evolution API e EVOLUTION_DRY_RUN=false para enviar de verdade.',
      request: {
        method: 'POST',
        url: evolutionUrl || '{EVOLUTION_API_URL}/message/sendMedia/{EVOLUTION_INSTANCE}',
        headers: { apikey: configured ? '***configurado***' : '{EVOLUTION_API_KEY}' },
        body: payload,
      },
    });
    return;
  }

  let response;
  let data;
  try {
    response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        apikey: EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    data = await readJsonSafe(response);
  } catch (error) {
    releaseOutbound(idempotencyKey);
    throw error;
  }
  if (!response.ok) releaseOutbound(idempotencyKey);

  sendJson(res, response.ok ? 200 : response.status, {
    ok: response.ok,
    mode: 'real',
    dryRun: false,
    request: { method: 'POST', url: evolutionUrl, body: payload },
    evolution: data,
  });
}

// Busca mensagens recentes na Evolution (leitura — não é afetada por EVOLUTION_DRY_RUN).
// Para demo/teste: crie server/simulate-inbound.json com [{id, remoteJid, pushName, text}]
// e as mensagens aparecem no CRM como se tivessem chegado pelo WhatsApp.
async function handleFindMessages(req, res) {
  const simulatePath = path.resolve(__dirname, 'simulate-inbound.json');
  if (fs.existsSync(simulatePath)) {
    try {
      const simulated = JSON.parse(fs.readFileSync(simulatePath, 'utf8'));
      if (Array.isArray(simulated) && simulated.length > 0) {
        const records = simulated
          .map((record, index) => ({
            id: record.id || `sim-${index}`,
            fromMe: false,
            remoteJid: record.remoteJid || '5511900000000@s.whatsapp.net',
            pushName: record.pushName || 'Lead Simulado',
            text: record.text || '',
            timestamp: Math.floor(Date.now() / 1000),
          }))
          .filter((record) => canClaimMessage(record.id));
        claimMessages(records.map((record) => record.id));
        sendJson(res, 200, { ok: true, mode: 'simulated', records });
        return;
      }
    } catch {
      // arquivo inválido — segue fluxo normal
    }
  }

  const configured = Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);

  if (!configured) {
    sendJson(res, 200, { ok: true, mode: 'demo', records: [] });
    return;
  }

  const body = await readRequestJson(req);
  const evolutionUrl = `${EVOLUTION_API_URL}/chat/findMessages/${encodeURIComponent(EVOLUTION_INSTANCE)}`;

  let response;
  try {
    response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        apikey: EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        where: body.where || {},
        page: 1,
        offset: Number(body.offset) || 50,
      }),
    });
  } catch (error) {
    sendJson(res, 200, { ok: true, mode: 'real', records: [], note: 'Evolution inacessível: ' + error.message });
    return;
  }

  const data = await readJsonSafe(response);
  if (!response.ok) {
    sendJson(res, 200, { ok: true, mode: 'real', records: [], note: `Evolution retornou ${response.status}` });
    return;
  }

  // v2 responde { messages: { records: [...] } }; versões antigas respondem array direto.
  const records = Array.isArray(data)
    ? data
    : data && data.messages && Array.isArray(data.messages.records)
      ? data.messages.records
      : [];

  const simplified = records
    .map((record) => {
      const key = record.key || {};
      const message = record.message || {};
      const text =
        typeof message.conversation === 'string'
          ? message.conversation
          : message.extendedTextMessage && typeof message.extendedTextMessage.text === 'string'
            ? message.extendedTextMessage.text
            : '';
      return {
        id: key.id || record.id || '',
        fromMe: Boolean(key.fromMe),
        remoteJid: preferredRemoteJid(key, record),
        pushName: record.pushName || '',
        text,
        timestamp: Number(record.messageTimestamp) || 0,
      };
    })
    .filter(
      (record) =>
        record.id &&
        record.remoteJid &&
        record.text &&
        !record.fromMe &&
        canClaimMessage(record.id) &&
        record.timestamp >= BRIDGE_STARTED_AT
    );

  claimMessages(simplified.map((record) => record.id));
  sendJson(res, 200, { ok: true, mode: 'real', records: simplified });
}

async function handleAckMessage(req, res) {
  const body = await readRequestJson(req);
  const ids = Array.isArray(body.ids) ? body.ids : [body.id];
  const validIds = ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim());
  if (validIds.length === 0) {
    sendJson(res, 400, { ok: false, error: 'Informe id ou ids' });
    return;
  }
  markConsumed(validIds);
  for (const id of validIds) claimedIds.delete(id);
  sendJson(res, 200, { ok: true });
}

async function handleAiGenerate(req, res) {
  const body = await readRequestJson(req);
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const lead = body.lead && typeof body.lead === 'object' ? body.lead : {};
  const fallback = typeof body.fallback === 'string' ? body.fallback : '';
  const detectSchedule = Boolean(body.detectSchedule);

  if (!instruction) {
    sendJson(res, 400, { ok: false, error: 'Informe instruction' });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(res, 200, {
      ok: true,
      mode: 'demo',
      text: fallback || `Oi ${lead.clientName || ''}! Passando para saber se posso te ajudar com o ${lead.vehicle || 'veículo'}. 😊`,
      note: 'OPENAI_API_KEY ausente — usando mensagem de fallback.',
    });
    return;
  }

  const history = Array.isArray(lead.messages)
    ? lead.messages
        .slice(-6)
        .map((m) => `${m.sender === 'lead' ? 'Cliente' : m.sender === 'ai' ? 'Atendente' : 'Vendedor'}: ${m.text}`)
        .join('\n')
    : '';

  const systemPrompt = [
    'Você é atendente virtual de uma loja de carros seminovos, conversando por WhatsApp em português do Brasil.',
    detectSchedule
      ? 'Responda SOMENTE com JSON válido, sem markdown, no formato: {"reply": "mensagem curta e natural (máximo 3 frases)", "scheduledAt": "data/hora ISO 8601 COM fuso -03:00 (ex: 2026-07-16T15:00:00-03:00) se o cliente CONFIRMOU dia e horário de visita, senão null"}. O horário dito pelo cliente é no fuso de Brasília (-03:00). Só preencha scheduledAt quando o cliente confirmar explicitamente um horário — sugerir horário não conta.'
      : 'Escreva UMA única mensagem curta (máximo 2 frases), natural e humana, sem assinatura, sem markdown.',
    'Nunca invente preço, condição ou dado que não esteja no contexto. Use a ficha do veículo quando o cliente pedir detalhes.',
  ].join(' ');

  const now = new Date();
  const calendar = Array.from({ length: 8 }, (_, i) => {
    const day = new Date(now.getTime() + i * 86_400_000);
    const label = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : day.toLocaleDateString('pt-BR', { weekday: 'long' });
    return `${label} = ${day.toISOString().slice(0, 10)}`;
  }).join('; ');
  const userPrompt = [
    `Instrução: ${instruction}`,
    `Data/hora atual: ${now.toISOString()} (${now.toLocaleDateString('pt-BR', { weekday: 'long' })})`,
    `Calendário para converter dias em datas: ${calendar}`,
    `Cliente: ${lead.clientName || 'desconhecido'}`,
    `Veículo de interesse: ${lead.vehicle || 'não informado'}`,
    lead.vehicleSheet ? `Ficha do veículo (dados oficiais da loja): ${lead.vehicleSheet}` : '',
    `Faixa de orçamento: ${lead.budgetRange || 'não informada'}`,
    lead.intent ? `Intenção detectada: ${lead.intent}` : '',
    history ? `Últimas mensagens:\n${history}` : '',
    'Escreva agora a resposta.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 160,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const data = await readJsonSafe(response);

  if (!response.ok) {
    const apiError =
      data && typeof data === 'object' && data.error && data.error.message
        ? data.error.message
        : `OpenAI retornou ${response.status}`;
    sendJson(res, 200, {
      ok: true,
      mode: 'fallback',
      text: fallback || `Oi ${lead.clientName || ''}! Posso te ajudar com mais alguma coisa sobre o ${lead.vehicle || 'veículo'}?`,
      note: `Falha na OpenAI (${apiError}) — usando fallback.`,
    });
    return;
  }

  const raw =
    data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || '').trim()
      : '';

  let text = raw;
  let scheduledAt = null;
  if (detectSchedule && raw) {
    try {
      const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.reply === 'string') {
        text = parsed.reply;
        if (typeof parsed.scheduledAt === 'string' && !Number.isNaN(Date.parse(parsed.scheduledAt))) {
          scheduledAt = parsed.scheduledAt;
        }
      }
    } catch {
      // modelo respondeu texto puro — usa como está
    }
  }

  sendJson(res, 200, {
    ok: true,
    mode: 'real',
    model: OPENAI_MODEL,
    text: text || fallback,
    scheduledAt,
  });
}

function handleDbGet(res) {
  if (!fs.existsSync(DB_PATH)) {
    sendJson(res, 200, { ok: true, empty: true, state: null });
    return;
  }
  try {
    const state = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    sendJson(res, 200, { ok: true, empty: false, state });
  } catch {
    sendJson(res, 200, { ok: true, empty: true, state: null });
  }
}

// Merge por lead: com o CRM aberto em mais de uma aba, cada uma salva o estado
// inteiro — sem merge, a aba "atrasada" apagaria mensagens processadas pela outra.
// Regra: para cada lead, vence a versão com mais mensagens.
async function handleDbPut(req, res) {
  const body = await readRequestJson(req);

  if (Array.isArray(body.leads)) {
    body.leads = body.leads.filter((lead) => {
      const deletedAt = Number(deletedLeads[lead.id] || 0);
      if (!deletedAt) return true;
      const createdAt = Date.parse(lead.createdAt || '');
      if (Number.isFinite(createdAt) && createdAt > deletedAt) {
        delete deletedLeads[lead.id];
        persistDeletedLeads();
        return true;
      }
      return false;
    });
  }

  let current = null;
  try {
    current = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    // sem estado anterior — grava direto
  }

  if (current && Array.isArray(current.leads) && Array.isArray(body.leads)) {
    const byId = new Map(current.leads.map((lead) => [lead.id, lead]));
    body.leads = body.leads.map((incoming) => {
      const existing = byId.get(incoming.id);
      if (
        existing &&
        Array.isArray(existing.messages) &&
        Array.isArray(incoming.messages) &&
        existing.messages.length > incoming.messages.length
      ) {
        return { ...incoming, messages: existing.messages, automation: existing.automation };
      }
      return incoming;
    });
    for (const lead of current.leads) {
      if (!body.leads.some((item) => item.id === lead.id)) body.leads.push(lead);
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(body, null, 2), 'utf8');
  sendJson(res, 200, { ok: true });
}

function handleLeadDelete(leadId, res) {
  if (!leadId) {
    sendJson(res, 400, { ok: false, error: 'Lead invalido' });
    return;
  }

  let state = null;
  try {
    state = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    sendJson(res, 404, { ok: false, error: 'Estado do CRM nao encontrado' });
    return;
  }

  const leads = Array.isArray(state.leads) ? state.leads : [];
  const nextLeads = leads.filter((lead) => lead.id !== leadId);
  deletedLeads[leadId] = Date.now();
  persistDeletedLeads();
  fs.writeFileSync(DB_PATH, JSON.stringify({ ...state, leads: nextLeads }, null, 2), 'utf8');
  sendJson(res, 200, { ok: true, deleted: nextLeads.length !== leads.length, leadId });
}

function persistDeletedLeads() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  deletedLeads = Object.fromEntries(
    Object.entries(deletedLeads).filter(([, deletedAt]) => Number(deletedAt) >= cutoff)
  );
  fs.writeFileSync(DELETED_LEADS_PATH, JSON.stringify(deletedLeads), 'utf8');
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload muito grande'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isAuthorized(req) {
  if (!APP_USERNAME || !APP_PASSWORD) return true;
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    return decoded === `${APP_USERNAME}:${APP_PASSWORD}`;
  } catch {
    return false;
  }
}

function serveStatic(req, res) {
  if (!fs.existsSync(DIST_PATH)) return false;

  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return false;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.resolve(DIST_PATH, relativePath);
  if (!filePath.startsWith(DIST_PATH)) return false;

  try {
    if (!fs.statSync(filePath).isFile()) filePath = path.join(DIST_PATH, 'index.html');
  } catch {
    filePath = path.join(DIST_PATH, 'index.html');
  }
  if (!fs.existsSync(filePath)) return false;

  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  res.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function normalizePhone(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
}

function normalizeIdempotencyKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 200);
}

function canClaimMessage(id) {
  if (!id || consumedIds.has(id)) return false;
  const leaseUntil = claimedIds.get(id) || 0;
  return leaseUntil <= Date.now();
}

function claimMessages(ids) {
  const leaseUntil = Date.now() + MESSAGE_LEASE_MS;
  for (const id of ids) {
    if (id) claimedIds.set(id, leaseUntil);
  }
}

function preferredRemoteJid(key, record) {
  const candidates = [
    key.remoteJidAlt,
    key.senderPn,
    record.remoteJidAlt,
    record.senderPn,
    key.remoteJid,
  ];
  return (
    candidates.find((jid) => typeof jid === 'string' && jid.endsWith('@s.whatsapp.net')) ||
    candidates.find((jid) => typeof jid === 'string' && jid) ||
    ''
  );
}

async function prepareMedia(media, requestedMimetype, requestedFileName) {
  const fallbackMimetype =
    typeof requestedMimetype === 'string' && requestedMimetype.trim()
      ? requestedMimetype.trim()
      : 'image/jpeg';
  const fallbackFileName =
    typeof requestedFileName === 'string' && requestedFileName.trim()
      ? requestedFileName.trim()
      : 'veiculo.jpg';

  if (!/^https?:\/\//i.test(media)) {
    return { media, mimetype: fallbackMimetype, fileName: fallbackFileName };
  }

  try {
    const response = await fetch(media, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Imagem retornou ${response.status}`);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 8_000_000) throw new Error('Imagem maior que 8 MB');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 8_000_000) throw new Error('Imagem maior que 8 MB');
    return {
      media: buffer.toString('base64'),
      mimetype: response.headers.get('content-type') || fallbackMimetype,
      fileName: fallbackFileName,
    };
  } catch {
    return { media, mimetype: fallbackMimetype, fileName: fallbackFileName };
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
