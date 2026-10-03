export class NotificationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const mapNotification = (row) => ({ ...row, lida: Number(row.lida) === 1 });

// Usa a mesma conexão/transação que salvou a mensagem.
export async function createMessageNotification(connection, message, conversation) {
  const recipientId = Number(conversation.id_user_contratante_conversa) === Number(message.id_sender)
    ? Number(conversation.id_user_freelancer_conversa)
    : Number(conversation.id_user_contratante_conversa);
  const title = `Nova mensagem de ${message.sender_name}`.slice(0, 255);
  const [result] = await connection.query(
    `INSERT INTO notificacoes (id_usuario, tipo, referencia_id, id_conversa, titulo, link)
     VALUES (?, 'mensagem', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [recipientId, message.id_mensagem, conversation.id_conversa, title,
      `/chat?conversation=${conversation.id_conversa}`]
  );
  const [rows] = await connection.query("SELECT * FROM notificacoes WHERE id = ?", [result.insertId]);
  return mapNotification(rows[0]);
}

export function createNotificationService(db) {
  return {
    async list(user) {
      const [rows] = await db.query(
        `SELECT id, id_usuario, tipo, referencia_id, id_conversa, titulo, link, lida, criada_em
         FROM notificacoes WHERE id_usuario = ? ORDER BY id DESC`,
        [user.id]
      );
      const notifications = rows.map(mapNotification);
      // Lista e contagem vêm da mesma consulta para permanecerem consistentes.
      return { notifications, totalNaoLidas: notifications.filter((item) => !item.lida).length };
    },

    async markAsRead(user, { id }) {
      const notificationId = Number(id);
      if (!["number", "string"].includes(typeof id) || !Number.isSafeInteger(notificationId) || notificationId <= 0) {
        throw new NotificationError("Id da notificação inválido");
      }
      await db.query("UPDATE notificacoes SET lida = TRUE WHERE id = ? AND id_usuario = ?", [notificationId, user.id]);
      const [rows] = await db.query("SELECT * FROM notificacoes WHERE id = ? AND id_usuario = ?", [notificationId, user.id]);
      if (!rows[0]) throw new NotificationError("Notificação não encontrada", 404);
      return mapNotification(rows[0]);
    },

    async markAllAsRead(user) {
      await db.query("UPDATE notificacoes SET lida = TRUE WHERE id_usuario = ? AND lida = FALSE", [user.id]);
      return { all: true };
    },
  };
}
