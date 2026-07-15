# AutoCRM IA

CRM demonstrativo para lojas de seminovos, com pipeline Kanban, atendimento automático por WhatsApp, follow-ups, envio de fotos, agendamento e gestão de estoque.

## Recursos

- Entrada de leads recebidos pela Evolution API.
- Saudação automática e qualificação com IA.
- Identificação de veículos populares no estoque.
- Envio automático de foto e ficha do veículo.
- Follow-ups com intervalos configurados e proteção contra duplicidade.
- Agendamento de visita e transferência para atendimento humano.
- Painel administrativo para QR Code, instância e estoque.
- Exclusão persistente de lead para reiniciar testes.
- Worker opcional no servidor para atender mesmo com o painel fechado.

## Desenvolvimento local

```bash
npm install
cp .env.example .env
npm run api
```

Em outro terminal:

```bash
npm run dev
```

## Build local de produção

```bash
npm run build
npm start
```

A aplicação completa fica disponível na porta definida por `API_PORT`.

## Deploy com Docker

1. Copie `.env.example` para `.env` e configure Evolution, OpenAI e credenciais do painel.
2. Execute `docker compose up -d --build`.
3. A porta pública padrão é `3100` e pode ser alterada por `APP_PORT`.
4. Consulte a saúde em `/api/health`.

Os dados operacionais ficam no volume `autocrm_data`. O arquivo `.env` e os dados de leads não são versionados.

## Deploy com systemd e Caddy

Os arquivos em `deploy/` incluem uma unidade systemd isolada e um bloco Caddy. A aplicação usa o usuário `autocrm`, lê segredos de `/etc/autocrm/autocrm.env`, grava somente em `/var/lib/autocrm` e escuta em `127.0.0.1:3100`.

## Observação da demonstração

Em produção, configure `SERVER_WORKER_ENABLED=true` para processar mensagens no servidor. O painel sincroniza o estado automaticamente e não precisa permanecer aberto para a IA responder.
