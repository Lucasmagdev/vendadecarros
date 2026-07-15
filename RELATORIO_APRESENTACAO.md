# Relatório de apresentação - AutoCRM IA

## Resumo

O AutoCRM IA demonstra como uma loja de seminovos pode receber, qualificar e acompanhar leads do WhatsApp em um único painel. A proposta é reduzir o tempo gasto em perguntas repetitivas e entregar ao vendedor apenas os contatos que precisam de negociação humana.

## Ambiente publicado

- URL: `https://autocrm.129-212-189-135.sslip.io`
- Repositório: `https://github.com/Lucasmagdev/vendadecarros`
- Branch: `main`
- Serviço: `autocrm.service`
- Domínio servido por Caddy com HTTPS.
- Aplicação isolada em `127.0.0.1:3100` na VPS.

## Fluxo para apresentar

1. Abra o Pipeline e mostre as etapas: Pré-atendimento, Follow-up, Agendado, Humano e Vendido.
2. Envie `Oi` de outro celular para o WhatsApp conectado.
3. Mostre a criação automática do lead e a saudação inicial.
4. Envie `Quero um Onix`.
5. Mostre a resposta com ficha, preço, quilometragem e foto do veículo.
6. Explique que follow-ups têm intervalos reais e proteção contra mensagens duplicadas.
7. Mostre o histórico completo e a possibilidade de o vendedor assumir a conversa.
8. Abra o Admin para mostrar conexão da Evolution, QR Code e estoque.

## O que já funciona

- Recebimento de mensagens reais pela Evolution API.
- Resposta automática com IA ou fallback local.
- Veículos populares brasileiros vinculados ao estoque.
- Foto enviada quando o modelo é identificado ou solicitada.
- Proteção de idempotência para impedir disparos duplicados.
- Follow-up em 30 minutos, 2 horas, 24 horas e 72 horas.
- Persistência de leads, mensagens e regras.
- Exclusão de lead sem apagar a conversa do WhatsApp.
- Build de produção, Docker, health check e proteção do painel por senha.

## Pontos importantes para a demonstração

- Use um número de teste e mantenha o painel aberto.
- A IA espera 10 segundos de silêncio após a última mensagem. Na prática, a resposta pode aparecer entre 10 e 14 segundos.
- Mensagens enviadas em sequência são agrupadas e recebem uma única resposta contextual.
- Para repetir o primeiro atendimento, exclua o lead no modal e envie uma nova mensagem.
- Evite demonstrar com dados pessoais de clientes reais.

## Próximas evoluções

- Executar automações em worker no servidor, sem depender do painel aberto.
- Banco PostgreSQL e autenticação com usuários e permissões.
- Importação automática de estoque por planilha, site ou DMS.
- Agenda real por vendedor e relatórios de conversão.
- Webhooks da Evolution no lugar da consulta periódica.

## Frase de fechamento

"A IA atende rápido, organiza o contexto e mantém o lead aquecido; o vendedor entra no momento em que a negociação realmente precisa de uma pessoa."
