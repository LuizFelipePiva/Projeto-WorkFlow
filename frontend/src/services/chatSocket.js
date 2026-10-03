import { io } from "socket.io-client";
import api from "./api";

export const chatSocket = io(api.defaults.baseURL, {
  autoConnect: false,
  transports: ["websocket"],
  auth: (callback) => callback({ token: localStorage.getItem("token") }),
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});

const waitForConnection = () => {
  if (chatSocket.connected) return Promise.resolve();
  if (!localStorage.getItem("token")) return Promise.reject(new Error("Entre novamente para usar o chat"));

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      chatSocket.off("connect", onConnect);
      chatSocket.off("connect_error", onError);
    };
    const onConnect = () => { cleanup(); resolve(); };
    const onError = (error) => {
      cleanup();
      reject(new Error(error.data?.code === "AUTH_ERROR" ? error.message : "Não foi possível conectar ao chat"));
    };
    const timer = setTimeout(() => onError(new Error("Tempo de conexão esgotado")), 10000);
    chatSocket.once("connect", onConnect);
    chatSocket.once("connect_error", onError);
    chatSocket.connect();
  });
};

export async function requestChat(event, payload = {}) {
  await waitForConnection();
  if (!chatSocket.connected) throw new Error("O chat desconectou. Aguarde a reconexão para tentar novamente.");
  let response;
  try {
    // Sem reenvio automático: uma confirmação perdida não pode duplicar a mensagem.
    response = await chatSocket.timeout(10000).emitWithAck(event, payload);
  } catch {
    throw new Error("Não foi possível confirmar a operação. Confira a conversa após reconectar antes de tentar novamente.");
  }
  if (!response?.ok) {
    const error = new Error(response?.error?.message || "Erro na operação do chat");
    error.status = response?.error?.status;
    throw error;
  }
  return response.data;
}
