import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../../services/api";
import { requestChat } from "../../../services/chatSocket";
import ConfirmActionModal from "../../../shared/components/ConfirmActionModal";
import CompleteJobModal from "../components/CompleteJobModal";
import DeleteJobModal from "../../../shared/components/DeleteJobModal";
import EditJobModal from "../components/EditJobModal";
import JobCard from "../../../shared/components/JobCard";

import CandidatesModal from "../components/CandidatesModal";

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState("");

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showRecuseCandidateModal, setShowRecuseCandidateModal] = useState(false);
  const [showAproveCandidateModal, setShowAproveCandidateModal] = useState(false);
  const [isUpdatingCandidate, setIsUpdatingCandidate] = useState(false);
  const [showCompleteJobModal, setShowCompleteJobModal] = useState(false);
  const [isCompletingJob, setIsCompletingJob] = useState(false);

  useEffect(() => {
    const getMyJobs = async () => {
      try {
        const response = await api.get("/jobs/myJobs");
        setJobs(response.data);
      } catch (error) {
        console.error("Erro ao buscar vagas:", error);
      }
    };

    getMyJobs();
  }, []);

  const openDeleteModal = (job) => {
    setSelectedJob(job);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedJob(null);
  };

  const openEditModal = (job) => {
    setSelectedJob(job);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedJob(null);
  };

  const handleDelete = async () => {
    if (!selectedJob) return;

    try {
      setIsDeleting(true);
      await api.delete(`/jobs/${selectedJob.id_vagas}`);
      setJobs((prev) =>
        prev.filter((job) => job.id_vagas !== selectedJob.id_vagas)
      );
      closeDeleteModal();
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async (formData) => {
    if (!selectedJob) return;

    try {
      setIsEditing(true);
      await api.put(`/jobs/${selectedJob.id_vagas}`, { formData });
      setJobs((prev) =>
        prev.map((job) =>
          job.id_vagas === selectedJob.id_vagas ? { ...job, ...formData } : job
        )
      );
      closeEditModal();
    } catch (error) {
      console.error("Erro ao editar vaga:", error);
    } finally {
      setIsEditing(false);
    }
  };

  const openCandidatesModal = async (job) => {
    setSelectedJob(job);
    setShowCandidatesModal(true);
    setCandidates([]);
    setCandidatesError("");

    try {
      setIsLoadingCandidates(true);
      const response = await api.get(`/jobs/${job.id_vagas}/candidates`);
      setCandidates(response.data);
    } catch (error) {
      setCandidatesError(error.response?.data?.message || "Erro ao buscar candidatos");
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const closeCandidatesModal = () => {
    setShowCandidatesModal(false);
    setSelectedJob(null);
    setSelectedCandidate(null);
    setShowRecuseCandidateModal(false);
    setShowAproveCandidateModal(false);
    setCandidates([]);
    setCandidatesError("");
  };

  const openRecuseCandidateModal = (candidate) => {
    setSelectedCandidate(candidate);
    setShowRecuseCandidateModal(true);
  };

  const openAproveCandidateModal = (candidate) => {
    setSelectedCandidate(candidate);
    setShowAproveCandidateModal(true);
  };

  const closeRecuseCandidateModal = () => {
    setSelectedCandidate(null);
    setShowRecuseCandidateModal(false);
  };

  const closeAproveCandidateModal = () => {
    setSelectedCandidate(null);
    setShowAproveCandidateModal(false);
  };

  const updateSelectedCandidateStatus = async (statusValue) => {
    if (!selectedJob || !selectedCandidate) return;

    const applicationId = selectedCandidate.idvagas_aplicadas;

    if (applicationId == null) {
      console.error("Candidato sem idvagas_aplicadas:", selectedCandidate);
      return;
    }

    const statusLabel = statusValue === 0 ? "Recusado" : "Aprovado";

    try {
      setIsUpdatingCandidate(true);
      setCandidatesError("");

      await api.patch(
        `/jobs/${selectedJob.id_vagas}/candidates/${applicationId}/status`,
        { flag_pendencia: statusValue }
      );

      setCandidates((prev) =>
        prev.map((candidate) => {
          if (candidate.idvagas_aplicadas === applicationId) {
            return { ...candidate, flag_pendencia: statusLabel };
          }

          if (statusValue === 2) {
            return { ...candidate, flag_pendencia: "Recusado" };
          }

          return candidate;
        })
      );

      if (statusValue === 2) {
        setJobs((prev) =>
          prev.map((job) =>
            job.id_vagas === selectedJob.id_vagas
              ? { ...job, usuario_selecionado: selectedCandidate.user_id }
              : job
          )
        );
      }

      if (statusValue === 0) {
        closeRecuseCandidateModal();
      } else {
        closeAproveCandidateModal();
      }
    } catch (error) {
      setCandidatesError(error.response?.data?.message || "Erro ao atualizar candidato");
    } finally {
      setIsUpdatingCandidate(false);
    }
  };

  const handleRecuseCandidate = () => updateSelectedCandidateStatus(0);

  const handleAproveCandidate = () => updateSelectedCandidateStatus(2);

  const handleOpenCandidateChat = async (candidate) => {
    if (!selectedJob) return;

    try {
      const response = await requestChat("chat:conversations:create", {
        id_vaga_conversa: selectedJob.id_vagas,
        id_user_freelancer_conversa: candidate.user_id,
      });

      const conversationId = response.id_conversa;

      if (!conversationId) {
        setCandidatesError("Não foi possível abrir o chat");
        return;
      }

      navigate(`/chat?conversation=${conversationId}`);
    } catch (error) {
      setCandidatesError(error.message || "Erro ao abrir chat");
    }
  };

  const openCompleteJobModal = (job) => {
    setSelectedJob(job);
    setShowCompleteJobModal(true);
  };

  const closeCompleteJobModal = () => {
    setShowCompleteJobModal(false);
    setSelectedJob(null);
  };

  const handleCompleteJob = async (rating) => {
    if (!selectedJob) return;

    try {
      setIsCompletingJob(true);
      await api.patch(`/jobs/${selectedJob.id_vagas}/complete`, {
        nota_avaliacao: rating,
      });

      setJobs((prev) =>
        prev.map((job) =>
          job.id_vagas === selectedJob.id_vagas
            ? { ...job, flag_status: 1, nota_avaliacao: rating }
            : job
        )
      );

      closeCompleteJobModal();
    } catch (error) {
      console.error("Erro ao concluir vaga:", error);
    } finally {
      setIsCompletingJob(false);
    }
  };


  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <JobCard
            key={job.id_vagas}
            job={job}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            onShowCandidates={openCandidatesModal}
            onComplete={
              job.usuario_selecionado && Number(job.flag_status) !== 1
                ? openCompleteJobModal
                : undefined
            }
          />
        ))}
      </div>

      <DeleteJobModal
        isOpen={showDeleteModal}
        job={selectedJob}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        title={"Tem certeza que deseja excluir a vaga"}
        btnName={{
          name1: "Excluindo...",
          name2: "Excluir"
        }}
      />

      <EditJobModal
        isOpen={showEditModal}
        job={selectedJob}
        onClose={closeEditModal}
        onSubmit={handleEdit}
        isSubmitting={isEditing}
      />

      <CandidatesModal
        isOpen={showCandidatesModal}
        job={selectedJob}
        candidates={candidates}
        isLoading={isLoadingCandidates}
        error={candidatesError}
        onClose={closeCandidatesModal}
        onRecuse={openRecuseCandidateModal}
        onAprove={openAproveCandidateModal}
        onChat={handleOpenCandidateChat}
      />

      <ConfirmActionModal
        isOpen={showRecuseCandidateModal}
        title="Recusar candidato"
        message="Tem certeza que deseja recusar o candidato"
        subject={selectedCandidate?.name}
        onClose={closeRecuseCandidateModal}
        onConfirm={handleRecuseCandidate}
        isLoading={isUpdatingCandidate}
        loadingText="Recusando..."
        confirmText="Recusar"
        confirmDisabled={!selectedCandidate}
        variant="danger"
      />

      <ConfirmActionModal
        isOpen={showAproveCandidateModal}
        title="Aprovar candidato"
        message="Tem certeza que deseja aprovar o candidato"
        subject={selectedCandidate?.name}
        onClose={closeAproveCandidateModal}
        onConfirm={handleAproveCandidate}
        isLoading={isUpdatingCandidate}
        loadingText="Aprovando..."
        confirmText="Aprovar"
        confirmDisabled={!selectedCandidate}
        variant="success"
      />

      <CompleteJobModal
        isOpen={showCompleteJobModal}
        job={selectedJob}
        onClose={closeCompleteJobModal}
        onConfirm={handleCompleteJob}
        isLoading={isCompletingJob}
      />
    </>
  );
}
