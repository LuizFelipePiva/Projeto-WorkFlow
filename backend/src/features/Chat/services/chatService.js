import { createMessageNotification } from "../../Notifications/services/notificationService.js";

export class ChatError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const positiveId = (value, label) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ChatError(`${label} inválido`);
  }
  return id;
};

const participants = (conversation) => [
  Number(conversation.id_user_contratante_conversa),
  Number(conversation.id_user_freelancer_conversa),
];

export function createChatService(db) {
  const findConversation = async (connection, conversationId, userId, lock = false) => {
    const [rows] = await connection.query(
      `SELECT id_conversa, id_user_contratante_conversa,
              id_user_freelancer_conversa, id_vaga_conversa
       FROM conversa
       WHERE id_conversa = ?
         AND ? IN (id_user_contratante_conversa, id_user_freelancer_conversa)
       LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
      [positiveId(conversationId, "Id da conversa"), userId]
    );
    if (!rows[0]) throw new ChatError("Conversa não encontrada", 404);
    return rows[0];
  };

  const transaction = async (operation) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

  return {
    async listConversations(user) {
      const [rows] = await db.query(
        `SELECT c.id_conversa, c.id_vaga_conversa, c.created_at,
                v.title AS job_title,
                CASE WHEN c.id_user_contratante_conversa = ? THEN uf.id ELSE uc.id END AS other_user_id,
                CASE WHEN c.id_user_contratante_conversa = ? THEN uf.name ELSE uc.name END AS other_user_name,
                CASE WHEN c.id_user_contratante_conversa = ? THEN uf.email ELSE uc.email END AS other_user_email,
                (SELECT m.conteudo FROM mensagem m
                 WHERE m.id_conversa_mensagem = c.id_conversa
                 ORDER BY m.id_mensagem DESC LIMIT 1) AS last_message,
                (SELECT m.created_at FROM mensagem m
                 WHERE m.id_conversa_mensagem = c.id_conversa
                 ORDER BY m.id_mensagem DESC LIMIT 1) AS last_message_created_at,
                (SELECT m.id_mensagem FROM mensagem m
                 WHERE m.id_conversa_mensagem = c.id_conversa
                 ORDER BY m.id_mensagem DESC LIMIT 1) AS last_message_id
         FROM conversa c
         INNER JOIN users uc ON uc.id = c.id_user_contratante_conversa
         INNER JOIN users uf ON uf.id = c.id_user_freelancer_conversa
         LEFT JOIN vagas v ON v.id_vagas = c.id_vaga_conversa
         WHERE ? IN (c.id_user_contratante_conversa, c.id_user_freelancer_conversa)
         ORDER BY COALESCE(last_message_created_at, c.created_at) DESC, c.id_conversa DESC`,
        [user.id, user.id, user.id, user.id]
      );
      return rows;
    },

    async listMessages(user, { id_conversa }) {
      await findConversation(db, id_conversa, user.id);
      const [messages] = await db.query(
        `SELECT m.id_mensagem, m.id_conversa_mensagem, m.id_sender,
                m.conteudo, m.created_at, u.name AS sender_name
         FROM mensagem m
         INNER JOIN users u ON u.id = m.id_sender
         WHERE m.id_conversa_mensagem = ? ORDER BY m.id_mensagem ASC`,
        [id_conversa]
      );
      return messages;
    },

    async createConversation(user, { id_vaga_conversa, id_user_freelancer_conversa }) {
      const jobId = positiveId(id_vaga_conversa, "Id da vaga");
      const freelancerId = Number(user.user_type) === 0
        ? Number(user.id)
        : positiveId(id_user_freelancer_conversa, "Id do freelancer");

      return transaction(async (connection) => {
        // Serializa a criação para a mesma vaga, inclusive em conexões diferentes.
        const [jobs] = await connection.query(
          "SELECT id_user FROM vagas WHERE id_vagas = ? FOR UPDATE", [jobId]
        );
        if (!jobs[0]) throw new ChatError("Vaga não encontrada", 404);
        const contractorId = Number(jobs[0].id_user);
        if (Number(user.user_type) !== 0 && Number(user.id) !== contractorId) {
          throw new ChatError("Acesso negado", 403);
        }
        const [candidates] = await connection.query(
          `SELECT u.id FROM users u
           INNER JOIN vagas_aplicadas va ON va.id_user_vagas_aplicadas = u.id
           WHERE u.id = ? AND u.user_type = 0 AND va.id_vagas = ? LIMIT 1`,
          [freelancerId, jobId]
        );
        if (!candidates[0] || contractorId === freelancerId) {
          throw new ChatError("Freelancer não se candidatou a esta vaga", 403);
        }
        const [existing] = await connection.query(
          `SELECT id_conversa FROM conversa
           WHERE id_user_contratante_conversa = ? AND id_user_freelancer_conversa = ?
             AND id_vaga_conversa = ? ORDER BY id_conversa ASC LIMIT 1 FOR UPDATE`,
          [contractorId, freelancerId, jobId]
        );
        if (existing[0]) {
          return { id_conversa: existing[0].id_conversa, reused: true, participants: [contractorId, freelancerId] };
        }
        const [result] = await connection.query(
          `INSERT INTO conversa
           (id_user_contratante_conversa, id_user_freelancer_conversa, id_vaga_conversa, created_at)
           VALUES (?, ?, ?, NOW())`,
          [contractorId, freelancerId, jobId]
        );
        return { id_conversa: result.insertId, reused: false, participants: [contractorId, freelancerId] };
      });
    },

    async sendMessage(user, { id_conversa, conteudo }) {
      if (typeof conteudo !== "string" || !conteudo.trim()) {
        throw new ChatError("Mensagem vazia");
      }
      const content = conteudo.trim();
      if (content.length > 4000) throw new ChatError("A mensagem deve ter até 4000 caracteres");
      return transaction(async (connection) => {
        const conversation = await findConversation(connection, id_conversa, user.id, true);
        const [result] = await connection.query(
          `INSERT INTO mensagem (id_conversa_mensagem, id_sender, conteudo, created_at)
           VALUES (?, ?, ?, NOW())`,
          [conversation.id_conversa, user.id, content]
        );
        const [messages] = await connection.query(
          `SELECT m.id_mensagem, m.id_conversa_mensagem, m.id_sender,
                  m.conteudo, m.created_at, u.name AS sender_name
           FROM mensagem m INNER JOIN users u ON u.id = m.id_sender
           WHERE m.id_mensagem = ?`, [result.insertId]
        );
        const notification = await createMessageNotification(connection, messages[0], conversation);
        return { message: messages[0], notification, participants: participants(conversation) };
      });
    },

    async deleteConversation(user, { id_conversa }) {
      return transaction(async (connection) => {
        const conversation = await findConversation(connection, id_conversa, user.id, true);
        await connection.query("DELETE FROM mensagem WHERE id_conversa_mensagem = ?", [id_conversa]);
        await connection.query("DELETE FROM conversa WHERE id_conversa = ?", [id_conversa]);
        return { id_conversa: conversation.id_conversa, participants: participants(conversation) };
      });
    },
  };
}
