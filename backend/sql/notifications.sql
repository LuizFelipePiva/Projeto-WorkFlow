CREATE TABLE IF NOT EXISTS notificacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  referencia_id INT NULL,
  id_conversa INT NULL,
  titulo VARCHAR(255) NOT NULL,
  link VARCHAR(255) NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notificacoes_usuario FOREIGN KEY (id_usuario)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notificacoes_conversa FOREIGN KEY (id_conversa)
    REFERENCES conversa(id_conversa) ON DELETE CASCADE,
  INDEX idx_notificacoes_usuario_lida (id_usuario, lida),
  UNIQUE KEY uq_notificacao (id_usuario, tipo, referencia_id)
) ENGINE=InnoDB;
