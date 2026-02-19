import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { FiCheck, FiX, FiCalendar, FiMapPin, FiRefreshCw } from 'react-icons/fi'
import { appointmentsAPI, unitsAPI, doctorsAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import socketService from '../services/socket'
import './Agenda.css'

export default function Agenda() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [showAllDates, setShowAllDates] = useState(false)
  const [myDoctorId, setMyDoctorId] = useState<string | null>(null)
  const todayFormatted = new Date().toLocaleDateString('pt-BR')
  const isAdmin = user?.role === 'admin' || user?.permissions?.includes('all')

  useEffect(() => {
    loadUnits()
    if (!isAdmin) {
      doctorsAPI.getAll().then(res => {
        const match = res.data.find((d: any) =>
          d.email?.toLowerCase() === user?.email?.toLowerCase() ||
          d.name?.toLowerCase() === user?.name?.toLowerCase()
        )
        if (match) setMyDoctorId(match.id)
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [filter, selectedUnit, showAllDates, myDoctorId])

  useEffect(() => {
    // Listen for real-time updates
    const cleanup1 = socketService.on('new_appointment', () => {
      loadAppointments()
    })
    const cleanup2 = socketService.on('appointment_cancelled', () => {
      loadAppointments()
    })
    const cleanup3 = socketService.on('appointment_updated', () => {
      loadAppointments()
    })
    return () => {
      cleanup1()
      cleanup2()
      cleanup3()
    }
  }, [filter, selectedUnit, showAllDates])

  const loadUnits = async () => {
    try {
      const response = await unitsAPI.getAll()
      setUnits(response.data)
    } catch (error) {
      console.error('Error loading units:', error)
    }
  }

  const loadAppointments = async () => {
    // For non-admin users, wait until doctor ID is resolved before loading
    if (!isAdmin && !myDoctorId) return
    try {
      const params: any = {}
      if (filter !== 'todos') params.status = filter
      if (selectedUnit) params.unit_id = selectedUnit
      if (!showAllDates) params.date = todayFormatted
      if (!isAdmin && myDoctorId) params.doctor_id = myDoctorId
      const response = await appointmentsAPI.getAll(params)
      setAppointments(response.data)
    } catch (error) {
      toast.error('Erro ao carregar agendamentos')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id: string, status: string, paidValue?: number) => {
    try {
      await appointmentsAPI.update(id, { status, paid_value: paidValue })
      toast.success(status === 'concluido' ? 'Agendamento concluido!' : 'Agendamento cancelado')
      loadAppointments()
    } catch (error) {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleConcluir = (apt: any) => {
    const value = prompt('Valor cobrado (R$):', apt.service_price?.toString() || '0')
    if (value !== null) {
      handleUpdateStatus(apt.id, 'concluido', parseFloat(value))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado': return '#1E88E5'
      case 'concluido': return '#4CAF50'
      case 'cancelado': return '#F44336'
      default: return '#666'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agendado': return 'Agendado'
      case 'concluido': return 'Concluido'
      case 'cancelado': return 'Cancelado'
      default: return status
    }
  }

  return (
    <div className="agenda-page">
      <div className="page-header">
        <h1><FiCalendar /> Agenda</h1>
        <div className="header-subtitle">
          {!showAllDates && <span>Exibindo: {todayFormatted}</span>}
          {showAllDates && <span>Exibindo: Todas as datas</span>}
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="agendado">Agendados</option>
            <option value="concluido">Concluidos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>

        <div className="filter-group">
          <label><FiMapPin /> Clinica:</label>
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
            <option value="">Todas as Clinicas</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </div>

        <button 
          className={`btn-toggle ${showAllDates ? 'active' : ''}`}
          onClick={() => setShowAllDates(!showAllDates)}
        >
          <FiCalendar /> {showAllDates ? 'Somente Hoje' : 'Todas as Datas'}
        </button>

        <button className="btn-refresh" onClick={() => loadAppointments()}>
          <FiRefreshCw /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : appointments.length === 0 ? (
        <div className="empty">
          <FiCalendar style={{ fontSize: 48, color: '#ccc' }} />
          <p>Nenhum agendamento encontrado</p>
          {!showAllDates && <small>Tente visualizar "Todas as Datas"</small>}
        </div>
      ) : (
        <>
          <div className="appointments-count">
            {appointments.length} agendamento(s) encontrado(s)
          </div>
          <div className="appointments-list">
            {appointments.map((apt) => (
              <div key={apt.id} className="appointment-card">
                <div className="apt-header">
                  <div className="apt-datetime">
                    <span className="apt-date">{apt.date}</span>
                    <span className="apt-time">{apt.time}</span>
                  </div>
                  <span className="apt-status" style={{ background: `${getStatusColor(apt.status)}15`, color: getStatusColor(apt.status), border: `1px solid ${getStatusColor(apt.status)}40` }}>
                    {getStatusLabel(apt.status)}
                  </span>
                </div>
                
                <div className="apt-body">
                  <div className="apt-info">
                    <strong>Paciente:</strong> {apt.user_name || 'N/A'}
                  </div>
                  <div className="apt-info">
                    <strong>CPF:</strong> {apt.user_cpf || 'N/A'}
                  </div>
                  <div className="apt-info">
                    <strong>Servico:</strong> {apt.service_name}
                  </div>
                  <div className="apt-info">
                    <strong>Doutor:</strong> {apt.doctor_name}
                  </div>
                  <div className="apt-info">
                    <strong>Unidade:</strong> {apt.unit_name}
                  </div>
                  {apt.notes && (
                    <div className="apt-info">
                      <strong>Obs:</strong> {apt.notes}
                    </div>
                  )}
                  {apt.status === 'concluido' && apt.paid_value > 0 && (
                    <div className="apt-info apt-value">
                      <strong>Valor:</strong> R$ {apt.paid_value.toFixed(2)}
                    </div>
                  )}
                </div>
                
                {apt.status === 'agendado' && (
                  <div className="apt-actions">
                    <button className="btn-success" onClick={() => handleConcluir(apt)}>
                      <FiCheck /> Concluir
                    </button>
                    <button className="btn-danger" onClick={() => handleUpdateStatus(apt.id, 'cancelado')}>
                      <FiX /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
