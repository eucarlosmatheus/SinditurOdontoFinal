import React, { useState, useEffect } from 'react'
import { FiCalendar, FiDollarSign, FiUsers, FiPackage, FiTrendingUp } from 'react-icons/fi'
import { appointmentsAPI, financialAPI, patientsAPI, inventoryAPI } from '../services/api'
import socketService from '../services/socket'
import './Dashboard.css'

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayAppointments: 0,
    monthRevenue: 0,
    totalPatients: 0,
    lowStockItems: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()

    const cleanup1 = socketService.on('new_patient', () => loadStats())
    const cleanup2 = socketService.on('new_appointment', () => loadStats())
    const cleanup3 = socketService.on('appointment_cancelled', () => loadStats())
    const cleanup4 = socketService.on('appointment_updated', () => loadStats())

    return () => {
      cleanup1()
      cleanup2()
      cleanup3()
      cleanup4()
    }
  }, [])

  const loadStats = async () => {
    try {
      const today = new Date().toLocaleDateString('pt-BR')
      const [appointmentsRes, financialRes, patientsRes, inventoryRes] = await Promise.all([
        appointmentsAPI.getAll({ date: today }),
        financialAPI.getSummary(),
        patientsAPI.getAll(),
        inventoryAPI.getAll()
      ])
      
      const lowStock = inventoryRes.data.filter((item: any) => item.quantity <= item.min_quantity).length
      
      setStats({
        todayAppointments: appointmentsRes.data.length,
        monthRevenue: financialRes.data.total_revenue,
        totalPatients: patientsRes.data.length,
        lowStockItems: lowStock
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    { icon: FiCalendar, label: 'Agendamentos Hoje', value: stats.todayAppointments, color: '#1E88E5' },
    { icon: FiDollarSign, label: 'Receita do Mês', value: `R$ ${stats.monthRevenue.toFixed(2)}`, color: '#4CAF50' },
    { icon: FiUsers, label: 'Total de Pacientes', value: stats.totalPatients, color: '#9C27B0' },
    { icon: FiPackage, label: 'Itens em Baixa', value: stats.lowStockItems, color: stats.lowStockItems > 0 ? '#F44336' : '#4CAF50' },
  ]

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>
      
      <div className="stats-grid">
        {cards.map((card, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ background: `${card.color}20`, color: card.color }}>
              <card.icon />
            </div>
            <div className="stat-info">
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="welcome-card">
        <FiTrendingUp className="welcome-icon" />
        <div>
          <h2>Bem-vindo ao Painel de Gestão</h2>
          <p>Gerencie sua clínica odontológica de forma eficiente. Use o menu lateral para navegar entre as seções.</p>
        </div>
      </div>
    </div>
  )
}
