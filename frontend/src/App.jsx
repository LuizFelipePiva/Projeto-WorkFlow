import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppliedJobs from "./features/AppliedJobs/pages/AppliedJobs";
import Chat from "./features/Chat/pages/Chat";
import CreateJob from "./features/CreateJob/pages/CreateJob";
import Curriculum from "./features/Curriculum/pages/Curriculum";
import FinishedJobs from "./features/FinishedProjects/pages/FinishedJobs";
import Jobs from "./features/Jobs/pages/Jobs";
import Login from "./features/Login/pages/Login";
import MainPage from "./features/MainPage/pages/MainPage";
import Register from "./features/Register/pages/Register";
import Profile from "./features/Profile/pages/Profile";

import Notification from "./shared/components/Notification";
import PrivateLayout from "./shared/components/PrivateLayout";
import PrivateRoute from "./shared/components/PrivateRoute";
import PublicRoute from "./shared/components/PublicRoute";

function App() {
  return (
    <div className="App">
      <Notification />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route path="/Login" element={<Navigate to="/login" replace />} />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route path="/Register" element={<Navigate to="/register" replace />} />
          <Route
            element={
              <PrivateRoute>
                <PrivateLayout />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<MainPage />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/vagas-aplicadas" element={<AppliedJobs />} />
            <Route path="/projetos-concluidos" element={<FinishedJobs />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/create" element={<CreateJob />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/perfil" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
