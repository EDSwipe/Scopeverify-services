import { useState } from 'react'
import type { Mission } from '../../types'
import MissionForm from './MissionForm'
import MissionsList from './MissionsList'
import './ClientDashboard.css'

interface ClientDashboardProps {
  userId: string
  userName?: string
}

export default function ClientDashboard({ userId, userName }: ClientDashboardProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingMission, setEditingMission] = useState<Mission | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleMissionSaved = () => {
    setShowForm(false)
    setEditingMission(null)
    setRefreshKey((prev) => prev + 1)
  }

  const handleEditMission = (mission: Mission) => {
    setEditingMission(mission)
    setShowForm(true)
  }

  return (
    <div className="client-dashboard">
      <header className="client-dash-header">
        <div>
          <h1>Tableau de bord client</h1>
          {userName && <p className="welcome-msg">Bienvenue, {userName} 👋</p>}
        </div>
        <button
          className="btn-new-mission"
          onClick={() => {
            setEditingMission(null)
            setShowForm(!showForm)
          }}
        >
          {showForm ? '✕ Fermer' : '+ Nouvelle mission'}
        </button>
      </header>

      {showForm && (
        <MissionForm
          clientId={userId}
          initialMission={editingMission || undefined}
          onSave={handleMissionSaved}
          onCancel={() => {
            setShowForm(false)
            setEditingMission(null)
          }}
        />
      )}

      <MissionsList
        key={refreshKey}
        clientId={userId}
        onEdit={handleEditMission}
      />
    </div>
  )
}
