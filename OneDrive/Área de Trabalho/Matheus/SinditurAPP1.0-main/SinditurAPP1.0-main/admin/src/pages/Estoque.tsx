import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { FiPlus, FiMinus, FiPackage, FiFilter } from 'react-icons/fi'
import { inventoryAPI, doctorsAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import './Estoque.css'

export default function Estoque() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada')
  const [filterType, setFilterType] = useState('todos')
  
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, unit: 'unidade', min_quantity: 0 })
  const [newMovement, setNewMovement] = useState({ item_id: '', quantity: 1, notes: '' })

  // Encontrar o doutor correspondente ao usuário logado
  const [currentDoctor, setCurrentDoctor] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadMovements()
  }, [filterType])

  useEffect(() => {
    // Verificar se o usuário logado é um doutor
    if (user && doctors.length > 0) {
      const matchedDoctor = doctors.find(d => 
        d.email?.toLowerCase() === user.email?.toLowerCase() ||
        d.name?.toLowerCase() === user.name?.toLowerCase()
      )
      setCurrentDoctor(matchedDoctor)
    }
  }, [user, doctors])

  const loadData = async () => {
    try {
      const [itemsRes, doctorsRes] = await Promise.all([
        inventoryAPI.getAll(),
        doctorsAPI.getAll()
      ])
      setItems(itemsRes.data)
      setDoctors(doctorsRes.data)
      await loadMovements()
    } catch (error) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const loadMovements = async () => {
    try {
      const params: any = {}
      if (filterType !== 'todos') params.type = filterType
      const response = await inventoryAPI.getMovements(params)
      setMovements(response.data)
    } catch (error) {
      console.error(error)
    }
  }

  const handleAddItem = async () => {
    try {
      await inventoryAPI.create(newItem)
      toast.success('Item adicionado!')
      setShowAddModal(false)
      setNewItem({ name: '', quantity: 0, unit: 'unidade', min_quantity: 0 })
      loadData()
    } catch (error) {
      toast.error('Erro ao adicionar item')
    }
  }

  const handleMovement = async () => {
    if (!newMovement.item_id) {
      toast.warning('Selecione um item')
      return
    }

    try {
      // Para saída, usar automaticamente o doutor logado (se existir)
      const movementData: any = {
        item_id: newMovement.item_id,
        quantity: newMovement.quantity,
        type: movementType,
        notes: newMovement.notes
      }

      // Se for saída e o usuário atual for um doutor, usar os dados dele
      if (movementType === 'saida' && currentDoctor) {
        movementData.doctor_id = currentDoctor.id
      }

      await inventoryAPI.addMovement(movementData)
      toast.success(movementType === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!')
      setShowMovementModal(false)
      setNewMovement({ item_id: '', quantity: 1, notes: '' })
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao registrar movimento')
    }
  }

  const openMovementModal = (type: 'entrada' | 'saida') => {
    setMovementType(type)
    setNewMovement({ item_id: '', quantity: 1, notes: '' })
    setShowMovementModal(true)
  }

  return (
    <div className="estoque-page">
      <div className="page-header">
        <h1>Estoque</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <FiPlus /> Novo Item
          </button>
          <button className="btn-success" onClick={() => openMovementModal('entrada')}>
            <FiPlus /> Entrada
          </button>
          <button className="btn-warning" onClick={() => openMovementModal('saida')}>
            <FiMinus /> Saída
          </button>
        </div>
      </div>

      {/* Info do usuário logado */}
      {currentDoctor && (
        <div className="current-user-info">
          <span>Logado como: <strong>{currentDoctor.name}</strong> (CRO: {currentDoctor.cro})</span>
        </div>
      )}

      <div className="estoque-grid">
        <div className="estoque-section">
          <h2>Itens em Estoque</h2>
          {loading ? (
            <div className="loading">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="empty">Nenhum item cadastrado</div>
          ) : (
            <div className="items-list">
              {items.filter((item: any) => item.quantity > 0).map((item: any) => (
                <div key={item.id} className={`item-card ${item.quantity <= item.min_quantity ? 'low-stock' : ''}`}>
                  <div className="item-icon">
                    <FiPackage />
                  </div>
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-quantity">
                      {item.quantity} {item.unit}(s)
                    </span>
                  </div>
                  {item.quantity <= item.min_quantity && (
                    <span className="low-badge">Baixo</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="estoque-section">
          <div className="section-header">
            <h2>Histórico de Movimentações</h2>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </select>
          </div>
          
          {movements.length === 0 ? (
            <div className="empty">Nenhuma movimentação</div>
          ) : (
            <div className="movements-list">
              {movements.map((mov) => (
                <div key={mov.id} className={`movement-item ${mov.type}`}>
                  <div className="mov-icon">
                    {mov.type === 'entrada' ? <FiPlus /> : <FiMinus />}
                  </div>
                  <div className="mov-info">
                    <span className="mov-item">{mov.item_name}</span>
                    <span className="mov-details">
                      {mov.quantity} un - {mov.doctor_name || mov.created_by}
                    </span>
                    {mov.notes && <span className="mov-notes">{mov.notes}</span>}
                  </div>
                  <span className="mov-date">
                    {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Novo Item</h3>
            <div className="form-group">
              <label>Nome do Item</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantidade Inicial</label>
                <input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Unidade</label>
                <select
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                >
                  <option value="unidade">Unidade</option>
                  <option value="caixa">Caixa</option>
                  <option value="pacote">Pacote</option>
                  <option value="frasco">Frasco</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Quantidade Mínima (alerta)</label>
              <input
                type="number"
                value={newItem.min_quantity}
                onChange={(e) => setNewItem({ ...newItem, min_quantity: Number(e.target.value) })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAddItem}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{movementType === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}</h3>
            
            {/* Mostrar info do doutor logado para saídas */}
            {movementType === 'saida' && currentDoctor && (
              <div className="doctor-info-box">
                <span>Retirada será registrada para:</span>
                <strong>{currentDoctor.name} - CRO: {currentDoctor.cro}</strong>
              </div>
            )}

            {movementType === 'saida' && !currentDoctor && (
              <div className="doctor-info-box warning">
                <span>Você não está cadastrado como doutor.</span>
                <span>A retirada será registrada com seu nome de usuário.</span>
              </div>
            )}

            <div className="form-group">
              <label>Item *</label>
              <select
                value={newMovement.item_id}
                onChange={(e) => setNewMovement({ ...newMovement, item_id: e.target.value })}
              >
                <option value="">Selecione um item</option>
                {items.filter((item: any) => item.quantity > 0).map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.quantity} {item.unit}s disponíveis)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantidade *</label>
              <input
                type="number"
                min="1"
                value={newMovement.quantity}
                onChange={(e) => setNewMovement({ ...newMovement, quantity: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Observações</label>
              <input
                type="text"
                placeholder="Motivo da retirada, procedimento, etc."
                value={newMovement.notes}
                onChange={(e) => setNewMovement({ ...newMovement, notes: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowMovementModal(false)}>Cancelar</button>
              <button className={movementType === 'entrada' ? 'btn-success' : 'btn-warning'} onClick={handleMovement}>
                {movementType === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
