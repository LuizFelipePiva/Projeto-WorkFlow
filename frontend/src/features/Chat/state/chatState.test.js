import assert from "node:assert/strict";
import { test } from "node:test";
import { chatReducer, initialChatState } from "./chatState.js";

const conversation = (id) => ({ id_conversa: id, created_at: "2026-10-03T12:00:00Z", last_message_id: null });
const message = (id, conversationId = 1) => ({ id_mensagem: id, id_conversa_mensagem: conversationId,
  conteudo: `Mensagem ${id}`, created_at: "2026-10-03T13:00:00Z" });
const ready = () => chatReducer(initialChatState, { type: "conversationsLoaded", conversations: [conversation(1), conversation(2)], preferredId: 1 });

test("histórico e evento ao vivo se combinam sem perder ou duplicar mensagens", () => {
  let state = chatReducer(ready(), { type: "messageCreated", message: message(2) });
  state = chatReducer(state, { type: "messagesLoaded", conversationId: 1, messages: [message(1), message(2)] });
  state = chatReducer(state, { type: "messageCreated", message: message(2) });
  assert.deepEqual(state.messages.map((item) => item.id_mensagem), [1, 2]);
});

test("respostas da conversa anterior não aparecem após trocar de conversa", () => {
  let state = chatReducer(ready(), { type: "select", conversationId: 2 });
  state = chatReducer(state, { type: "messagesLoaded", conversationId: 1, messages: [message(1)] });
  state = chatReducer(state, { type: "messageCreated", message: message(2, 1) });
  assert.deepEqual(state.messages, []);
  assert.equal(state.activeConversationId, 2);
  assert.equal(state.conversations.find((item) => item.id_conversa === 1).last_message, "Mensagem 2");
});

test("listagem atrasada preserva a prévia da mensagem mais recente", () => {
  let state = chatReducer(ready(), { type: "messageCreated", message: message(5) });
  state = chatReducer(state, { type: "conversationsLoaded", conversations: [conversation(1), conversation(2)], preferredId: 1 });
  assert.equal(state.conversations[0].id_conversa, 1);
  assert.equal(state.conversations[0].last_message_id, 5);
});

test("exclusão sincronizada esvazia o histórico e seleciona uma conversa existente", () => {
  let state = chatReducer(ready(), { type: "messageCreated", message: message(1) });
  state = chatReducer(state, { type: "conversationDeleted", conversationId: 1 });
  assert.equal(state.activeConversationId, 2);
  assert.deepEqual(state.messages, []);
  state = chatReducer(state, { type: "conversationDeleted", conversationId: 2 });
  assert.equal(state.activeConversationId, null);
  assert.equal(state.isLoadingMessages, false);
});
