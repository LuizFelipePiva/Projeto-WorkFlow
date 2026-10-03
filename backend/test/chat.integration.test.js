import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import { io as createClient } from "socket.io-client";
import { createChatServer } from "../src/features/Chat/socket/chatSocket.js";

dotenv.config({ quiet: true });

const nextEvent = (socket, event) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timeout: ${event}`)); }, 4000);
  const listener = (...args) => { clearTimeout(timeout); resolve(args[0]); };
  socket.once(event, listener);
});

test("chat WebSocket com MySQL isolado", { timeout: 30000 }, async (t) => {
  // O banco da aplicação nunca é usado: todos os dados abaixo são descartáveis.
  const database = `chat_ws_test_${randomUUID().replaceAll("-", "")}`;
  const connectionOptions = { host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  const admin = await mysql.createConnection(connectionOptions);
  let db;
  let server;
  let io;
  let createdDatabase = false;
  const clients = [];
  const jwtSecret = randomUUID();
  const sign = (id, user_type, expiresIn = "1h") => jwt.sign({ id, user_type }, jwtSecret, { expiresIn });

  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    createdDatabase = true;
    db = mysql.createPool({ ...connectionOptions, database, connectionLimit: 10 });
    const statements = [
      "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), user_type TINYINT)",
      "CREATE TABLE vagas (id_vagas INT PRIMARY KEY, id_user INT, title VARCHAR(100))",
      "CREATE TABLE vagas_aplicadas (idvagas_aplicadas INT PRIMARY KEY, id_user_vagas_aplicadas INT, id_vagas INT)",
      `CREATE TABLE conversa (id_conversa INT AUTO_INCREMENT PRIMARY KEY,
        id_user_contratante_conversa INT, id_user_freelancer_conversa INT, id_vaga_conversa INT, created_at DATETIME)`,
      `CREATE TABLE mensagem (id_mensagem INT AUTO_INCREMENT PRIMARY KEY,
        id_conversa_mensagem INT, id_sender INT, conteudo TEXT, created_at DATETIME,
        FOREIGN KEY (id_conversa_mensagem) REFERENCES conversa(id_conversa) ON DELETE CASCADE)`,
      "INSERT INTO users VALUES (1, 'Contratante teste', 'contratante@test.invalid', 1), (2, 'Freelancer teste', 'freelancer@test.invalid', 0), (3, 'Terceiro teste', 'terceiro@test.invalid', 0), (4, 'Outro contratante', 'outro@test.invalid', 1)",
      "INSERT INTO vagas VALUES (1, 1, 'Vaga de teste')",
      "INSERT INTO vagas_aplicadas VALUES (1, 2, 1)",
    ];
    for (const sql of statements) await db.query(sql);
    await db.query(await readFile(new URL("../sql/notifications.sql", import.meta.url), "utf8"));
    server = createServer();
    io = createChatServer(server, { db, jwtSecret, allowedOrigins: ["http://localhost:3001"] });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const makeClient = (token, options = {}) => {
      const socket = createClient(url, { autoConnect: false, transports: ["websocket"],
        auth: { token }, reconnection: false, forceNew: true, ...options });
      clients.push(socket);
      return socket;
    };
    const connect = async (token) => {
      const socket = makeClient(token);
      const connected = nextEvent(socket, "connect");
      socket.connect();
      await connected;
      assert.equal(socket.io.engine.transport.name, "websocket");
      return socket;
    };
    const request = (socket, event, payload = {}) => socket.timeout(4000).emitWithAck(event, payload);

    await t.test("recusa token ausente, inválido, expirado e origem não permitida", async () => {
      for (const token of [undefined, "invalid", sign(1, 1, -1)]) {
        const socket = makeClient(token);
        const denied = nextEvent(socket, "connect_error");
        socket.connect();
        assert.equal((await denied).data.code, "AUTH_ERROR");
        socket.disconnect();
      }
      const socket = makeClient(sign(1, 1), { extraHeaders: { Origin: "https://not-allowed.invalid" } });
      const denied = nextEvent(socket, "connect_error");
      socket.connect();
      await denied;
      assert.equal(socket.connected, false);
      socket.disconnect();
    });

    const contractor = await connect(sign(1, 1));
    const freelancer = await connect(sign(2, 0));
    const secondTab = await connect(sign(1, 1));
    const outsider = await connect(sign(3, 0));
    const otherContractor = await connect(sign(4, 1));
    const leakedEvents = [];
    for (const event of ["chat:conversations:changed", "chat:message:created", "chat:conversation:deleted",
      "notification:created", "notification:read", "notifications:changed"]) {
      outsider.on(event, (data) => leakedEvents.push({ event, data }));
    }
    let conversationId;
    let firstNotification;

    await t.test("cria/reutiliza a conversa sem duplicar em solicitações simultâneas", async () => {
      const contractorUpdate = nextEvent(contractor, "chat:conversations:changed");
      const freelancerUpdate = nextEvent(freelancer, "chat:conversations:changed");
      const payload = { id_vaga_conversa: 1, id_user_freelancer_conversa: 2 };
      const results = await Promise.all(Array.from({ length: 6 }, () => request(contractor, "chat:conversations:create", payload)));
      results.forEach((result) => assert.equal(result.ok, true));
      conversationId = results[0].data.id_conversa;
      assert.equal(new Set(results.map((result) => result.data.id_conversa)).size, 1);
      assert.equal(results.filter((result) => !result.data.reused).length, 1);
      await Promise.all([contractorUpdate, freelancerUpdate]);
      const list = await request(freelancer, "chat:conversations:list");
      assert.equal(list.data[0].other_user_id, 1);
      assert.equal(list.data[0].job_title, "Vaga de teste");
      assert.deepEqual((await request(outsider, "chat:conversations:list")).data, []);
      assert.equal((await request(otherContractor, "chat:conversations:create", payload)).error.status, 403);
      assert.equal((await request(outsider, "chat:conversations:create", payload)).error.status, 403);
    });

    await t.test("bloqueia leitura, envio e exclusão por um terceiro", async () => {
      for (const event of ["chat:messages:list", "chat:messages:send", "chat:conversations:delete"]) {
        const result = await request(outsider, event, { id_conversa: conversationId, conteudo: "invasão" });
        assert.equal(result.ok, false);
        assert.equal(result.error.status, 404);
      }
      assert.equal((await request(contractor, "chat:messages:list", { id_conversa: -1 })).error.status, 400);
      assert.equal((await request(contractor, "chat:messages:list", null)).error.status, 400);
    });

    await t.test("persiste antes de confirmar e entrega uma vez às duas contas e à segunda aba", async () => {
      const received = [contractor, freelancer, secondTab].map((socket) => nextEvent(socket, "chat:message:created"));
      const notified = [contractor, secondTab].map((socket) => nextEvent(socket, "notification:created"));
      const senderNotifications = [];
      const onSenderNotification = (notification) => senderNotifications.push(notification);
      freelancer.on("notification:created", onSenderNotification);
      const result = await request(freelancer, "chat:messages:send", {
        id_conversa: conversationId, conteudo: "  Olá em tempo real  ", id_sender: 1,
      });
      assert.equal(result.ok, true);
      assert.equal(result.data.id_sender, 2);
      assert.equal(result.data.conteudo, "Olá em tempo real");
      for (const message of await Promise.all(received)) assert.deepEqual(message, result.data);
      const notifications = await Promise.all(notified);
      firstNotification = notifications[0];
      assert.deepEqual(notifications[1], firstNotification);
      assert.equal(firstNotification.referencia_id, result.data.id_mensagem);
      assert.equal(firstNotification.id_usuario, 1);
      assert.equal(firstNotification.lida, false);
      assert.equal(firstNotification.link, `/chat?conversation=${conversationId}`);
      const list = await request(contractor, "notifications:list", { id_usuario: 3 });
      assert.equal(list.data.totalNaoLidas, 1);
      assert.deepEqual(list.data.notifications, [firstNotification]);
      assert.deepEqual((await request(freelancer, "notifications:list")).data, { notifications: [], totalNaoLidas: 0 });
      assert.deepEqual(senderNotifications, []);
      freelancer.off("notification:created", onSenderNotification);
      const [rows] = await db.query("SELECT conteudo FROM mensagem WHERE id_mensagem = ?", [result.data.id_mensagem]);
      assert.equal(rows[0].conteudo, result.data.conteudo);
      assert.equal((await request(contractor, "chat:conversations:list")).data[0].last_message, result.data.conteudo);
      for (const conteudo of ["  ", {}, "x".repeat(4001)]) {
        assert.equal((await request(freelancer, "chat:messages:send", { id_conversa: conversationId, conteudo })).error.status, 400);
      }
    });

    await t.test("leitura fica salva, sincroniza abas e impede acesso a notificações alheias", async () => {
      const denied = await request(outsider, "notifications:read", { id: firstNotification.id, id_usuario: 1 });
      assert.equal(denied.error.status, 404);
      for (const id of [-1, null, {}, "inválido"]) {
        assert.equal((await request(contractor, "notifications:read", { id })).error.status, 400);
      }
      assert.equal((await request(contractor, "notifications:list")).data.totalNaoLidas, 1);
      const updated = [contractor, secondTab].map((socket) => nextEvent(socket, "notification:read"));
      const read = await request(contractor, "notifications:read", { id: firstNotification.id });
      assert.equal(read.data.lida, true);
      for (const event of await Promise.all(updated)) assert.deepEqual(event, { id: firstNotification.id });
      const [[saved]] = await db.query("SELECT lida FROM notificacoes WHERE id = ?", [firstNotification.id]);
      assert.equal(saved.lida, 1);
      assert.equal((await request(secondTab, "notifications:list")).data.totalNaoLidas, 0);
      assert.equal((await request(contractor, "notifications:read", { id: firstNotification.id })).data.lida, true);
      const reloadedPage = await connect(sign(1, 1));
      const restored = (await request(reloadedPage, "notifications:list")).data;
      assert.equal(restored.totalNaoLidas, 0);
      assert.equal(restored.notifications[0].lida, true);
      reloadedPage.disconnect();
    });

    await t.test("envios simultâneos têm IDs exclusivos e histórico ordenado", async () => {
      const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
        request(index % 2 ? contractor : freelancer, "chat:messages:send", {
          id_conversa: conversationId, conteudo: `Mensagem ${index}`,
        })
      ));
      results.forEach((result) => assert.equal(result.ok, true));
      assert.equal(new Set(results.map((result) => result.data.id_mensagem)).size, 20);
      const history = (await request(contractor, "chat:messages:list", { id_conversa: conversationId })).data;
      assert.equal(history.length, 21);
      const ids = history.map((message) => message.id_mensagem);
      assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
      const [notifications] = await db.query("SELECT referencia_id FROM notificacoes");
      assert.equal(notifications.length, history.length);
      assert.deepEqual(notifications.map((item) => item.referencia_id).sort((a, b) => a - b), ids);
      assert.equal((await request(contractor, "notifications:list")).data.totalNaoLidas, 10);
      assert.equal((await request(freelancer, "notifications:list")).data.totalNaoLidas, 10);
    });

    await t.test("histórico recupera mensagens recebidas enquanto desconectado", async () => {
      freelancer.disconnect();
      const result = await request(contractor, "chat:messages:send", { id_conversa: conversationId, conteudo: "Durante a queda" });
      const connected = nextEvent(freelancer, "connect");
      freelancer.connect();
      await connected;
      const history = await request(freelancer, "chat:messages:list", { id_conversa: conversationId });
      assert.equal(history.data.at(-1).id_mensagem, result.data.id_mensagem);
      const restored = (await request(freelancer, "notifications:list")).data;
      assert.equal(restored.notifications[0].referencia_id, result.data.id_mensagem);
      assert.equal(restored.notifications[0].lida, false);
      assert.equal(restored.totalNaoLidas, 11);
    });

    await t.test("marcar todas afeta somente o usuário autenticado e persiste após recarregar", async () => {
      const updated = [contractor, secondTab].map((socket) => nextEvent(socket, "notification:read"));
      assert.equal((await request(contractor, "notifications:read-all", { id_usuario: 2 })).ok, true);
      for (const event of await Promise.all(updated)) assert.deepEqual(event, { all: true });
      const reloadedPage = await connect(sign(1, 1));
      const restored = (await request(reloadedPage, "notifications:list")).data;
      assert.equal(restored.totalNaoLidas, 0);
      assert.equal(restored.notifications.length, 11);
      assert.ok(restored.notifications.every((item) => item.lida));
      assert.equal((await request(freelancer, "notifications:list")).data.totalNaoLidas, 11);
      reloadedPage.disconnect();
    });

    await t.test("exclusão remove histórico e avisa somente os participantes", async () => {
      const notifications = [contractor, freelancer, secondTab].map((socket) => nextEvent(socket, "chat:conversation:deleted"));
      const notificationRefresh = [contractor, freelancer, secondTab].map((socket) => nextEvent(socket, "notifications:changed"));
      assert.equal((await request(contractor, "chat:conversations:delete", { id_conversa: conversationId })).ok, true);
      for (const notification of await Promise.all(notifications)) assert.equal(notification.id_conversa, conversationId);
      await Promise.all(notificationRefresh);
      assert.deepEqual((await request(freelancer, "chat:conversations:list")).data, []);
      assert.equal((await request(freelancer, "chat:messages:send", { id_conversa: conversationId, conteudo: "Depois" })).error.status, 404);
      const [[row]] = await db.query("SELECT COUNT(*) AS total FROM mensagem");
      assert.equal(row.total, 0);
      const [[notificationCount]] = await db.query("SELECT COUNT(*) AS total FROM notificacoes");
      assert.equal(notificationCount.total, 0);
      assert.deepEqual((await request(contractor, "notifications:list")).data, { notifications: [], totalNaoLidas: 0 });
      assert.deepEqual(leakedEvents, []);
    });

    await t.test("desconecta uma sessão quando o JWT expira", async () => {
      const socket = await connect(sign(1, 1, 2));
      const expired = nextEvent(socket, "chat:session:expired");
      const disconnected = nextEvent(socket, "disconnect");
      await expired;
      assert.equal(await disconnected, "io server disconnect");
    });
  } finally {
    clients.forEach((socket) => socket.disconnect());
    if (io) await new Promise((resolve) => io.close(resolve));
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (db) await db.end();
    if (createdDatabase && /^chat_ws_test_[a-f0-9]{32}$/.test(database)) {
      await admin.query(`DROP DATABASE \`${database}\``);
    }
    await admin.end();
  }
});
