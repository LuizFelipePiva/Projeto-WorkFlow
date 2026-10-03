export const initialChatState = {
  conversations: [],
  activeConversationId: null,
  messages: [],
  connected: false,
  connectionVersion: 0,
  isLoadingConversations: true,
  isLoadingMessages: false,
  error: "",
};

const sameId = (first, second) => Number(first) === Number(second);
const mergeMessages = (history, live) =>
  [...new Map([...history, ...live].map((message) => [Number(message.id_mensagem), message])).values()]
    .sort((first, second) => Number(first.id_mensagem) - Number(second.id_mensagem));

const sortConversations = (conversations) => [...conversations].sort((first, second) => {
  const firstDate = new Date(first.last_message_created_at || first.created_at).getTime();
  const secondDate = new Date(second.last_message_created_at || second.created_at).getTime();
  return secondDate - firstDate || Number(second.last_message_id || 0) - Number(first.last_message_id || 0)
    || Number(second.id_conversa) - Number(first.id_conversa);
});

export function chatReducer(state, action) {
  switch (action.type) {
    case "connected":
      return { ...state, connected: true, error: "", isLoadingConversations: true, connectionVersion: state.connectionVersion + 1,
        isLoadingMessages: Boolean(state.activeConversationId) };
    case "disconnected":
      return { ...state, connected: false, isLoadingMessages: false, isLoadingConversations: false };
    case "loadingConversations":
      return { ...state, isLoadingConversations: true };
    case "select":
      if (sameId(state.activeConversationId, action.conversationId)) return state;
      return { ...state, activeConversationId: action.conversationId, messages: [],
        isLoadingMessages: Boolean(action.conversationId), error: "" };
    case "conversationsLoaded": {
      const conversations = sortConversations(action.conversations.map((conversation) => {
        const current = state.conversations.find((item) => sameId(item.id_conversa, conversation.id_conversa));
        // Uma resposta de listagem antiga não deve sobrescrever uma mensagem recém-recebida.
        return Number(current?.last_message_id) > Number(conversation.last_message_id || 0)
          ? { ...conversation, last_message: current.last_message,
            last_message_created_at: current.last_message_created_at, last_message_id: current.last_message_id }
          : conversation;
      }));
      const selected = conversations.find((item) => sameId(item.id_conversa, action.preferredId))
        || conversations.find((item) => sameId(item.id_conversa, state.activeConversationId))
        || conversations[0];
      const activeConversationId = selected?.id_conversa ?? null;
      const changed = !sameId(activeConversationId, state.activeConversationId);
      return { ...state, conversations, activeConversationId, isLoadingConversations: false,
        messages: changed ? [] : state.messages,
        isLoadingMessages: changed ? Boolean(activeConversationId) : state.isLoadingMessages };
    }
    case "messagesLoaded":
      if (!sameId(action.conversationId, state.activeConversationId)) return state;
      return { ...state, messages: mergeMessages(action.messages, state.messages), isLoadingMessages: false };
    case "messageCreated": {
      const message = action.message;
      const conversations = sortConversations(state.conversations.map((conversation) =>
        sameId(conversation.id_conversa, message.id_conversa_mensagem)
          && Number(message.id_mensagem) > Number(conversation.last_message_id || 0)
          ? { ...conversation, last_message: message.conteudo,
            last_message_created_at: message.created_at, last_message_id: message.id_mensagem }
          : conversation
      ));
      return { ...state, conversations,
        messages: sameId(message.id_conversa_mensagem, state.activeConversationId)
          ? mergeMessages(state.messages, [message]) : state.messages };
    }
    case "conversationDeleted": {
      const conversations = state.conversations.filter((item) => !sameId(item.id_conversa, action.conversationId));
      if (!sameId(state.activeConversationId, action.conversationId)) return { ...state, conversations };
      return { ...state, conversations, activeConversationId: conversations[0]?.id_conversa ?? null,
        messages: [], isLoadingMessages: conversations.length > 0 };
    }
    case "error":
      return { ...state, error: action.message, isLoadingConversations: false, isLoadingMessages: false };
    case "clearError":
      return { ...state, error: "" };
    default:
      return state;
  }
}
