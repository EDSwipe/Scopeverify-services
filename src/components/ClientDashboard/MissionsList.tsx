import { useEffect, useState } from 'react'
import type { Mission } from '../../types'
import { missionTypeLabels, missionStatusLabels } from '../../types'
import { missions as missionAPI } from '../../lib/missions'
import { getErrorMessage } from '../../lib/errors'
import './MissionsList.css'

interface MissionsListProps {
  clientId: string
  onEdit?: (mission: Mission) => void
}

const validationStatusLabels: Record<string, string> = {
  pending: '⏳ En attente de validation',
  validated: '✓ Validé',
  rejected: '✗ Rejeté',
}

export default function MissionsList({ clientId, onEdit }: MissionsListProps) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMissions()
  }, [clientId])

  const loadMissions = async () => {
    try {
      setLoading(true)
      const data = await missionAPI.listClientMissions(clientId)
      // Show all of the client's own missions (draft, in progress, validated...)
      // so they can follow the status at every stage, not just the final result.
      setMissions(data)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) return

    try {
      await missionAPI.deleteMission(id)
      setMissions((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de suppression')
    }
  }

  if (loading) return <div className="missions-list loading">Chargement...</div>
  if (error) return <div className="missions-list error">Erreur: {error}</div>
  if (missions.length === 0) return <div className="missions-list empty">Aucune mission pour le moment</div>

  return (
    <div className="missions-list">
      <div className="missions-header">
        <h3>Mes missions ({missions.length})</h3>
      </div>
      <div className="missions-grid">
        {missions.map((mission) => (
          <article key={mission.id} className={`mission-card status-${mission.status}`}>
            <div className="mission-header">
              <h4>{mission.title}</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="mission-status">{missionStatusLabels[mission.status]}</span>
                {mission.status === 'completed' && mission.validation_status !== 'validated' && (
                  <span
                    className={`validation-badge validation-${mission.validation_status || 'pending'}`}
                  >
                    {validationStatusLabels[mission.validation_status || 'pending']}
                  </span>
                )}
                {mission.validation_status === 'validated' && (
                  <span className="validation-badge validation-validated">
                    {validationStatusLabels.validated}
                  </span>
                )}
              </div>
            </div>

            <p className="mission-type">{missionTypeLabels[mission.mission_type].fr}</p>

            <div className="mission-details">
              <p>
                <strong>Lieu:</strong> {mission.location}
              </p>
              {mission.budget && (
                <p>
                  <strong>Budget:</strong> {mission.budget}
                </p>
              )}
              {mission.description && <p className="mission-description">{mission.description}</p>}
            </div>

            <div className="mission-footer">
              <p className="mission-date">
                Créée le {new Date(mission.created_at).toLocaleDateString('fr-FR')}
              </p>
              {mission.assigned_to && <p className="mission-assigned">✓ Assignée</p>}
            </div>

            <div className="mission-actions">
              {mission.status === 'draft' && (
                <>
                  <button onClick={() => onEdit?.(mission)} className="btn-edit">
                    Modifier
                  </button>
                  <button onClick={() => handleDelete(mission.id)} className="btn-delete">
                    Supprimer
                  </button>
                </>
              )}
              {mission.status !== 'draft' && <button className="btn-view">Voir détails</button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
