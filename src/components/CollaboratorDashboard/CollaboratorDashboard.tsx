import { useEffect, useState } from 'react'
import type { Mission } from '../../types'
import { missionTypeLabels, missionStatusLabels } from '../../types'
import { missions as missionAPI, documents } from '../../lib/missions'
import { supabase } from '../../supabase'
import { getErrorMessage } from '../../lib/errors'
import './CollaboratorDashboard.css'
// CACHE BUST FORCE 2024-09-20-15-10 - MODIFICATIONS COLLABORATOR DASHBOARD

interface CollaboratorDashboardProps {
  userId: string
  userName?: string
}

const validationStatusLabels: Record<string, string> = {
  pending: '⏳ En attente de validation',
  validated: '✓ Validé',
  rejected: '✗ Rejeté',
}

export default function CollaboratorDashboard({ userId, userName }: CollaboratorDashboardProps) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards')
  
  // Form states for mission details
  const [formData, setFormData] = useState({
    observations: '',
    results: '',
    notes: '',
    findings: '',
    photos: [] as Array<{ path: string; name: string; url?: string }> // Array of photo objects with storage paths
  })

  // Guided step-by-step wizard: one step per checklist item defined by the
  // client, then observations/results/findings/notes/photos, then a review step.
  const [wizardStep, setWizardStep] = useState(0)
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, { checked: boolean; note: string }>>({})

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)
      const missionsData = await missionAPI.listCollaboratorMissions(userId)
      setMissions(missionsData)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // Notifies the admin of a mission lifecycle event (best-effort, non-blocking).
  const notifyAdminEvent = (missionTitle: string, event: 'accepted' | 'started' | 'completed') => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      fetch('/api/notify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        body: JSON.stringify({ missionTitle, collaboratorName: userName || 'Un collaborateur', event }),
      }).catch(() => {})
    })
  }

  // Notifies the client of a mission lifecycle event (best-effort, non-blocking).
  const notifyClientEvent = (mission: Mission, event: 'started') => {
    if (!supabase) return
    supabase
      .from('users')
      .select('email, full_name')
      .eq('id', mission.client_id)
      .single()
      .then(({ data }) => {
        if (!data?.email || !supabase) return
        supabase.auth.getSession().then(({ data: sessionData }) => {
          fetch('/api/notify-client', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(sessionData.session?.access_token
                ? { Authorization: `Bearer ${sessionData.session.access_token}` }
                : {}),
            },
            body: JSON.stringify({
              clientEmail: data.email,
              clientName: data.full_name,
              missionTitle: mission.title,
              event,
            }),
          }).catch(() => {})
        })
      })
  }

  const handleAcceptMission = async (mission: Mission) => {
    if (!supabase || isUpdating) return
    try {
      setIsUpdating(true)
      setError(null)
      await missionAPI.updateMission(mission.id, { status: 'accepted' })
      setMissions((prev) => prev.map((m) => (m.id === mission.id ? { ...m, status: 'accepted' } : m)))
      notifyAdminEvent(mission.title, 'accepted')
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStartMission = async (mission: Mission) => {
    if (!supabase || isUpdating) return
    try {
      setIsUpdating(true)
      setError(null)
      await missionAPI.updateMission(mission.id, { status: 'in_progress' })
      setMissions((prev) => prev.map((m) => (m.id === mission.id ? { ...m, status: 'in_progress' } : m)))
      notifyAdminEvent(mission.title, 'started')
      notifyClientEvent(mission, 'started')
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour')
    } finally {
      setIsUpdating(false)
    }
  }

  // Closes the mission and submits it for admin review. The database also
  // resets validation_status to 'pending' automatically (see security_hardening.sql),
  // this client-side value is only used for optimistic UI update.
  const handleCompleteMission = async () => {
    if (!supabase || !selectedMission || isUpdating) return

    if (!formData.observations.trim() || !formData.results.trim()) {
      setError('Veuillez remplir au moins les observations et les résultats avant de clôturer la mission.')
      return
    }

    try {
      setIsUpdating(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('missions')
        .update({
          status: 'completed',
          requirements: {
            ...(selectedMission.requirements || {}),
            collaborator_data: {
              observations: formData.observations,
              results: formData.results,
              notes: formData.notes,
              findings: formData.findings,
              photos: formData.photos,
              checklist_results: checklistAnswers,
              filled_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', selectedMission.id)

      if (updateError) throw updateError

      setMissions((prev) =>
        prev.map((m) =>
          m.id === selectedMission.id
            ? { ...m, status: 'completed', validation_status: 'pending', validation_notes: undefined }
            : m,
        ),
      )
      setSelectedMission(null)

      // Notify the admin that a mission is ready for review (best-effort, non-blocking)
      supabase.auth.getSession().then(({ data }) => {
        fetch('/api/notify-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
          },
          body: JSON.stringify({
            missionTitle: selectedMission.title,
            collaboratorName: userName || 'Un collaborateur',
            event: 'completed',
          }),
        }).catch(() => {})
      })

      alert('✅ Mission clôturée et soumise pour validation à l\'administrateur !')
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de la clôture de la mission')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveMissionDetails = async () => {
    if (!supabase || !selectedMission || isUpdating) return

    try {
      setIsUpdating(true)
      setError(null)

      // Save mission details (observations, results, notes, findings, photos) as a JSON field
      const { error: updateError } = await supabase
        .from('missions')
        .update({
          requirements: {
            ...(selectedMission.requirements || {}),
            collaborator_data: {
              observations: formData.observations,
              results: formData.results,
              notes: formData.notes,
              findings: formData.findings,
              photos: formData.photos,
              checklist_results: checklistAnswers,
              filled_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', selectedMission.id)

      if (updateError) throw updateError

      alert('✅ Informations et photos enregistrées avec succès !')
      setFormData({ observations: '', results: '', notes: '', findings: '', photos: [] })
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de l\'enregistrement')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSelectMission = (mission: Mission) => {
    setSelectedMission(mission)
    setWizardStep(0)

    const checklist: string[] = Array.isArray(mission.requirements?.checklist)
      ? mission.requirements!.checklist
      : []
    const savedChecklistResults = mission.requirements?.collaborator_data?.checklist_results || {}
    const hydratedChecklist: Record<string, { checked: boolean; note: string }> = {}
    checklist.forEach((item) => {
      hydratedChecklist[item] = savedChecklistResults[item] || { checked: false, note: '' }
    })
    setChecklistAnswers(hydratedChecklist)

    // Load existing data if available
    if (mission.requirements?.collaborator_data) {
      setFormData({
        observations: mission.requirements.collaborator_data.observations || '',
        results: mission.requirements.collaborator_data.results || '',
        notes: mission.requirements.collaborator_data.notes || '',
        findings: mission.requirements.collaborator_data.findings || '',
        // Handle both old base64 format and new storage format
        photos: Array.isArray(mission.requirements.collaborator_data.photos)
          ? mission.requirements.collaborator_data.photos.map((photo: any) =>
              typeof photo === 'string'
                ? { path: photo, name: 'photo', url: photo }
                : photo
            )
          : [],
      })
    } else {
      setFormData({ observations: '', results: '', notes: '', findings: '', photos: [] })
    }
  }

  const handleAddPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !selectedMission || !supabase) return

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // Limit file size to 5MB (increased from 2MB for better quality)
        if (file.size > 5 * 1024 * 1024) {
          setError('Photo trop grande (max 5MB)')
          continue
        }

        setIsUpdating(true)
        try {
          // Upload to Supabase Storage
          const fileName = `${selectedMission.id}/${Date.now()}_${file.name}`
          const { error: uploadError } = await supabase.storage
            .from('mission-documents')
            .upload(fileName, file)

          if (uploadError) {
            throw uploadError
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('mission-documents')
            .getPublicUrl(fileName)

          setFormData((prev) => ({
            ...prev,
            photos: [...prev.photos, { path: fileName, name: file.name, url: urlData.publicUrl }],
          }))
        } catch (uploadErr) {
          setError(`Erreur lors de l'upload: ${getErrorMessage(uploadErr)}`)
        } finally {
          setIsUpdating(false)
        }
      }
    } catch (err) {
      setError('Erreur lors de la lecture de la photo')
    }
  }

  const handleRemovePhoto = async (index: number) => {
    const photoToRemove = formData.photos[index]
    if (!photoToRemove || !supabase) {
      setFormData((prev) => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index),
      }))
      return
    }

    try {
      // Delete from Supabase Storage
      const { error: deleteError } = await supabase.storage
        .from('mission-documents')
        .remove([photoToRemove.path])

      if (deleteError) {
        console.error('Error deleting photo from storage:', deleteError)
        // Continue with local removal even if storage deletion fails
      }
    } catch (err) {
      console.error('Error deleting photo:', err)
    }

    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }))
  }

  if (loading) return <div className="collab-loading">Chargement...</div>

  const isMissionLocked = selectedMission ? selectedMission.status === 'completed' : false

  const checklist: string[] = Array.isArray(selectedMission?.requirements?.checklist)
    ? (selectedMission!.requirements!.checklist as string[])
    : []

  type WizardStepDef =
    | { kind: 'checklist'; item: string }
    | { kind: 'observations' | 'results' | 'findings' | 'notes' | 'photos' | 'review' }

  const wizardSteps: WizardStepDef[] = [
    ...checklist.map((item): WizardStepDef => ({ kind: 'checklist', item })),
    { kind: 'observations' },
    { kind: 'results' },
    { kind: 'findings' },
    { kind: 'notes' },
    { kind: 'photos' },
    { kind: 'review' },
  ]

  const currentStepIndex = Math.min(wizardStep, wizardSteps.length - 1)
  const currentStep = wizardSteps[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === wizardSteps.length - 1

  const goToNextStep = () => setWizardStep((s) => Math.min(s + 1, wizardSteps.length - 1))
  const goToPreviousStep = () => setWizardStep((s) => Math.max(s - 1, 0))

  return (
    <div className="collaborator-dashboard">
      <header className="collab-dash-header">
        <div>
          <h1>Mes missions</h1>
          {userName && <p className="collab-welcome">Bienvenue, {userName} 👋</p>}
        </div>
        <button onClick={() => loadData()} className="btn-refresh" title="Recharger les dernières données">
          🔄 Actualiser
        </button>
      </header>

      {error && <p className="collab-error">{error}</p>}

      <div className="collab-missions">
        <div className="missions-summary">
          <div className="summary-card">
            <strong>{missions.length}</strong>
            <span>Missions assignées</span>
          </div>
          <div className="summary-card">
            <strong>{missions.filter((m) => m.status === 'in_progress').length}</strong>
            <span>En cours</span>
          </div>
          <div className="summary-card">
            <strong>{missions.filter((m) => m.status === 'completed').length}</strong>
            <span>Complétées</span>
          </div>
          <div className="summary-card">
            <strong>{missions.filter((m) => m.validation_status === 'validated').length}</strong>
            <span>Validées</span>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: viewMode === 'list' ? '#ae8339' : '#e8e5d8',
              color: viewMode === 'list' ? 'white' : '#171819',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '0.5rem',
              fontWeight: 'bold'
            }}
          >
            📋 Vue Liste
          </button>
          <button
            onClick={() => setViewMode('cards')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: viewMode === 'cards' ? '#ae8339' : '#e8e5d8',
              color: viewMode === 'cards' ? 'white' : '#171819',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📇 Vue Cartes
          </button>
        </div>

        <div className="missions-list">
          {missions.length === 0 ? (
            <p className="no-missions">Aucune mission assignée pour le moment</p>
          ) : viewMode === 'list' ? (
            missions.map((mission) => (
              <article key={mission.id} className={`mission-item status-${mission.status}`}>
                <div className="mission-header">
                  <div>
                    <h3>{mission.title}</h3>
                    <p style={{ fontSize: '0.9rem', color: '#65696a', marginTop: '0.3rem' }}>
                      {missionTypeLabels[mission.mission_type].fr}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="status-badge">{missionStatusLabels[mission.status]}</span>
                    <span
                      className={`validation-badge validation-${mission.validation_status || 'pending'}`}
                    >
                      {validationStatusLabels[mission.validation_status || 'pending']}
                    </span>
                  </div>
                </div>

                {mission.validation_status === 'rejected' && mission.validation_notes && (
                  <div
                    style={{
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      color: '#856404',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      marginBottom: '1rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    <strong>⚠️ Rejeté</strong>
                    <p style={{ marginTop: '0.3rem' }}>{mission.validation_notes}</p>
                  </div>
                )}

                <div className="mission-info">
                  <p>
                    <strong>Lieu:</strong> {mission.location}
                  </p>
                  {mission.description && <p className="description">{mission.description}</p>}
                </div>

                <div className="mission-status-controls">
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>
                    <strong>Statut actuel:</strong> {missionStatusLabels[mission.status]}
                  </p>

                  {(mission.status === 'draft' || mission.status === 'submitted') && (
                    <button
                      onClick={() => handleAcceptMission(mission)}
                      disabled={isUpdating}
                      className="btn-status-action"
                    >
                      ✓ Accepter la mission
                    </button>
                  )}

                  {mission.status === 'accepted' && (
                    <button
                      onClick={() => handleStartMission(mission)}
                      disabled={isUpdating}
                      className="btn-status-action"
                    >
                      ▶️ Démarrer (Mettre en cours)
                    </button>
                  )}

                  {mission.status === 'in_progress' && (
                    <p style={{ fontSize: '0.85rem', color: '#65696a' }}>
                      ➡️ Ouvrez "Voir les détails" pour remplir votre rapport et clôturer la mission.
                    </p>
                  )}

                  {mission.status === 'completed' && mission.validation_status === 'pending' && (
                    <p style={{ fontSize: '0.85rem', color: '#ae8339' }}>
                      🔒 Mission clôturée, en attente de validation admin. Vous ne pouvez plus la modifier.
                    </p>
                  )}
                  {mission.status === 'completed' && mission.validation_status === 'validated' && (
                    <p style={{ fontSize: '0.85rem', color: '#28a745' }}>
                      ✓ Mission validée et transmise au client. Vous ne pouvez plus la modifier.
                    </p>
                  )}
                  {mission.status === 'completed' && mission.validation_status === 'rejected' && (
                    <p style={{ fontSize: '0.85rem', color: '#dc3545' }}>
                      ✗ Corrections demandées — voir la raison ci-dessus.
                    </p>
                  )}
                </div>

                <button
                  className="btn-view-details"
                  onClick={() => handleSelectMission(mission)}
                >
                  Voir les détails
                </button>
              </article>
            ))
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {missions.map((mission) => (
                <div
                  key={mission.id}
                  style={{
                    border: '1px solid #c9c4b9',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    backgroundColor: 'white',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <h3 style={{ margin: '0 0 1rem 0', color: '#171819' }}>{mission.title}</h3>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Type:</strong> {missionTypeLabels[mission.mission_type].fr}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Statut:</strong> {missionStatusLabels[mission.status]}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Validation:</strong> {validationStatusLabels[mission.validation_status || 'pending']}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Lieu:</strong> {mission.location}
                  </div>
                  {mission.description && (
                    <div style={{ marginBottom: '1rem', color: '#65696a', fontSize: '0.9rem', lineHeight: '1.4' }}>
                      {mission.description.substring(0, 150)}{mission.description.length > 150 ? '...' : ''}
                    </div>
                  )}

                  {mission.validation_status === 'rejected' && mission.validation_notes && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.85rem' }}>
                      <strong>⚠️ Rejeté:</strong> {mission.validation_notes}
                    </div>
                  )}

                  {mission.requirements?.collaborator_data && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '0.85rem' }}>
                      <strong>📝 Informations recueillies:</strong>
                      {mission.requirements.collaborator_data.observations && (
                        <div style={{ marginTop: '0.3rem' }}>
                          <strong>Observations:</strong> {mission.requirements.collaborator_data.observations.substring(0, 100)}...
                        </div>
                      )}
                      {mission.requirements.collaborator_data.photos && mission.requirements.collaborator_data.photos.length > 0 && (
                        <div style={{ marginTop: '0.3rem' }}>
                          <strong>Photos:</strong> {mission.requirements.collaborator_data.photos.length}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    <button
                      onClick={() => handleSelectMission(mission)}
                      style={{
                        backgroundColor: '#ae8339',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.9rem'
                      }}
                    >
                      👁️ Voir détails
                    </button>
                    {mission.status === 'in_progress' || (mission.status === 'completed' && mission.validation_status === 'rejected') ? (
                      <button
                        onClick={() => handleSelectMission(mission)}
                        style={{
                          backgroundColor: '#171819',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '0.9rem'
                        }}
                      >
                        ✏️ Modifier
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedMission && (
        <div className="mission-detail-modal">
          <div className="modal-overlay" onClick={() => setSelectedMission(null)} />
          <div className="modal-content">
            <button className="btn-close" onClick={() => setSelectedMission(null)}>
              ✕
            </button>

            <h2>{selectedMission.title}</h2>

            <div className="detail-section">
              <h4>📋 Informations générales</h4>
              <p>
                <strong>Type:</strong> {missionTypeLabels[selectedMission.mission_type].fr}
              </p>
              <p>
                <strong>Lieu:</strong> {selectedMission.location}
              </p>
              <p>
                <strong>Statut:</strong> {missionStatusLabels[selectedMission.status]}
              </p>
              {selectedMission.budget && (
                <p>
                  <strong>Budget:</strong> {selectedMission.budget}
                </p>
              )}
            </div>

            {selectedMission.description && (
              <div className="detail-section">
                <h4>📝 Description</h4>
                <p>{selectedMission.description}</p>
              </div>
            )}

            {selectedMission.requirements &&
              Object.keys(selectedMission.requirements).filter((k) => k !== 'checklist' && k !== 'collaborator_data')
                .length > 0 && (
                <div className="detail-section">
                  <h4>Exigences complémentaires</h4>
                  <pre style={{ fontSize: '0.85rem', background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px' }}>
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(selectedMission.requirements).filter(
                          ([k]) => k !== 'checklist' && k !== 'collaborator_data',
                        ),
                      ),
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}

            {/* Guided step-by-step wizard for the collaborator's field report */}
            <div className="detail-section mission-form">
              <div className="wizard-header">
                <h4>📝 Remplir les informations de la mission</h4>
                <span className="wizard-progress">
                  Étape {currentStepIndex + 1} / {wizardSteps.length}
                </span>
              </div>

              {isMissionLocked && (
                <p style={{ fontSize: '0.85rem', color: '#ae8339', marginBottom: '1rem' }}>
                  🔒 Mission clôturée et soumise pour validation : le formulaire est verrouillé jusqu'à la décision de l'administrateur.
                </p>
              )}

              <div className="wizard-step-content">
                {currentStep.kind === 'checklist' && (
                  <div className="form-group">
                    <label>✅ Point de contrôle à vérifier</label>
                    <p className="wizard-checklist-question">{currentStep.item}</p>
                    <label className="checklist-confirm">
                      <input
                        type="checkbox"
                        checked={checklistAnswers[currentStep.item]?.checked || false}
                        onChange={(e) =>
                          setChecklistAnswers((prev) => ({
                            ...prev,
                            [currentStep.item]: {
                              note: prev[currentStep.item]?.note || '',
                              checked: e.target.checked,
                            },
                          }))
                        }
                        disabled={isUpdating || isMissionLocked}
                      />
                      Vérifié / conforme sur place
                    </label>
                    <textarea
                      placeholder="Commentaire sur ce point (optionnel)..."
                      value={checklistAnswers[currentStep.item]?.note || ''}
                      onChange={(e) =>
                        setChecklistAnswers((prev) => ({
                          ...prev,
                          [currentStep.item]: {
                            checked: prev[currentStep.item]?.checked || false,
                            note: e.target.value,
                          },
                        }))
                      }
                      disabled={isUpdating || isMissionLocked}
                      style={{ minHeight: '80px' }}
                    />
                  </div>
                )}

                {currentStep.kind === 'observations' && (
                  <div className="form-group">
                    <label htmlFor="observations">
                      🔍 Observations
                      <span style={{ color: '#ae8339', marginLeft: '0.3rem' }}>*</span>
                    </label>
                    <p className="wizard-hint">Décrivez ce que vous avez constaté sur place, point par point.</p>
                    <textarea
                      id="observations"
                      placeholder="Décrivez vos observations sur le terrain..."
                      value={formData.observations}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                      disabled={isUpdating || isMissionLocked}
                      style={{ minHeight: '140px' }}
                    />
                  </div>
                )}

                {currentStep.kind === 'results' && (
                  <div className="form-group">
                    <label htmlFor="results">
                      ✓ Résultats
                      <span style={{ color: '#ae8339', marginLeft: '0.3rem' }}>*</span>
                    </label>
                    <p className="wizard-hint">
                      Résumez le résultat global de la mission (conforme, écarts, points bloquants...).
                    </p>
                    <textarea
                      id="results"
                      placeholder="Décrivez les résultats obtenus..."
                      value={formData.results}
                      onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                      disabled={isUpdating || isMissionLocked}
                      style={{ minHeight: '140px' }}
                    />
                  </div>
                )}

                {currentStep.kind === 'findings' && (
                  <div className="form-group">
                    <label htmlFor="findings">🎯 Constatations/Découvertes</label>
                    <p className="wizard-hint">Anomalies ou découvertes particulières à signaler (optionnel).</p>
                    <textarea
                      id="findings"
                      placeholder="Précisez les éléments clés découverts..."
                      value={formData.findings}
                      onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                      disabled={isUpdating || isMissionLocked}
                      style={{ minHeight: '100px' }}
                    />
                  </div>
                )}

                {currentStep.kind === 'notes' && (
                  <div className="form-group">
                    <label htmlFor="notes">📌 Notes supplémentaires</label>
                    <p className="wizard-hint">Toute information utile pour l'admin ou le client (optionnel).</p>
                    <textarea
                      id="notes"
                      placeholder="Ajoutez des notes ou commentaires supplémentaires..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      disabled={isUpdating || isMissionLocked}
                      style={{ minHeight: '100px' }}
                    />
                  </div>
                )}

                {currentStep.kind === 'photos' && (
                  <div className="form-group">
                    <label>📷 Photos</label>
                    <p className="wizard-hint">Ajoutez vos photos prises sur place, depuis l'appareil ou la galerie.</p>
                    <div className="photo-buttons">
                      <button
                        type="button"
                        className="btn-photo"
                        disabled={isUpdating || isMissionLocked}
                        onClick={() => {
                          const input = document.getElementById('camera-input') as HTMLInputElement
                          input?.click()
                        }}
                      >
                        📷 Prendre une photo
                      </button>
                      <button
                        type="button"
                        className="btn-photo"
                        disabled={isUpdating || isMissionLocked}
                        onClick={() => {
                          const input = document.getElementById('gallery-input') as HTMLInputElement
                          input?.click()
                        }}
                      >
                        🖼️ Charger une photo
                      </button>
                      <input
                        id="camera-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleAddPhoto}
                        style={{ display: 'none' }}
                        disabled={isUpdating || isMissionLocked}
                      />
                      <input
                        id="gallery-input"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAddPhoto}
                        style={{ display: 'none' }}
                        disabled={isUpdating || isMissionLocked}
                      />
                    </div>

                    {formData.photos.length > 0 && (
                      <div className="photos-grid">
                        {formData.photos.map((photo, index) => (
                          <div key={index} className="photo-item">
                            <img src={photo.url} alt={photo.name || `Photo ${index + 1}`} />
                            <button
                              type="button"
                              className="btn-remove-photo"
                              onClick={() => handleRemovePhoto(index)}
                              disabled={isUpdating || isMissionLocked}
                              title="Supprimer cette photo"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ fontSize: '0.85rem', color: '#65696a', marginTop: '0.5rem' }}>
                      {formData.photos.length} photo{formData.photos.length !== 1 ? 's' : ''} ajoutée
                      {formData.photos.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {currentStep.kind === 'review' && (
                  <div className="wizard-review">
                    <p className="wizard-hint">Relisez votre rapport avant de le soumettre à l'administrateur.</p>
                    {checklist.length > 0 && (
                      <div className="review-block">
                        <strong>Points de contrôle :</strong>
                        <ul>
                          {checklist.map((item) => (
                            <li key={item}>
                              {checklistAnswers[item]?.checked ? '✅' : '⬜'} {item}
                              {checklistAnswers[item]?.note && <em> — {checklistAnswers[item].note}</em>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="review-block">
                      <strong>🔍 Observations :</strong>
                      <p>{formData.observations || '—'}</p>
                    </div>
                    <div className="review-block">
                      <strong>✓ Résultats :</strong>
                      <p>{formData.results || '—'}</p>
                    </div>
                    {formData.findings && (
                      <div className="review-block">
                        <strong>🎯 Constatations :</strong>
                        <p>{formData.findings}</p>
                      </div>
                    )}
                    {formData.notes && (
                      <div className="review-block">
                        <strong>📌 Notes :</strong>
                        <p>{formData.notes}</p>
                      </div>
                    )}
                    <div className="review-block">
                      <strong>📷 Photos :</strong> {formData.photos.length}
                    </div>
                  </div>
                )}
              </div>

              <div className="wizard-nav">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  disabled={isFirstStep || isUpdating}
                  className="btn-wizard-nav"
                >
                  ◀ Précédent
                </button>
                <span className="wizard-dots">
                  {wizardSteps.map((_, i) => (
                    <span key={i} className={`wizard-dot ${i === currentStepIndex ? 'active' : ''}`} />
                  ))}
                </span>
                {!isLastStep && (
                  <button type="button" onClick={goToNextStep} disabled={isUpdating} className="btn-wizard-nav">
                    Suivant ▶
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleSaveMissionDetails}
                  disabled={isUpdating || isMissionLocked || (!formData.observations && !formData.results)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: isUpdating || isMissionLocked || (!formData.observations && !formData.results) ? 0.5 : 1,
                    flex: 1,
                  }}
                >
                  {isUpdating ? '⏳...' : '💾 Enregistrer le brouillon'}
                </button>
                {isLastStep && (
                  <button
                    onClick={handleCompleteMission}
                    disabled={isUpdating || isMissionLocked || !formData.observations.trim() || !formData.results.trim()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isUpdating ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                      opacity:
                        isUpdating || isMissionLocked || !formData.observations.trim() || !formData.results.trim()
                          ? 0.5
                          : 1,
                      flex: 1,
                    }}
                  >
                    {isUpdating ? '⏳ Envoi...' : '🔒 Clôturer et soumettre'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedMission(null)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="detail-section">
              <h4>📅 Dates</h4>
              <p>
                <strong>Créée le:</strong>{' '}
                {new Date(selectedMission.created_at).toLocaleDateString('fr-FR')}
              </p>
              <p>
                <strong>Mise à jour le:</strong>{' '}
                {new Date(selectedMission.updated_at).toLocaleDateString('fr-FR')}
              </p>
              {selectedMission.requirements?.collaborator_data?.filled_at && (
                <p>
                  <strong>Informations remplies le:</strong>{' '}
                  {new Date(selectedMission.requirements.collaborator_data.filled_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
