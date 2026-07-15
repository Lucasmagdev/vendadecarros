# Integração Evolution API

Este mock já tem uma ponte local para enviar mensagens pelo endpoint da Evolution API:

```text
POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}
```

A chave é enviada no header `apikey`, seguindo a autenticação da Evolution API.

## Rodar em modo demo

```bash
npm run api
npm run dev
```

Com `EVOLUTION_DRY_RUN=true`, o botão no modal do lead simula o envio e mostra o payload.

## Rodar com envio real

Crie um `.env` a partir do `.env.example`:

```bash
copy .env.example .env
```

Preencha:

```text
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-chave-ou-token-da-instancia
EVOLUTION_INSTANCE=nome-da-instancia
EVOLUTION_DRY_RUN=false
```

Depois rode:

```bash
npm run api
npm run dev
```

No modal do lead, clique em **Enviar próxima mensagem pelo WhatsApp**.

## Endpoints locais

```text
GET  /api/evolution/status
POST /api/evolution/send-text
```

Payload local:

```json
{
  "number": "5511999999999",
  "text": "Mensagem para enviar"
}
```
