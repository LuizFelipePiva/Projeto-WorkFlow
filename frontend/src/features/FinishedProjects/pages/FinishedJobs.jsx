import { useEffect, useState } from "react";
import { Star } from "lucide-react";

import api from "../../../services/api";
import JobCard from "../../../shared/components/JobCard";

export default function FinishedJobs() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCompletedProjects = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await api.get("/jobs/completed");
        setProjects(response.data);
      } catch (err) {
        setError(err.response?.data?.message || "Erro ao buscar projetos concluídos");
      } finally {
        setIsLoading(false);
      }
    };

    loadCompletedProjects();
  }, []);

  const ratings = projects
    .map((project) => Number(project.nota_avaliacao))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const averageRating = ratings.length > 0
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 2) / 2
    : 0;
  const formattedRating = averageRating.toLocaleString("pt-BR");
  if (isLoading) {
    return <p className="text-gray-600">Carregando projetos concluídos...</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl shadow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            Projetos concluídos
          </h1>

          <div className="flex flex-col items-start gap-1">
            <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full shrink-0">
              {projects.length} projetos
            </span>
            <p className="text-xs text-gray-500">Média de avaliações</p>
            <div className="flex items-center gap-2">
              <div
                className="flex gap-1"
                role="img"
                aria-label={ratings.length > 0
                  ? `Média de ${formattedRating} de 5 estrelas`
                  : "Sem avaliações"}
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const fillPercentage = Math.min(Math.max(averageRating - value + 1, 0), 1) * 100;

                  return (
                    <span key={value} className="relative inline-flex" aria-hidden="true">
                      <Star size={22} className="text-gray-300" />
                      <span
                        className="absolute inset-y-0 left-0 overflow-hidden"
                        style={{ width: `${fillPercentage}%` }}
                      >
                        <Star size={22} className="fill-yellow-400 text-yellow-400" />
                      </span>
                    </span>
                  );
                })}
              </div>
              <span className="text-sm text-gray-600">
                {ratings.length > 0 ? `${formattedRating} / 5` : "Sem avaliações"}
              </span>
            </div>
          </div>
        </div>

        <p className="text-gray-500 mt-1">
          Vagas aprovadas que já foram finalizadas pelo contratante.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white p-5 rounded-xl shadow">
          <p className="text-gray-500">Nenhum projeto concluído encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project) => (
            <JobCard key={project.id_vagas} job={project} />
          ))}
        </div>
      )}
    </div>
  );
}
