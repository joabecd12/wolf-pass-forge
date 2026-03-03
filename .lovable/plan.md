

# Corrigir contagem de emails na Fila de Emails

## Problema
O `fetchQueueItems` (linha 108) busca da tabela `email_queue` sem paginacao, recebendo apenas 1.000 dos registros existentes. As estatisticas (Enviados, Pendentes, etc.) sao calculadas a partir desse array truncado em `getQueueStats()` (linha 501).

## Solucao

### Abordagem hibrida
1. **Estatisticas (contagens)**: Usar queries com `count: 'exact', head: true` e filtro por status para obter contagens exatas sem precisar buscar todas as linhas. Isso e mais eficiente que buscar tudo.

2. **Listagem/tabela**: Manter a busca paginada do lado do servidor (ja existe paginacao no frontend), mas aplicar `.range()` baseado na pagina atual ao inves de buscar tudo.

### Arquivo a modificar
**src/components/email/EmailQueueManager.tsx**

1. Criar funcao `fetchQueueStats()` que faz 4 queries com `count: 'exact', head: true` filtradas por status (`pending`, `sending`, `sent`, `failed`) — retorna contagens corretas sem limite de 1000
2. Separar o estado de stats do estado de items da tabela
3. Alterar `fetchQueueItems()` para usar `fetchAllRows` do `supabaseUtils.ts` para buscar todos os registros (necessario para a tabela com filtros locais de busca e data)
4. Atualizar `participantsStats.withoutEmails` para tambem considerar todos os emails da fila

### Resultado esperado
- "Enviados" mostrara o numero correto (mais de 1000)
- Todas as outras contagens serao precisas
- A tabela mostrara todos os registros com paginacao

