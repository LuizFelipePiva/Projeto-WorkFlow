import { ChevronDown, ChevronUp, LogOut, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBriefcase, FaCheckCircle, FaFileAlt, FaHome, FaPlus } from "react-icons/fa";
import { IoIosChatbubbles, IoIosPaper } from "react-icons/io";

import { useState } from "react";


const menuButtonClass = (active) =>
  `flex w-full items-center gap-3 overflow-hidden rounded-lg p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-inset ${active
    ? "bg-white text-black"
    : "text-white hover:bg-white hover:text-black"
  }`;

const menuLabelClass =
  "whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:opacity-100 motion-reduce:transition-none";

export default function Sidebar({ user, isFreelancer, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [jobsOpen, setJobsOpen] = useState(false);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <aside className="group/sidebar flex h-full min-h-0 w-20 shrink-0 flex-col overflow-hidden bg-[#263544] px-3 pb-3 transition-[width] duration-300 ease-in-out hover:w-64 has-[:focus-visible]:w-64 motion-reduce:transition-none">


      <div className="flex h-20 shrink-0 items-center overflow-hidden border-b border-white/10">
        <button
          type="button"
          onClick={() => navigate("/perfil")}
          className="flex h-14 w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg px-2 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-inset"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            <p>{user.name.charAt(0).toUpperCase()}</p>
          </div>
          <div className={`min-w-0 flex-1 ${menuLabelClass}`}>
            <p className="truncate text-sm font-semibold text-white" title={user.name}>
              {user.name}
            </p>
            <p className="text-xs text-gray-300">
              {isFreelancer ? "Freelancer" : "Contratante"}
            </p>
          </div>
        </button>
      </div>


      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-3 pt-3 [scrollbar-width:thin]">

        <nav aria-label="Menu principal" className="space-y-3">
          <button
            type="button"
            aria-label="Tela Inicial"
            aria-current={isActive("/dashboard") ? "page" : undefined}
            onClick={() => navigate("/dashboard")}
            className={menuButtonClass(isActive("/dashboard"))}
          >
            <FaHome size={24} className="shrink-0" aria-hidden="true" />
            <span className={menuLabelClass}>Tela Inicial</span>
          </button>

          {isFreelancer ? (
            <>
              <button
                type="button"
                aria-label="Currículo"
                aria-current={isActive("/curriculum") ? "page" : undefined}
                onClick={() => navigate("/curriculum")}
                className={menuButtonClass(isActive("/curriculum"))}
              >
                <FaFileAlt size={24} className="shrink-0" aria-hidden="true" />
                <span className={menuLabelClass}>Currículo</span>
              </button>

              <button
                type="button"
                aria-label="Vagas Aplicadas"
                aria-current={isActive("/vagas-aplicadas") ? "page" : undefined}
                onClick={() => navigate("/vagas-aplicadas")}
                className={menuButtonClass(isActive("/vagas-aplicadas"))}
              >
                <IoIosPaper size={24} className="shrink-0" aria-hidden="true" />
                <span className={menuLabelClass}>Vagas Aplicadas</span>
              </button>

              <button
                type="button"
                aria-label="Projetos Concluídos"
                aria-current={isActive("/projetos-concluidos") ? "page" : undefined}
                onClick={() => navigate("/projetos-concluidos")}
                className={menuButtonClass(isActive("/projetos-concluidos"))}
              >
                <FaCheckCircle size={24} className="shrink-0" aria-hidden="true" />
                <span className={menuLabelClass}>Projetos Concluídos</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label="Vagas"
              aria-expanded={jobsOpen}
              aria-controls="sidebar-jobs-menu"
              onClick={() => setJobsOpen((open) => !open)}
              className={menuButtonClass(isActive("/jobs"))}
            >
              <FaBriefcase size={24} className="shrink-0" aria-hidden="true" />
              <span className={`flex flex-1 items-center justify-between gap-3 ${menuLabelClass}`}>
                <span>Vagas</span>
                {jobsOpen ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </span>
            </button>
          )}
          {!isFreelancer && jobsOpen && (
            <div
              id="sidebar-jobs-menu"
              className="flex flex-col gap-2 transition-[padding] duration-300 group-hover/sidebar:pl-4 group-has-[:focus-visible]/sidebar:pl-4 motion-reduce:transition-none"
            >
              <button
                type="button"
                aria-label="Minhas vagas"
                aria-current={location.pathname === "/jobs" ? "page" : undefined}
                onClick={() => navigate("/jobs")}
                className={menuButtonClass(location.pathname === "/jobs")}
              >
                <IoIosPaper size={24} className="shrink-0" aria-hidden="true" />
                <span className={menuLabelClass}>Minhas vagas</span>
              </button>

              <button
                type="button"
                aria-label="Nova vaga"
                aria-current={isActive("/jobs/create") ? "page" : undefined}
                onClick={() => navigate("/jobs/create")}
                className={menuButtonClass(isActive("/jobs/create"))}
              >
                <FaPlus size={24} className="shrink-0" aria-hidden="true" />
                <span className={menuLabelClass}>Nova vaga</span>
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label="Chat"
            aria-current={isActive("/chat") ? "page" : undefined}
            onClick={() => navigate("/chat")}
            className={menuButtonClass(isActive("/chat"))}
          >
            <IoIosChatbubbles size={24} className="shrink-0" aria-hidden="true" />
            <span className={menuLabelClass}>Chat</span>
          </button>
        </nav>
      </div>

      <div className="shrink-0 border-t border-white/20 pt-3">
        <button
          type="button"
          aria-label="Sair da conta"
          onClick={onLogout}
          className="flex w-full items-center gap-3 overflow-hidden rounded-lg p-4 text-left text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-inset"
        >
          <LogOut size={24} className="shrink-0" aria-hidden="true" />
          <span className={menuLabelClass}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
