import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { restoreSession } from './services/auth.service'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import ChatRoom from './pages/ChatRoom'
import { SocketProvider } from './context/SocketContext'

export default function App() {
  useEffect(() => {
    restoreSession()  // runs once on load — silently restores session from cookie
  }, [])

  return (
    <BrowserRouter>
      <SocketProvider>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <ProtectedRoute>
              <ChatRoom />
            </ProtectedRoute>
          } />
        </Routes>
      </SocketProvider>
    </BrowserRouter>
  )
}
