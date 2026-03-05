

# Alterar "Total Participantes" para 2690 (número fixo)

## O que será feito

No arquivo `src/components/reports/PresenceByDayPanel.tsx`, substituir a query que busca a contagem de participantes do banco de dados por um valor fixo de **2690**, representando o total real de pessoas que estiveram no evento (incluindo quem entrou sem escanear QR code).

### Alteração

Na função `loadPresenceData()`, remover a query:
```
const { count } = await supabase.from('participants').select('*', { count: 'exact', head: true });
setTotalParticipants(count || 0);
```

E substituir por:
```
setTotalParticipants(2690);
```

### Arquivo
- `src/components/reports/PresenceByDayPanel.tsx` — uma única alteração na função `loadPresenceData()`

