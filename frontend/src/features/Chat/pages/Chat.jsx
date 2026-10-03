import { useEffect, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  BriefcaseBusiness,
  MessageCircle,
  MoreVertical,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import { requestChat } from "../../../services/chatSocket";
import useChat from "../hooks/useChat";
import ConfirmActionModal from "../../../shared/components/ConfirmActionModal";

const formatMessageTime = (date) => {
  if (!date) return "";

  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Chat() {
  const { user, isFreelancer } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    conversations, activeConversationId, messages, connected,
    isLoadingConversations, isLoadingMessages, error, dispatch,
  } = useChat(Number(searchParams.get("conversation")));
  const messageListRef = useRef(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({ conversationId: null, text: "" });
  const message = Number(draft.conversationId) === Number(activeConversationId) ? draft.text : "";
  const [isSending, setIsSending] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [deleteConversationId, setDeleteConversationId] = useState(null);
  const conversationToDelete = conversations.find(
    (conversation) => Number(conversation.id_conversa) === Number(deleteConversationId)
  );

  const activeConversation = conversations.find(
    (conversation) => Number(conversation.id_conversa) === Number(activeConversationId)
  );

  const filteredConversations = conversations.filter((conversation) => {
    const term = search.toLowerCase();
    const name = conversation.other_user_name ?? "";
    const jobTitle = conversation.job_title ?? "";

    return (
      name.toLowerCase().includes(term) ||
      jobTitle.toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, activeConversationId]);

  const handleSelectConversation = (conversationId) => {
    dispatch({ type: "select", conversationId });
    setSearchParams({ conversation: conversationId }, { replace: true });
    setDraft({ conversationId, text: "" });
    setDeleteConversationId(null);
    setIsOptionsOpen(false);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || !activeConversation || !connected || isSending) return;
    const submittedMessage = message;

    try {
      setIsSending(true);
      dispatch({ type: "clearError" });

      const savedMessage = await requestChat("chat:messages:send", {
        id_conversa: activeConversation.id_conversa,
        conteudo: trimmedMessage,
      });
      dispatch({ type: "messageCreated", message: savedMessage });
      setDraft((current) => Number(current.conversationId) === Number(savedMessage.id_conversa_mensagem)
        && current.text === submittedMessage ? { ...current, text: "" } : current);
    } catch (err) {
      dispatch({ type: "error", message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete || !connected || isDeletingConversation) return;

    try {
      setIsDeletingConversation(true);
      dispatch({ type: "clearError" });
      await requestChat("chat:conversations:delete", { id_conversa: conversationToDelete.id_conversa });
      dispatch({ type: "conversationDeleted", conversationId: conversationToDelete.id_conversa });
      setIsOptionsOpen(false);
      setDeleteConversationId(null);
    } catch (err) {
      dispatch({ type: "error", message: err.message });
    } finally {
      setIsDeletingConversation(false);
    }
  };

  return (
    <div className="h-full min-h-[620px] bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[340px_1fr]">
      <aside className="border-r border-gray-200 bg-slate-50 flex flex-col min-h-[280px]">
        <div className="p-5 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
              <p className="text-sm text-gray-500 mt-1">
                {isFreelancer
                  ? "Converse com contratantes"
                  : "Converse com candidatos"}
              </p>
              <p role="status" className={`text-xs mt-2 ${connected ? "text-green-600" : "text-amber-600"}`}>
                {connected ? "Conectado" : "Conectando ao chat..."}
              </p>
            </div>

            <span className="h-11 w-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <BriefcaseBusiness size={21} />
            </span>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
          )}

          <div className="relative mt-5">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversa..."
              className="w-full border border-gray-200 rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoadingConversations && (
            <p className="text-sm text-gray-500 p-3">Carregando conversas...</p>
          )}

          {!isLoadingConversations && filteredConversations.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              <MessageCircle className="mx-auto mb-3 text-gray-300" size={34} />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          )}

          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id_conversa}
              type="button"
              onClick={() => handleSelectConversation(conversation.id_conversa)}
              className={`w-full text-left p-4 rounded-xl transition border ${
                conversation.id_conversa === activeConversationId
                  ? "bg-white border-blue-200 shadow-sm"
                  : "bg-transparent border-transparent hover:bg-white hover:border-gray-200"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {conversation.other_user_name}
                </p>
                <p className="text-xs text-gray-500 truncate mt-1">
                  {conversation.job_title || "Conversa"}
                </p>
              </div>

              <p className="text-xs text-gray-500 truncate mt-3">
                {conversation.last_message || "Nenhuma mensagem ainda"}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-col min-h-[620px] bg-[#f7fbff]">
        {activeConversation ? (
          <>
            <header className="h-20 px-5 border-b border-gray-200 bg-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {activeConversation.other_user_name}
                </h2>
                <p className="text-sm text-gray-500 truncate">
                  {activeConversation.job_title || "Conversa"}
                </p>
              </div>

              <div className="relative">
                <button
                  type="button"
                  className="h-10 w-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500"
                  aria-label="Mais opções"
                  onClick={() => setIsOptionsOpen((prev) => !prev)}
                >
                  <MoreVertical size={20} />
                </button>

                {isOptionsOpen && (
                  <div className="absolute right-0 top-12 w-44 rounded-xl border border-gray-200 bg-white shadow-lg p-2 z-20">
                    <button
                      type="button"
                      className="w-full px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={() => {
                        setDeleteConversationId(activeConversationId);
                        setIsOptionsOpen(false);
                      }}
                      disabled={isDeletingConversation || !connected}
                    >
                      <Trash2 size={16} />
                      {isDeletingConversation ? "Apagando..." : "Apagar chat"}
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div ref={messageListRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoadingMessages && (
                <p className="text-sm text-gray-500">Carregando mensagens...</p>
              )}

              {!isLoadingMessages && messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-center text-gray-500">
                  <div>
                    <MessageCircle className="mx-auto mb-3 text-gray-300" size={38} />
                    <p>Nenhuma mensagem ainda.</p>
                  </div>
                </div>
              )}

              {messages.map((item) => {
                const isMine = Number(item.id_sender) === Number(user.id);

                return (
                  <div
                    key={item.id_mensagem}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                        isMine
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{item.conteudo}</p>
                      <p
                        className={`text-[11px] mt-2 text-right ${
                          isMine ? "text-blue-100" : "text-gray-400"
                        }`}
                      >
                        {formatMessageTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-gray-200 bg-white flex items-center gap-3"
            >
              

              <input
                type="text"
                maxLength={4000}
                disabled={!connected || isSending}
                aria-label="Mensagem"
                value={message}
                onChange={(event) => setDraft({ conversationId: activeConversationId, text: event.target.value })}
                placeholder="Digite sua mensagem..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="submit"
                className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!message.trim() || isSending || !connected}
              >
                <Send size={18} />
                {isSending ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <MessageCircle className="mx-auto mb-3 text-gray-300" size={42} />
              <h2 className="text-xl font-semibold text-gray-900">
                Nenhuma conversa selecionada
              </h2>
              <p className="text-gray-500 mt-2">
                Selecione uma conversa para começar.
              </p>
            </div>
          </div>
        )}
      </section>

      <ConfirmActionModal
        isOpen={Boolean(conversationToDelete)}
        title="Apagar chat"
        message="Tem certeza que deseja apagar o chat com"
        subject={conversationToDelete?.other_user_name}
        onClose={() => setDeleteConversationId(null)}
        onConfirm={handleDeleteConversation}
        isLoading={isDeletingConversation}
        loadingText="Apagando..."
        confirmText="Apagar"
        confirmDisabled={!conversationToDelete || !connected}
        variant="danger"
      />
    </div>
  );
}
