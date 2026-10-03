-- Somente para bancos antigos que ainda não usam AUTO_INCREMENT nestas chaves.
-- Os registros e IDs existentes são preservados. Não é necessário recriar tabelas.
ALTER TABLE conversa MODIFY COLUMN id_conversa INT NOT NULL AUTO_INCREMENT;
ALTER TABLE mensagem MODIFY COLUMN id_mensagem INT NOT NULL AUTO_INCREMENT;
