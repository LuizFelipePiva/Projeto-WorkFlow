import { useEffect, useReducer } from "react";
import { chatSocket, requestChat } from "../../../services/chatSocket";
import { chatReducer, initialChatState } from "../state/chatState";

export default function useChat(preferredId) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  useEffect(() => {
    let disposed = false;
    let listRequest = 0;
    const deletedIds = new Set();
    const refreshConversations = async () => {
      const request = ++listRequest;
      try {
        const conversations = await requestChat("chat:conversations:list");
        if (!disposed && request === listRequest) {
          dispatch({ type: "conversationsLoaded", preferredId,
            conversations: conversations.filter((item) => !deletedIds.has(Number(item.id_conversa))) });
        }
      } catch (error) {
        if (!disposed && request === listRequest) dispatch({ type: "error", message: error.message });
      }
    };
    const onConnect = () => {
      dispatch({ type: "connected" });
      refreshConversations();
    };
    const onDisconnect = () => {
      listRequest++;
      dispatch({ type: "disconnected" });
    };
    const onConnectError = (error) => {
      dispatch({ type: "disconnected" });
      dispatch({ type: "error", message: error.data?.code === "AUTH_ERROR"
        ? error.message : "Não foi possível conectar ao chat. Tentando reconectar..." });
    };
    const onMessage = (message) => {
      if (deletedIds.has(Number(message.id_conversa_mensagem))) return;
      dispatch({ type: "messageCreated", message });
      refreshConversations();
    };
    const onDelete = ({ id_conversa }) => {
      deletedIds.add(Number(id_conversa));
      dispatch({ type: "conversationDeleted", conversationId: id_conversa });
      refreshConversations();
    };

    chatSocket.on("connect", onConnect);
    chatSocket.on("disconnect", onDisconnect);
    chatSocket.on("connect_error", onConnectError);
    chatSocket.on("chat:message:created", onMessage);
    chatSocket.on("chat:conversations:changed", refreshConversations);
    chatSocket.on("chat:conversation:deleted", onDelete);
    if (chatSocket.connected) onConnect();

    return () => {
      disposed = true;
      chatSocket.off("connect", onConnect);
      chatSocket.off("disconnect", onDisconnect);
      chatSocket.off("connect_error", onConnectError);
      chatSocket.off("chat:message:created", onMessage);
      chatSocket.off("chat:conversations:changed", refreshConversations);
      chatSocket.off("chat:conversation:deleted", onDelete);
    };
  }, [preferredId]);

  useEffect(() => {
    if (!state.activeConversationId || !state.connected) return;
    let disposed = false;
    const conversationId = state.activeConversationId;
    requestChat("chat:messages:list", { id_conversa: conversationId })
      .then((messages) => {
        if (!disposed) dispatch({ type: "messagesLoaded", conversationId, messages });
      })
      .catch((error) => {
        if (!disposed) dispatch({ type: "error", message: error.message });
      });
    return () => { disposed = true; };
  }, [state.activeConversationId, state.connected, state.connectionVersion]);

  return { ...state, dispatch };
}
