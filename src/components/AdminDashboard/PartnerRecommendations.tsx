import { useEffect } from 'react'
import type { Mission, User } from '../../types'
import { recommendPartnersForMission } from '../../lib/partner-matching'
import type { MatchingPartnerDocument, MatchingPartnerProfile } from '../../lib/partner-matching'
import './PartnerRecommendations.css'

interface PartnerRecommendationsProps {
  mission: Mission
  partners: MatchingPartnerProfile[]
  activeUsers: User[]
  documents: MatchingPartnerDocument[]
  assigningPartnerId: string | null
  onAssign: (partner: MatchingPartnerProfile) => void
  onClose: () => void
}

export default function PartnerRecommendations({
  mission,
  partners,
  activeUsers,
  documents,
  assigningPartnerId,
  onAssign,
  onClose,
}: PartnerRecommendationsProps) {
  const activeUserIds = new Set(activeUsers.map((user) => user.id))
  const result = recommendPartnersForMission(mission, partners, activeUserIds, documents)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="partner-recommendation-backdrop" role="presentation" onClick={onClose}>
    <section className="partner-recommendation-dialog" role="dialog" aria-modal="true" aria-labelledby="partner-recommendation-title" onClick={(event) => event.stopPropagation()}>
      <header className="partner-recommendation-header">
        <div>
          <p className="partner-recommendation-kicker">ASSISTANT DE RECOMMANDATION</p>
          <h2 id="partner-recommendation-title">Partenaires suggérés</h2>
          <p>{mission.title} · {mission.location}</p>
        </div>
        <button type="button" className="partner-recommendation-close" aria-label="Fermer" onClick={onClose}>×</button>
      </header>

      <p className="partner-recommendation-explainer">Le classement compare les domaines, la zone, les qualifications et les informations de capacité. C’est une aide à la décision; l’affectation reste manuelle.</p>

      {result.recommendations.length === 0 ? (
        <div className="partner-recommendation-empty">
          <strong>Aucun partenaire admissible trouvé.</strong>
          <p>Vérifie les critères de la mission, les comptes actifs et les statuts du réseau.</p>
        </div>
      ) : (
        <div className="partner-recommendation-list">
          {result.recommendations.map((recommendation, index) => <article className="partner-recommendation-row" key={recommendation.partner.id}>
            <div className="partner-recommendation-main">
              <div className="partner-recommendation-rank">{String(index + 1).padStart(2, '0')}</div>
              <div className="partner-recommendation-name">
                <strong>{recommendation.partner.business_name}</strong>
                <span>{recommendation.partner.status === 'network' ? 'Réseau Scope-Verify' : 'Référencé'}</span>
              </div>
              <div className="partner-recommendation-score" aria-label={`Score ${recommendation.score} sur 100`}>
                <strong>{recommendation.score}</strong><span>/ 100</span>
              </div>
              <button type="button" onClick={() => onAssign(recommendation.partner)} disabled={assigningPartnerId !== null}>
                {assigningPartnerId === recommendation.partner.user_id ? 'Affectation…' : 'Affecter'}
              </button>
            </div>
            <div className="partner-recommendation-criteria">
              {recommendation.criteria.map((criterion) => <div className="partner-recommendation-criterion" key={criterion.label}>
                <div><span>{criterion.label}</span><strong>{criterion.score}/{criterion.maximum}</strong></div>
                <div className="partner-recommendation-meter"><i style={{ width: `${criterion.maximum ? (criterion.score / criterion.maximum) * 100 : 0}%` }} /></div>
                <small>{criterion.detail}</small>
              </div>)}
            </div>
            {recommendation.warnings.length > 0 && <p className="partner-recommendation-warning">À vérifier : {recommendation.warnings.join(' · ')}</p>}
          </article>)}
        </div>
      )}

      <footer className="partner-recommendation-footer">
        <span>{result.recommendations.length} partenaire(s) proposés · {result.excludedCount} profil(s) écarté(s)</span>
        <button type="button" onClick={onClose}>Fermer</button>
      </footer>
    </section>
  </div>
}