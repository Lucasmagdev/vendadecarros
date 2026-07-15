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
3. Consulte a saúde em `/api/health`.

Os dados operacionais ficam no volume `autocrm_data`. O arquivo `.env` e os dados de leads não são versionados.

## Observação da demonstração

O processamento automático atual é iniciado pela interface do CRM. Durante a apresentação, mantenha o painel aberto em uma aba. A migração desse motor para um worker independente é o próximo passo para operação contínua sem navegador.
