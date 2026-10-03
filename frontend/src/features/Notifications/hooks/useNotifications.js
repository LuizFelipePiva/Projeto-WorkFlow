import { useCallback, useEffect, useRef, useState } from "react";
import { chatSocket, requestChat } from "../../../services/chatSocket";

const emptyState = {
  items: [], totalNaoLidas: 0, connected: false, isLoading: false, error: "",
};

export default function useNotifications(userId) {
  const [state, setState] = useState({ ...emptyState, userId: null });
  const reloadRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let requestVersion = 0;

    const update = (values) => {
      if (disposed) return;
      setState((current) => ({ ...(current.userId === userId ? current : emptyState), userId, ...values }));
    };
    const reload = async () => {
      if (!chatSocket.connected) return;
      const version = ++requestVersion;
      update({ isLoading: true, connected: true, error: "" });
      try {
        const result = await requestChat("notifications:list");
        if (version === requestVersion) {
          update({ items: result.notifications, totalNaoLidas: result.totalNaoLidas, isLoading: false });
        }
      } catch (error) {
        if (version === requestVersion) update({ error: error.message, isLoading: false });
      }
    };
    const onDisconnect = () => {
      requestVersion++;
      update({ connected: false, isLoading: false, error: "Sem conexão. A lista será atualizada ao reconectar." });
    };
    const onConnectError = () => {
      requestVersion++;
      update({ connected: false, isLoading: false, error: "Não foi possível conectar às notificações. Tentando novamente..." });
    };

    reloadRef.current = reload;
    chatSocket.on("connect", reload);
    chatSocket.on("disconnect", onDisconnect);
    chatSocket.on("connect_error", onConnectError);
    chatSocket.on("notification:created", reload);
    chatSocket.on("notification:read", reload);
    chatSocket.on("notifications:changed", reload);
    if (chatSocket.connected) reload();

    return () => {
      disposed = true;
      reloadRef.current = null;
      chatSocket.off("connect", reload);
      chatSocket.off("disconnect", onDisconnect);
      chatSocket.off("connect_error", onConnectError);
      chatSocket.off("notification:created", reload);
      chatSocket.off("notification:read", reload);
      chatSocket.off("notifications:changed", reload);
    };
  }, [userId]);

  const refresh = useCallback(() => reloadRef.current?.(), []);
  const markRead = async (id) => {
    const notification = await requestChat("notifications:read", { id });
    await refresh();
    return notification;
  };
  const markAllRead = async () => {
    await requestChat("notifications:read-all");
    await refresh();
  };

  return {
    ...(state.userId === userId ? state : { ...emptyState, isLoading: Boolean(userId) }),
    refresh, markRead, markAllRead,
  };
}
