
# Corrigir contagem de presenças - Problema do limite de 1.000 linhas

## Problema identificado
O Supabase retorna no maximo 1.000 linhas por query por padrao. O sistema tem **1.535 participantes** com presencas registradas, mas os paineis so mostram dados parciais porque as queries nao buscam todos os registros.

## O que sera corrigido

### 1. PresenceByDayPanel (Presencas por Dia)
- A query atual busca participantes com `presencas IS NOT NULL` mas recebe apenas 1.000 dos 1.535
- Implementar paginacao usando `.range()` para buscar TODOS os participantes em lotes de 1.000

### 2. PresenceSyncPanel (Sincronizar Presencas)
- A query de validacoes tambem pode ser afetada pelo limite
- Implementar a mesma logica de paginacao para garantir que todos os registros sejam processados

## Detalhes tecnicos

### Abordagem: Paginacao com `.range()`
Criar uma funcao auxiliar que busca todos os registros em lotes:

```text
Lote 1: .range(0, 999)    -> 1000 registros
Lote 2: .range(1000, 1999) -> 535 registros
Total: 1535 registros
```

### Arquivos a modificar
1. **src/components/reports/PresenceByDayPanel.tsx** - Substituir a query simples por busca paginada na funcao `loadPresenceData()`
2. **src/components/reports/PresenceSyncPanel.tsx** - Substituir as queries nas funcoes `analyzeData()` e `syncPresences()` por buscas paginadas

### Resultado esperado
- "Presencas Unicas" mostrara o numero correto (~1.535 ou mais)
- "Sincronizar Presencas" mostrara contagens corretas
- O sistema funcionara corretamente mesmo com milhares de participantes
