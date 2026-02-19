import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiCamera } from 'react-icons/fi'
import { staffAPI, doctorsAPI, unitsAPI } from '../services/api'
import './Equipe.css'

export default function Equipe() {
  const [staff, setStaff] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<any>(null)
  const [editingDoctor, setEditingDoctor] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'receptionist',
    permissions: [] as string[],
    unit_id: ''
  })
  const [doctorFormData, setDoctorFormData] = useState({
    name: '',
    specialty: '',
    unit_id: '',
    cro: '',
    phone: '',
    email: '',
    bio: '',
    photo_base64: '',
    available_days: [] as string[]
  })

  const roles: any = {
    admin: 'Administrador',
    manager: 'Gerente',
    receptionist: 'Recepcionista',
    doctor: 'Doutor'
  }

  const allPermissions = [
    { key: 'agenda', label: 'Agenda' },
    { key: 'financeiro', label: 'Financeiro' },
    { key: 'estoque', label: 'Estoque' },
    { key: 'pacientes', label: 'Pacientes' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'equipe', label: 'Equipe' },
    { key: 'configuracoes', label: 'Configurações' }
  ]

  const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [staffRes, doctorsRes, unitsRes] = await Promise.all([
        staffAPI.getAll(),
        doctorsAPI.getAll(),
        unitsAPI.getAll()
      ])
      setStaff(staffRes.data)
      setDoctors(doctorsRes.data)
      setUnits(unitsRes.data)
    } catch (error) {
      toast.error('Erro ao carregar equipe')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (staffMember?: any) => {
    if (staffMember) {
      setEditingStaff(staffMember)
      setFormData({
        name: staffMember.name,
        email: staffMember.email,
        password: '',
        role: staffMember.role,
        permissions: staffMember.permissions,
        unit_id: staffMember.unit_id || ''
      })
    } else {
      setEditingStaff(null)
      setFormData({ name: '', email: '', password: '', role: 'receptionist', permissions: [], unit_id: '' })
    }
    setShowModal(true)
  }

  const openDoctorModal = (doctor?: any) => {
    if (doctor) {
      setEditingDoctor(doctor)
      setDoctorFormData({
        name: doctor.name,
        specialty: doctor.specialty,
        unit_id: doctor.unit_id,
        cro: doctor.cro || '',
        phone: doctor.phone || '',
        email: doctor.email || '',
        bio: doctor.bio || '',
        photo_base64: doctor.photo_base64 || '',
        available_days: doctor.available_days || []
      })
    } else {
      setEditingDoctor(null)
      setDoctorFormData({
        name: '', specialty: '', unit_id: '', cro: '', phone: '', email: '', bio: '', photo_base64: '', available_days: []
      })
    }
    setShowDoctorModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || (!editingStaff && !formData.password)) {
      toast.warning('Preencha todos os campos obrigatórios')
      return
    }

    try {
      if (editingStaff) {
        const updateData: any = { ...formData }
        if (!updateData.password) delete updateData.password
        await staffAPI.update(editingStaff.id, updateData)
        toast.success('Colaborador atualizado!')
      } else {
        await staffAPI.create(formData)
        toast.success('Colaborador adicionado!')
      }
      setShowModal(false)
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar')
    }
  }

  const handleDoctorSubmit = async () => {
    if (!doctorFormData.name || !doctorFormData.specialty || !doctorFormData.unit_id || !doctorFormData.cro) {
      toast.warning('Preencha todos os campos obrigatórios')
      return
    }

    // Validar foto obrigatória
    if (!doctorFormData.photo_base64) {
      toast.warning('A foto do doutor é obrigatória!')
      return
    }

    try {
      if (editingDoctor) {
        await doctorsAPI.update(editingDoctor.id, doctorFormData)
        toast.success('Doutor atualizado! A foto será exibida no app.')
      } else {
        await doctorsAPI.create(doctorFormData)
        toast.success('Doutor adicionado! A foto será exibida no app.')
      }
      setShowDoctorModal(false)
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este colaborador?')) return
    
    try {
      await staffAPI.delete(id)
      toast.success('Colaborador removido!')
      loadData()
    } catch (error) {
      toast.error('Erro ao remover colaborador')
    }
  }

  const handleDeleteDoctor = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este doutor?')) return
    
    try {
      await doctorsAPI.delete(id)
      toast.success('Doutor removido!')
      loadData()
    } catch (error) {
      toast.error('Erro ao remover doutor')
    }
  }

  const togglePermission = (perm: string) => {
    const perms = formData.permissions.includes(perm)
      ? formData.permissions.filter(p => p !== perm)
      : [...formData.permissions, perm]
    setFormData({ ...formData, permissions: perms })
  }

  const toggleDay = (day: string) => {
    const days = doctorFormData.available_days.includes(day)
      ? doctorFormData.available_days.filter(d => d !== day)
      : [...doctorFormData.available_days, day]
    setDoctorFormData({ ...doctorFormData, available_days: days })
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.warning('A foto deve ter no máximo 2MB')
        return
      }
      
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        setDoctorFormData({ ...doctorFormData, photo_base64: base64 })
      }
      reader.readAsDataURL(file)
    }
  }

  const getUnitName = (unitId: string) => {
    const unit = units.find(u => u.id === unitId)
    return unit?.name || 'N/A'
  }

  return (
    <div className="equipe-page">
      <div className="page-header">
        <h1>Equipe</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => openModal()}>
            <FiPlus /> Novo Colaborador
          </button>
          <button className="btn-success" onClick={() => openDoctorModal()}>
            <FiPlus /> Novo Doutor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <>
          {/* Colaboradores */}
          <div className="section-title">Colaboradores</div>
          {staff.length === 0 ? (
            <div className="empty">Nenhum colaborador cadastrado</div>
          ) : (
            <div className="staff-grid">
              {staff.map((member) => (
                <div key={member.id} className="staff-card">
                  <div className="staff-avatar">
                    <FiUserCheck />
                  </div>
                  <div className="staff-info">
                    <span className="staff-name">{member.name}</span>
                    <span className="staff-email">{member.email}</span>
                    <span className="staff-role">{roles[member.role]}</span>
                    {member.unit_id && <span className="staff-unit">{getUnitName(member.unit_id)}</span>}
                  </div>
                  <span className={`staff-status ${member.active ? 'active' : 'inactive'}`}>
                    {member.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <div className="staff-actions">
                    <button onClick={() => openModal(member)}><FiEdit2 /></button>
                    <button onClick={() => handleDelete(member.id)}><FiTrash2 /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Doutores */}
          <div className="section-title" style={{ marginTop: 32 }}>Doutores</div>
          {doctors.length === 0 ? (
            <div className="empty">Nenhum doutor cadastrado</div>
          ) : (
            <div className="doctors-grid">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="doctor-card">
                  <div className="doctor-photo">
                    {doctor.photo_base64 ? (
                      <img src={`data:image/jpeg;base64,${doctor.photo_base64}`} alt={doctor.name} />
                    ) : (
                      <div className="no-photo">
                        <FiCamera />
                        <span>Sem foto</span>
                      </div>
                    )}
                  </div>
                  <div className="doctor-info">
                    <span className="doctor-name">{doctor.name}</span>
                    <span className="doctor-specialty">{doctor.specialty}</span>
                    <span className="doctor-cro">CRO: {doctor.cro}</span>
                    <span className="doctor-unit">{getUnitName(doctor.unit_id)}</span>
                  </div>
                  <div className="doctor-actions">
                    <button onClick={() => openDoctorModal(doctor)}><FiEdit2 /></button>
                    <button onClick={() => handleDeleteDoctor(doctor.id)}><FiTrash2 /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Colaborador */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingStaff ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
            
            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            
            <div className="form-group">
              <label>{editingStaff ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            
            <div className="form-group">
              <label>Função</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                {Object.entries(roles).map(([key, label]) => (
                  <option key={key} value={key}>{label as string}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Clínica</label>
              <select
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              >
                <option value="">Nenhuma (todas)</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Permissões</label>
              <div className="permissions-grid">
                {allPermissions.map((perm) => (
                  <label key={perm.key} className="permission-item">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm.key) || formData.permissions.includes('all')}
                      onChange={() => togglePermission(perm.key)}
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSubmit}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Doutor */}
      {showDoctorModal && (
        <div className="modal-overlay">
          <div className="modal doctor-modal">
            <h3>{editingDoctor ? 'Editar Doutor' : 'Novo Doutor'}</h3>
            
            {/* Upload de Foto */}
            <div className="photo-upload-section">
              <div className="photo-preview">
                {doctorFormData.photo_base64 ? (
                  <img src={`data:image/jpeg;base64,${doctorFormData.photo_base64}`} alt="Preview" />
                ) : (
                  <div className="photo-placeholder">
                    <FiCamera />
                    <span>Foto obrigatória</span>
                  </div>
                )}
              </div>
              <div className="photo-upload-btn">
                <label className="btn-primary">
                  <FiCamera /> {doctorFormData.photo_base64 ? 'Alterar Foto' : 'Selecionar Foto *'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
                <span className="photo-hint">A foto aparecerá no app dos pacientes</span>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Nome *</label>
                <input type="text" value={doctorFormData.name} onChange={(e) => setDoctorFormData({ ...doctorFormData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Especialidade *</label>
                <input type="text" value={doctorFormData.specialty} onChange={(e) => setDoctorFormData({ ...doctorFormData, specialty: e.target.value })} />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>CRO *</label>
                <input type="text" value={doctorFormData.cro} onChange={(e) => setDoctorFormData({ ...doctorFormData, cro: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Unidade *</label>
                <select value={doctorFormData.unit_id} onChange={(e) => setDoctorFormData({ ...doctorFormData, unit_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {units.map((unit) => (<option key={unit.id} value={unit.id}>{unit.name}</option>))}
                </select>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Telefone</label>
                <input type="text" value={doctorFormData.phone} onChange={(e) => setDoctorFormData({ ...doctorFormData, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={doctorFormData.email} onChange={(e) => setDoctorFormData({ ...doctorFormData, email: e.target.value })} />
              </div>
            </div>
            
            <div className="form-group">
              <label>Bio</label>
              <textarea value={doctorFormData.bio} onChange={(e) => setDoctorFormData({ ...doctorFormData, bio: e.target.value })} rows={2} />
            </div>
            
            <div className="form-group">
              <label>Dias Disponíveis</label>
              <div className="days-grid">
                {weekDays.map((day) => (
                  <label key={day} className="day-item">
                    <input type="checkbox" checked={doctorFormData.available_days.includes(day)} onChange={() => toggleDay(day)} />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDoctorModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleDoctorSubmit}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
