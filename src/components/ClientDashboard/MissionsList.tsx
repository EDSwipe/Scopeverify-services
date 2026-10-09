import { useCallback, useEffect, useState } from 'react'
import type { Mission } from '../../types'
import type { MissionDocument } from '../../types'
import { missionTypeLabels, missionStatusLabels } from '../../types'
import { missions as missionAPI } from '../../lib/missions'
import { documents as documentsAPI } from '../../lib/missions'
import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../supabase'
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
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [missionDocuments, setMissionDocuments] = useState<MissionDocument[]>([])
  const [documentUrl, setDocumentUrl] = useState('')
  const [submittingMissionId, setSubmittingMissionId] = useState<string | null>(null)

  const loadMissions = useCallback(async () => {
    try {
      const data = await missionAPI.listClientMissions(clientId)
      // Show all of the client's own missions (draft, in progress, validated...)
      // so they can follow the status at every stage, not just the final result.
      setMissions(data)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void Promise.resolve().then(() => loadMissions())
  }, [loadMissions])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) return

    try {
      await missionAPI.deleteMission(id)
      setMissions((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de suppression')
    }
  }

  const handleSubmitMission = async (mission: Mission) => {
    if (!window.confirm('Envoyer cette demande à Scope-Verify ? Vous ne pourrez plus modifier le brouillon.')) return

    try {
      setSubmittingMissionId(mission.id)
      setError(null)
      const submittedMission = await missionAPI.submitMission(mission.id)
      setMissions((current) => current.map((item) => item.id === mission.id ? submittedMission : item))

      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          void fetch('/api/notify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ event: 'submitted', missionId: mission.id }),
          }).catch(() => {})
        }
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’envoyer la demande. Le brouillon est conservé.')
    } finally {
      setSubmittingMissionId(null)
    }
  }

  const showMissionDetails = async (mission: Mission) => {
    setSelectedMission(mission)
    setDocumentUrl('')
    try {
      setMissionDocuments(await documentsAPI.getDocumentsForMission(mission.id))
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible de charger les documents de la mission.')
    }
  }

  const openDocument = async (filePath: string) => {
    try {
      setDocumentUrl(await documentsAPI.getDocumentUrl(filePath))
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’ouvrir le document.')
    }
  }

  if (loading) return <div className="missions-list loading">Chargement...</div>
  if (error) return <div className="missions-list error">Erreur: {error}</div>
  if (missions.length === 0) return <div className="missions-list empty">Aucune mission pour le moment</div>

  const reportChecklist = selectedMission?.requirements?.collaborator_data?.checklist_results as
    | Record<string, { checked?: boolean; note?: string }>
    | undefined

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
              {mission.requested_deadline && <p><strong>Délai souhaité:</strong> {new Date(mission.requested_deadline).toLocaleDateString('fr-FR')}</p>}
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
                  <button type="button" onClick={() => void handleSubmitMission(mission)} className="btn-submit-mission" disabled={submittingMissionId === mission.id}>
                    {submittingMissionId === mission.id ? 'Envoi...' : 'Envoyer la demande'}
                  </button>
                  <button onClick={() => handleDelete(mission.id)} className="btn-delete">
                    Supprimer
                  </button>
                </>
              )}
              {mission.status !== 'draft' && <button className="btn-view" onClick={() => void showMissionDetails(mission)}>Voir détails</button>}
            </div>
          </article>
        ))}
      </div>
      {selectedMission && <div className="mission-detail-backdrop" role="presentation" onClick={() => setSelectedMission(null)}>
        <section className="mission-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="mission-detail-title" onClick={(event) => event.stopPropagation()}>
          <button className="mission-detail-close" aria-label="Fermer" onClick={() => setSelectedMission(null)}>×</button>
          <p className="mission-detail-kicker">{missionStatusLabels[selectedMission.status]} · {selectedMission.location}</p>
          <h2 id="mission-detail-title">{selectedMission.title}</h2>
          {selectedMission.requested_deadline && <p><strong>Délai souhaité :</strong> {new Date(selectedMission.requested_deadline).toLocaleDateString('fr-FR')}</p>}
          {selectedMission.description && <p>{selectedMission.description}</p>}
          {selectedMission.validation_notes && <p className="mission-detail-note"><strong>Retour de validation :</strong> {selectedMission.validation_notes}</p>}
          {selectedMission.requirements?.collaborator_data ? <div className="mission-report">
            <h3>Restitution</h3>
            {selectedMission.requirements.collaborator_data.observations && <p><strong>Observations :</strong> {selectedMission.requirements.collaborator_data.observations}</p>}
            {selectedMission.requirements.collaborator_data.results && <p><strong>Résultats :</strong> {selectedMission.requirements.collaborator_data.results}</p>}
            {selectedMission.requirements.collaborator_data.findings && <p><strong>Constats :</strong> {selectedMission.requirements.collaborator_data.findings}</p>}
            {selectedMission.requirements.collaborator_data.notes && <p><strong>Notes :</strong> {selectedMission.requirements.collaborator_data.notes}</p>}
            {reportChecklist && <ul>{Object.entries(reportChecklist).map(([item, result]) => <li key={item}>{result.checked ? 'Vérifié' : 'À vérifier'} · {item}{result.note && ` — ${result.note}`}</li>)}</ul>}
          </div> : <p className="mission-detail-muted">La restitution n’a pas encore été déposée.</p>}
          <div className="mission-report"><h3>Documents</h3>{missionDocuments.length ? <ul>{missionDocuments.map((document) => <li key={document.id}><button onClick={() => void openDocument(document.file_path)}>{document.file_name}</button></li>)}</ul> : <p>Aucun document transmis pour le moment.</p>}{documentUrl && <a href={documentUrl} target="_blank" rel="noreferrer">Ouvrir le document ↗</a>}</div>
        </section>
      </div>}
    </div>
  )
}
