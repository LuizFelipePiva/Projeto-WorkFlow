import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { ChatError, createChatService } from "../services/chatService.js";
import { NotificationError, createNotificationService } from "../../Notifications/services/notificationService.js";

const userRoom = (id) => `chat:user:${id}`;

export function createChatServer(httpServer, { db, jwtSecret, allowedOrigins }) {
  if (!jwtSecret) throw new Error("JWT_SECRET não configurado");

  const io = new Server(httpServer, {
    transports: ["websocket"],
    maxHttpBufferSize: 64 * 1024,
    cors: { origin: allowedOrigins },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  });
  const chat = createChatService(db);
  const notifications = createNotificationService(db);

  io.use((socket, next) => {
    try {
      const user = jwt.verify(socket.handshake.auth?.token, jwtSecret);
      if (!Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0 || ![0, 1].includes(Number(user.user_type))) {
        throw new Error("Usuário inválido");
      }
      socket.data.user = user;
      next();
    } catch {
      const error = new Error("Sessão inválida ou expirada. Entre novamente.");
      error.data = { code: "AUTH_ERROR" };
      next(error);
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(userRoom(user.id));

    const expireSession = () => {
      socket.emit("chat:session:expired");
      socket.disconnect(true);
    };
    const expirationTimer = user.exp
      ? setTimeout(expireSession, Math.max(0, user.exp * 1000 - Date.now()))
      : null;
    expirationTimer?.unref();
    socket.on("disconnect", () => clearTimeout(expirationTimer));

    const handle = (event, operation) => {
      socket.on(event, async (payload, acknowledge) => {
        // Não executa operações sem uma confirmação que o cliente possa acompanhar.
        if (typeof acknowledge !== "function") return;
        try {
          if (user.exp && user.exp * 1000 <= Date.now()) {
            acknowledge({ ok: false, error: { status: 401, message: "Sessão expirada" } });
            expireSession();
            return;
          }
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw new ChatError("Dados inválidos");
          }
          const data = await operation(payload);
          acknowledge({ ok: true, data });
        } catch (error) {
          const expectedError = error instanceof ChatError || error instanceof NotificationError;
          if (!expectedError) console.error(`Erro em ${event}:`, error);
          acknowledge({
            ok: false,
            error: {
              status: expectedError ? error.status : 500,
              message: expectedError ? error.message : "Não foi possível concluir a operação",
            },
          });
        }
      });
    };

    handle("notifications:list", () => notifications.list(user));
    handle("notifications:read", async (payload) => {
      const notification = await notifications.markAsRead(user, payload);
      io.to(userRoom(user.id)).emit("notification:read", { id: notification.id });
      return notification;
    });
    handle("notifications:read-all", async () => {
      const result = await notifications.markAllAsRead(user);
      io.to(userRoom(user.id)).emit("notification:read", result);
      return result;
    });

    handle("chat:conversations:list", () => chat.listConversations(user));
    handle("chat:messages:list", (payload) => chat.listMessages(user, payload));
    handle("chat:conversations:create", async (payload) => {
      const { participants, ...conversation } = await chat.createConversation(user, payload);
      io.to(participants.map(userRoom)).emit("chat:conversations:changed");
      return conversation;
    });
    handle("chat:messages:send", async (payload) => {
      const { participants, message, notification } = await chat.sendMessage(user, payload);
      io.to(participants.map(userRoom)).emit("chat:message:created", message);
      io.to(userRoom(notification.id_usuario)).emit("notification:created", notification);
      return message;
    });
    handle("chat:conversations:delete", async (payload) => {
      const { participants, id_conversa } = await chat.deleteConversation(user, payload);
      io.to(participants.map(userRoom)).emit("chat:conversation:deleted", { id_conversa });
      io.to(participants.map(userRoom)).emit("notifications:changed");
      return { id_conversa };
    });
  });

  return io;
}
