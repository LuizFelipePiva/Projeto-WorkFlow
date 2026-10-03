import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../services/api";
import Sidebar from "./Sidebar";
import Topbar from "./TopBar";
import { chatSocket } from "../../services/chatSocket";
import useNotifications from "../../features/Notifications/hooks/useNotifications";

const USER_TYPES = {
  FREELANCER: 0,
  CONTRATANTE: 1,
};

export default function PrivateLayout() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const notificationCenter = useNotifications(user?.id);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    const loadUser = async () => {
      try {
        const response = await api.get("/auth/me");
        setUser(response.data.user || response.data);
      } catch (err) {
        localStorage.removeItem("token");
        toast.error(err.response?.data?.message || "Sessao expirada");
        navigate("/login");
      }
    };

    loadUser();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const expireSession = () => {
      chatSocket.disconnect();
      localStorage.removeItem("token");
      toast.error("Sessão expirada. Entre novamente.");
      navigate("/login", { replace: true });
    };
    const onConnectError = (error) => {
      if (error.data?.code === "AUTH_ERROR") expireSession();
    };
    chatSocket.on("chat:session:expired", expireSession);
    chatSocket.on("connect_error", onConnectError);
    chatSocket.connect();
    return () => {
      chatSocket.off("chat:session:expired", expireSession);
      chatSocket.off("connect_error", onConnectError);
      chatSocket.disconnect();
    };
  }, [user, navigate]);

  const handleLogout = () => {
    chatSocket.disconnect();
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (!user) {
    return <div className="p-6">Carregando...</div>;
  }

  const isFreelancer = user.user_type === USER_TYPES.FREELANCER;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2f7fb]">
      <Sidebar
        user={user}
        isFreelancer={isFreelancer}
        onLogout={handleLogout}
      />

      <div className="min-h-0 min-w-0 flex-1 flex flex-col">
        <Topbar notificationCenter={notificationCenter} />

        <main className="min-h-0 flex-1 p-6 overflow-auto">
          <Outlet
            context={{
              user,
              isFreelancer
            }}
          />
        </main>
      </div>
    </div>
  );
}
