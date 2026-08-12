import { Navigate, Route, Routes } from 'react-router-dom'
import { ConfirmProvider } from './components/ConfirmDialog'
import { RouteGuard } from './components/RouteGuard'
import { AuthProvider } from './context/AuthContext'
import { AdminAnalytics } from './pages/admin/AdminAnalytics'
import { AdminCertificados } from './pages/admin/AdminCertificados'
import { AdminComunidade } from './pages/admin/AdminComunidade'
import { AdminConfiguracoes } from './pages/admin/AdminConfiguracoes'
import { AdminGamificacao } from './pages/admin/AdminGamificacao'
import { AdminGrade } from './pages/admin/AdminGrade'
import { AdminProgramas } from './pages/admin/AdminProgramas'
import { AdminQuizzes } from './pages/admin/AdminQuizzes'
import { AdminScormLibrary } from './pages/admin/AdminScormLibrary'
import { AdminTrilhas } from './pages/admin/AdminTrilhas'
import { AdminUsuarios } from './pages/admin/AdminUsuarios'
import { Certificados } from './pages/aluno/Certificados'
import { Comunidade } from './pages/aluno/Comunidade'
import { Conquistas } from './pages/aluno/Conquistas'
import { CoursePlayer } from './pages/aluno/CoursePlayer'
import { CourseQuiz } from './pages/aluno/CourseQuiz'
import { Dashboard } from './pages/aluno/Dashboard'
import { DefinirSenha } from './pages/aluno/DefinirSenha'
import { MeuPdi } from './pages/aluno/MeuPdi'
import { MeuPerfil } from './pages/aluno/MeuPerfil'
import { PerfilPublico } from './pages/aluno/PerfilPublico'
import { Ranking } from './pages/aluno/Ranking'
import { Moderador } from './pages/moderador/Moderador'
import { Entrar } from './pages/public/Entrar'
import { Estande } from './pages/public/Estande'
import { Resultado } from './pages/public/Resultado'
import { ValidarCertificado } from './pages/public/ValidarCertificado'

function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/estande" replace />} />
        <Route path="/estande" element={<Estande />} />
        <Route path="/resultado" element={<Resultado />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/validar-certificado" element={<ValidarCertificado />} />

        <Route
          path="/dashboard"
          element={
            <RouteGuard>
              <Dashboard />
            </RouteGuard>
          }
        />
        <Route
          path="/definir-senha"
          element={
            <RouteGuard>
              <DefinirSenha />
            </RouteGuard>
          }
        />
        <Route
          path="/meu-perfil"
          element={
            <RouteGuard>
              <MeuPerfil />
            </RouteGuard>
          }
        />
        <Route
          path="/perfil/:userId"
          element={
            <RouteGuard>
              <PerfilPublico />
            </RouteGuard>
          }
        />
        <Route
          path="/ranking"
          element={
            <RouteGuard>
              <Ranking />
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
          path="/certificados"
          element={
            <RouteGuard>
              <Certificados />
            </RouteGuard>
          }
        />
        <Route
          path="/comunidade"
          element={
            <RouteGuard>
              <Comunidade />
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
          path="/admin/scorms"
          element={
            <RouteGuard allow={['admin']}>
              <AdminScormLibrary />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/certificados"
          element={
            <RouteGuard allow={['admin']}>
              <AdminCertificados />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/comunidade"
          element={
            <RouteGuard allow={['admin']}>
              <AdminComunidade />
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
          path="/admin/gamificacao"
          element={
            <RouteGuard allow={['admin']}>
              <AdminGamificacao />
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
        <Route
          path="/admin/configuracoes"
          element={
            <RouteGuard allow={['admin']}>
              <AdminConfiguracoes />
            </RouteGuard>
          }
        />

        <Route path="*" element={<Navigate to="/estande" replace />} />
      </Routes>
      </ConfirmProvider>
    </AuthProvider>
  )
}

export default App
