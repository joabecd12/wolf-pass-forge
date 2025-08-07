-- Limpar emails com template antigo da fila
DELETE FROM email_queue WHERE status = 'sent' AND html_content LIKE '%background: white; padding: 30px; text-align: center%';