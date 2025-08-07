-- Limpar emails antigos da fila para permitir novos testes com template correto
DELETE FROM email_queue WHERE status IN ('sent', 'failed');