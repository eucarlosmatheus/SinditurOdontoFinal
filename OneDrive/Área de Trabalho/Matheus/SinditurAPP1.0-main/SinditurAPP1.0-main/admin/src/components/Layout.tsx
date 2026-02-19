import React, { useEffect, useState, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-toastify'
import { FiHome, FiCalendar, FiDollarSign, FiPackage, FiUsers, FiFileText, FiUserCheck, FiMapPin, FiUser, FiSettings, FiLogOut, FiBell, FiWifi, FiWifiOff } from 'react-icons/fi'
import socketService from '../services/socket'
import './Layout.css'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [connected, setConnected] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Connect to Socket.IO
    socketService.connect()

    // Check connection status periodically
    const interval = setInterval(() => {
      setConnected(socketService.isConnected())
    }, 2000)

    // Listen for real-time events
    const cleanups: Function[] = []

    cleanups.push(socketService.on('new_appointment', (data: any) => {
      const notif = {
        id: Date.now(),
        type: 'new_appointment',
        title: 'Novo Agendamento',
        message: `${data.patient_name} agendou ${data.service_name} com ${data.doctor_name} em ${data.date} às ${data.time}`,
        timestamp: new Date(),
        read: false
      }
      setNotifications(prev => [notif, ...prev.slice(0, 49)])
      playNotificationSound()
      toast.info(`Novo agendamento: ${data.patient_name} - ${data.date} ${data.time}`, { autoClose: 5000 })
    }))

    cleanups.push(socketService.on('new_patient', (data: any) => {
      const notif = {
        id: Date.now(),
        type: 'new_patient',
        title: 'Novo Paciente',
        message: `${data.name} (CPF: ${data.cpf}) se cadastrou no app`,
        timestamp: new Date(),
        read: false
      }
      setNotifications(prev => [notif, ...prev.slice(0, 49)])
      playNotificationSound()
      toast.info(`Novo paciente cadastrado: ${data.name}`, { autoClose: 5000 })
    }))

    cleanups.push(socketService.on('appointment_cancelled', (data: any) => {
      const notif = {
        id: Date.now(),
        type: 'appointment_cancelled',
        title: 'Agendamento Cancelado',
        message: `${data.patient_name} cancelou o agendamento de ${data.date} às ${data.time}`,
        timestamp: new Date(),
        read: false
      }
      setNotifications(prev => [notif, ...prev.slice(0, 49)])
      playNotificationSound()
      toast.warning(`Agendamento cancelado: ${data.patient_name}`, { autoClose: 5000 })
    }))

    cleanups.push(socketService.on('appointment_updated', (data: any) => {
      const notif = {
        id: Date.now(),
        type: 'appointment_updated',
        title: 'Agendamento Atualizado',
        message: `Agendamento de ${data.patient_name} foi marcado como ${data.status}`,
        timestamp: new Date(),
        read: false
      }
      setNotifications(prev => [notif, ...prev.slice(0, 49)])
    }))

    return () => {
      clearInterval(interval)
      cleanups.forEach(cleanup => cleanup())
      socketService.disconnect()
    }
  }, [])

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.value = 0.3

      oscillator.start()

      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      oscillator.stop(audioContext.currentTime + 0.3)

      setTimeout(() => {
        const osc2 = audioContext.createOscillator()
        const gain2 = audioContext.createGain()
        osc2.connect(gain2)
        gain2.connect(audioContext.destination)
        osc2.frequency.value = 1000
        osc2.type = 'sine'
        gain2.gain.value = 0.3
        osc2.start()
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        osc2.stop(audioContext.currentTime + 0.3)
      }, 150)
    } catch (e) {
      console.log('Could not play notification sound')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'new_appointment': return '📅'
      case 'new_patient': return '👤'
      case 'appointment_cancelled': return '❌'
      case 'appointment_updated': return '✅'
      default: return '🔔'
    }
  }

  const hasPermission = (perm?: string) => {
    if (!perm) return true
    if (!user) return false
    if (user.role === 'admin' || user.permissions?.includes('all')) return true
    return user.permissions?.includes(perm)
  }

  const allMenuItems = [
    { path: '/', icon: FiHome, label: 'Inicio' },
    { path: '/agenda', icon: FiCalendar, label: 'Agenda', permission: 'agenda' },
    { path: '/financeiro', icon: FiDollarSign, label: 'Financeiro', permission: 'financeiro' },
    { path: '/estoque', icon: FiPackage, label: 'Estoque', permission: 'estoque' },
    { path: '/pacientes', icon: FiUsers, label: 'Pacientes', permission: 'pacientes' },
    { path: '/documentos', icon: FiFileText, label: 'Documentos', permission: 'documentos' },
    { path: '/equipe', icon: FiUserCheck, label: 'Equipe', permission: 'equipe' },
    { path: '/clinicas', icon: FiMapPin, label: 'Clinicas', permission: 'configuracoes' },
    { path: '/doutores', icon: FiUser, label: 'Doutores', permission: 'configuracoes' },
    { path: '/servicos', icon: FiSettings, label: 'Servicos', permission: 'configuracoes' },
  ]

  const menuItems = allMenuItems.filter(item => hasPermission(item.permission))

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Odonto Sinditur</h2>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
            >
              <item.icon />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="connection-status">
            {connected ? (
              <span className="status-online"><FiWifi /> Tempo real ativo</span>
            ) : (
              <span className="status-offline"><FiWifiOff /> Desconectado</span>
            )}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <FiLogOut />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <div className="top-bar">
          <div className="top-bar-right">
            <div className="notification-bell" onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead() }}>
              <FiBell />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </div>
          </div>
          
          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notif-header">
                <h3>Notificacoes</h3>
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])}>Limpar</button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">Nenhuma notificacao</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                      <span className="notif-icon">{getNotifIcon(n.type)}</span>
                      <div className="notif-content">
                        <strong>{n.title}</strong>
                        <p>{n.message}</p>
                        <small>{new Date(n.timestamp).toLocaleTimeString('pt-BR')}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  )
}
