import { useState, type FormEvent } from 'react'
import type { Mission, MissionType } from '../../types'
import { missionTypeLabels } from '../../types'
import { missions as missionAPI } from '../../lib/missions'
import { getErrorMessage } from '../../lib/errors'
import './MissionForm.css'

// Pre-filled checklist items per "formule" (mission type). The client can
// uncheck items that don't apply, and add their own custom items below.
const checklistPresets: Record<MissionType, string[]> = {
  simple_visit: [
    "Vérifier l'existence du site",
    'Photos datées du lieu',
    "Confirmer l'activité visible",
    "Relever l'adresse exacte",
  ],
  verification: [
    'Comparer avec le cahier des charges',
    'Vérifier la conformité des produits',
    'Contrôler les documents fournis',
    'Signaler tout écart constaté',
  ],
  supplier_visit: [
    'Visiter les locaux de production',
    'Vérifier les équipements',
    "Constater l'activité en cours",
    "Vérifier la commande / préparation avant expédition",
  ],
  technical_mission: [
    'Relever les dimensions',
    'Vérifier les quantités',
    'Vérifier les références produits',
    'Collecter les données techniques accessibles',
  ],
  field_day: [
    'Couvrir plusieurs points ou sites',
    'Rapport de synthèse journalier',
    'Photos de chaque étape',
    'Notes détaillées par site',
  ],
  custom: [
    "Décrire précisément l'objectif",
    'Lister les points de contrôle souhaités',
  ],
}

interface MissionFormProps {
  clientId: string
  onSave?: (mission: Mission) => void
  onCancel?: () => void
  initialMission?: Mission
}

export default function MissionForm({ clientId, onSave, onCancel, initialMission }: MissionFormProps) {
  const [title, setTitle] = useState(initialMission?.title || '')
  const [description, setDescription] = useState(initialMission?.description || '')
  const [missionType, setMissionType] = useState<MissionType>(initialMission?.mission_type || 'custom')
  const [location, setLocation] = useState(initialMission?.location || '')
  const [budget, setBudget] = useState(initialMission?.budget || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const initialChecklist: string[] = Array.isArray(initialMission?.requirements?.checklist)
    ? initialMission!.requirements!.checklist
    : []

  const buildPresetState = (type: MissionType, existing: string[]) => {
    const state: Record<string, boolean> = {}
    checklistPresets[type].forEach((item) => {
      state[item] = existing.length > 0 ? existing.includes(item) : true
    })
    return state
  }

  const [presetChecks, setPresetChecks] = useState<Record<string, boolean>>(() =>
    buildPresetState(missionType, initialChecklist),
  )
  const [customItems, setCustomItems] = useState<string[]>(() =>
    initialChecklist.filter((item) => !checklistPresets[missionType].includes(item)),
  )
  const [newItemText, setNewItemText] = useState('')

  const handleMissionTypeChange = (type: MissionType) => {
    setMissionType(type)
    setPresetChecks(buildPresetState(type, []))
    setCustomItems([])
  }

  const togglePreset = (item: string) => {
    setPresetChecks((prev) => ({ ...prev, [item]: !prev[item] }))
  }

  const addCustomItem = () => {
    const text = newItemText.trim()
    if (!text) return
    setCustomItems((prev) => [...prev, text])
    setNewItemText('')
  }

  const removeCustomItem = (index: number) => {
    setCustomItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const checklist = [
        ...checklistPresets[missionType].filter((item) => presetChecks[item]),
        ...customItems,
      ]

      const missionData = {
        client_id: clientId,
        title,
        description,
        mission_type: missionType,
        location,
        budget,
        requirements: { ...(initialMission?.requirements || {}), checklist },
        status: initialMission?.status || 'draft',
      }

      let saved: Mission
      if (initialMission?.id) {
        saved = await missionAPI.updateMission(initialMission.id, missionData)
      } else {
        saved = await missionAPI.createMission(missionData)
      }

      setSuccess(true)
      if (onSave) onSave(saved)

      // Reset form if creating new mission
      if (!initialMission) {
        setTitle('')
        setDescription('')
        setMissionType('custom')
        setLocation('')
        setBudget('')
        setPresetChecks(buildPresetState('custom', []))
        setCustomItems([])
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mission-form">
      <h2>{initialMission ? 'Modifier la mission' : 'Nouvelle mission'}</h2>

      <label>
        Type de mission
        <select
          value={missionType}
          onChange={(e) => handleMissionTypeChange(e.target.value as MissionType)}
          required
          disabled={isLoading}
        >
          {Object.entries(missionTypeLabels).map(([value, labels]) => (
            <option key={value} value={value}>
              {labels.fr}
            </option>
          ))}
        </select>
      </label>

      <label>
        Titre de la mission
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={isLoading}
          placeholder="Ex: Vérification usine Shanghai"
        />
      </label>

      <label>
        Lieu
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          disabled={isLoading}
          placeholder="Ex: Shanghai, Chine"
        />
      </label>

      <label>
        Description détaillée
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          placeholder="Décrivez précisément ce que vous souhaitez vérifier..."
          rows={6}
        />
      </label>

      <label>
        Budget / Tarif attendu
        <input
          type="text"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          disabled={isLoading}
          placeholder="Ex: 1500 EUR"
        />
      </label>

      <div className="checklist-section">
        <p className="checklist-label">Éléments à vérifier (pré-remplis selon la formule)</p>
        <div className="checklist-presets">
          {checklistPresets[missionType].map((item) => (
            <label key={item} className="checklist-item">
              <input
                type="checkbox"
                checked={!!presetChecks[item]}
                onChange={() => togglePreset(item)}
                disabled={isLoading}
              />
              {item}
            </label>
          ))}
        </div>

        <p className="checklist-label">Éléments supplémentaires</p>
        {customItems.length > 0 && (
          <ul className="custom-items-list">
            {customItems.map((item, index) => (
              <li key={index}>
                <span>{item}</span>
                <button type="button" onClick={() => removeCustomItem(index)} disabled={isLoading}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="add-item-row">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Ex: Vérifier le certificat qualité"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomItem()
              }
            }}
          />
          <button type="button" onClick={addCustomItem} disabled={isLoading || !newItemText.trim()}>
            + Ajouter
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">Mission sauvegardée avec succès !</p>}

      <div className="form-actions">
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Sauvegarde...' : initialMission ? 'Mettre à jour' : 'Créer la mission'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={isLoading}>
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}

