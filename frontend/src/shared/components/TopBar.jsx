import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, X } from "lucide-react";
import { IoIosNotificationsOutline } from "react-icons/io";

import logo from "../../assets/logoEscura.png";

export default function Topbar({ notificationCenter }) {
  const { items, totalNaoLidas, connected, isLoading, error, refresh, markRead, markAllRead } = notificationCenter;
  const unreadNotifications = items.filter((notification) => !notification.lida);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const bellRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const openNotification = async (notification) => {
    if (pendingId !== null || !connected) return;
    setPendingId(notification.id);
    setActionError("");
    try {
      const saved = await markRead(notification.id);
      if (saved.link?.startsWith("/") && !saved.link.startsWith("//")) navigate(saved.link);
      setIsOpen(false);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setPendingId(null);
    }
  };

  const readAll = async () => {
    if (pendingId !== null || !connected) return;
    setPendingId("all");
    setActionError("");
    try {
      await markAllRead();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <header className="h-20 shrink-0 bg-white flex justify-between items-center gap-4 px-6 relative border-b border-gray-200 shadow-md z-30">
      <div className="flex h-full min-w-0 items-center justify-center overflow-hidden">
        {/* Compensa a margem transparente maior abaixo do logo. */}
        <img src={logo} alt="Workflow" className="w-56 max-w-none shrink-0 translate-y-[4.9%]" />
      </div>

      <div ref={containerRef} className="relative shrink-0">
        <button
          ref={bellRef}
          type="button"
          aria-label={`Notificações: ${totalNaoLidas} não lidas`}
          aria-expanded={isOpen}
          aria-controls={isOpen ? "notification-panel" : undefined}
          aria-haspopup="dialog"
          onClick={() => {
            setActionError("");
            setIsOpen((current) => !current);
            if (!isOpen) refresh();
          }}
          className="relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <IoIosNotificationsOutline size={25} aria-hidden="true" />
          {totalNaoLidas > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-semibold border-2 border-white">
              {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
            </span>
          )}
        </button>

        {isOpen && (
          <div
            ref={panelRef}
            id="notification-panel"
            role="dialog"
            aria-labelledby="notification-title"
            tabIndex={-1}
            className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden focus:outline-none"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div>
                <h2 id="notification-title" className="font-semibold text-gray-900">Notificações</h2>
                <p className="text-xs text-gray-500">{totalNaoLidas} não lidas</p>
              </div>
              <button
                type="button"
                aria-label="Fechar notificações"
                onClick={() => { setIsOpen(false); bellRef.current?.focus(); }}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {totalNaoLidas > 0 && (
              <button
                type="button"
                onClick={readAll}
                disabled={!connected || pendingId !== null}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCheck size={17} aria-hidden="true" />
                {pendingId === "all" ? "Marcando..." : "Marcar todas como lidas"}
              </button>
            )}

            {(error || actionError) && (
              <div role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <p>{actionError || error}</p>
                {connected && (
                  <button type="button" onClick={() => { setActionError(""); refresh(); }} className="mt-2 font-medium underline">
                    Atualizar lista
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[60vh] overflow-y-auto" aria-busy={isLoading}>
              {isLoading && unreadNotifications.length === 0 && <p className="p-6 text-sm text-gray-500">Carregando notificações...</p>}
              {!isLoading && !error && unreadNotifications.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Nenhuma notificação não lida.</p>}
              {unreadNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  disabled={!connected || pendingId !== null}
                  className="flex w-full items-start gap-3 border-t border-gray-100 px-4 py-3 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-blue-50 hover:bg-blue-100"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block break-words text-sm text-gray-800 font-semibold">
                      {notification.titulo}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {new Date(notification.criada_em).toLocaleString("pt-BR")}
                      {" · Não lida"}
                    </span>
                    {pendingId === notification.id && <span className="block text-xs text-blue-600 mt-1">Abrindo...</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
