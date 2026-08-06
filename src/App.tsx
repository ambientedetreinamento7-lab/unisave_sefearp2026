import { Navigate, Route, Routes } from 'react-router-dom'
import { RouteGuard } from './components/RouteGuard'
import { AuthProvider } from './context/AuthContext'
import { AdminAnalytics } from './pages/admin/AdminAnalytics'
import { AdminGrade } from './pages/admin/AdminGrade'
import { AdminProgramas } from './pages/admin/AdminProgramas'
import { AdminQuizzes } from './pages/admin/AdminQuizzes'
import { AdminTrilhas } from './pages/admin/AdminTrilhas'
import { AdminUsuarios } from './pages/admin/AdminUsuarios'
import { Conquistas } from './pages/aluno/Conquistas'
import { CoursePlayer } from './pages/aluno/CoursePlayer'
import { CourseQuiz } from './pages/aluno/CourseQuiz'
import { Dashboard } from './pages/aluno/Dashboard'
import { MeuPdi } from './pages/aluno/MeuPdi'
import { Moderador } from './pages/moderador/Moderador'
import { Entrar } from './pages/public/Entrar'
import { Estande } from './pages/public/Estande'
import { Resultado } from './pages/public/Resultado'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/estande" replace />} />
        <Route path="/estande" element={<Estande />} />
        <Route path="/resultado" element={<Resultado />} />
        <Route path="/entrar" element={<Entrar />} />

        <Route
          path="/dashboard"
          element={
            <RouteGuard>
              <Dashboard />
            </RouteGuard>
          }
        />
        <Route
          path="/curso/:id"
          element={
            <RouteGuard>
              <CoursePlayer />
            </RouteGuard>
          }
        />
        <Route
          path="/curso/:id/quiz"
          element={
            <RouteGuard>
              <CourseQuiz />
            </RouteGuard>
          }
        />
        <Route
          path="/conquistas"
          element={
            <RouteGuard>
              <Conquistas />
            </RouteGuard>
          }
        />
        <Route
          path="/meu-pdi"
          element={
            <RouteGuard>
              <MeuPdi />
            </RouteGuard>
          }
        />

        <Route
          path="/moderador"
          element={
            <RouteGuard allow={['moderador', 'admin']}>
              <Moderador />
            </RouteGuard>
          }
        />

        <Route
          path="/admin/programas"
          element={
            <RouteGuard allow={['admin']}>
              <AdminProgramas />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/trilhas"
          element={
            <RouteGuard allow={['admin']}>
              <AdminTrilhas />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/quizzes"
          element={
            <RouteGuard allow={['admin']}>
              <AdminQuizzes />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/grade"
          element={
            <RouteGuard allow={['admin']}>
              <AdminGrade />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <RouteGuard allow={['admin']}>
              <AdminUsuarios />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <RouteGuard allow={['admin']}>
              <AdminAnalytics />
            </RouteGuard>
          }
        />

        <Route path="*" element={<Navigate to="/estande" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
