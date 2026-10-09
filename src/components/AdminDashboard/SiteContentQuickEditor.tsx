import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { getErrorMessage } from '../../lib/errors'
import './SiteContentQuickEditor.css'

type Language = 'fr' | 'en'
type ContentField = { section: string; key: string; label: string; multiline?: boolean; fallback: Record<Language, string> }
const fields: ContentField[] = [
  { section: 'hero', key: 'main_title', label: 'Titre principal', fallback: { fr: 'Un besoin. Un interlocuteur.\nLa bonne compétence sur le terrain.', en: 'One need. One point of contact.\nThe right expertise on site.' } },
  { section: 'hero', key: 'subtitle', label: 'Sous-titre', multiline: true, fallback: { fr: 'Vous expliquez ce que vous souhaitez vérifier. Scope-Verify qualifie le besoin, intervient directement lorsque la vérification est simple ou mobilise un partenaire spécialisé lorsque la mission l’exige.', en: 'Tell us what you need to verify. Scope-Verify qualifies the request, handles straightforward field checks directly, or appoints a specialist when the work requires it.' } },
  { section: 'audience', key: 'summary', label: 'Public concerné', multiline: true, fallback: { fr: 'Pour les dirigeants et entreprises, investisseurs, financeurs, organismes, chefs de projet, acheteurs et porteurs de projets.', en: 'For business leaders, companies, investors, funders, institutions, project managers, buyers and project sponsors.' } },
  { section: 'needs', key: 'items', label: 'Exemples de besoins (un par ligne)', multiline: true, fallback: { fr: 'Réalité d’une activité ou d’un site\nExistence et état d’un bien, équipement, stock ou marchandise\nConstat d’une situation sur le terrain\nExpertise technique, analyses ou essais spécialisés\nAvis juridique ou financier lorsque nécessaire\nÉléments avant un achat, investissement ou engagement', en: 'Whether an activity or site exists\nThe existence and condition of an asset, equipment, stock or goods\nA situation observed on site\nSpecialist technical expertise, analysis or testing\nLegal or financial advice where needed\nInformation before a purchase, investment or commitment' } },
  { section: 'process', key: 'steps', label: 'Parcours client (un texte par ligne)', multiline: true, fallback: { fr: 'Vous avez une question ou un besoin\nVous nous expliquez ce que vous souhaitez vérifier\nScope-Verify identifie la compétence nécessaire\nLa mission est réalisée directement ou par le partenaire adapté\nVous recevez la restitution et suivez votre mission', en: 'You have a question or need\nYou explain what you need verified\nScope-Verify identifies the required expertise\nThe work is carried out directly or by a suitable partner\nYou receive the findings and track the mission' } },
  { section: 'network', key: 'summary', label: 'Présentation du réseau', multiline: true, fallback: { fr: 'Nous sélectionnons des professionnels et organismes dans leur domaine. Scope-Verify coordonne la réponse et reste votre interlocuteur. Les compétences, qualifications, agréments, accréditations et assurances pertinents des partenaires sont vérifiés selon leur domaine d’intervention et la nature des missions.', en: 'We select professionals and organizations for their expertise. Scope-Verify coordinates the response and remains your point of contact. Relevant partner skills, qualifications, approvals, accreditations and insurance are verified according to their field and the nature of each mission.' } },
  { section: 'network', key: 'domains', label: 'Domaines (un par ligne)', multiline: true, fallback: { fr: 'Inspection et expertise technique\nBTP et génie civil\nIndustrie et équipements\nLaboratoires et essais\nEnvironnement et immobilier\nDroit des affaires, comptabilité et finance', en: 'Inspection and technical expertise\nConstruction and civil engineering\nIndustry and equipment\nLaboratories and testing\nEnvironment and real estate\nBusiness law, accounting and finance' } },
  { section: 'zones', key: 'offices', label: 'Bureaux', fallback: { fr: 'Bureaux : France et Maroc', en: 'Offices: France and Morocco' } },
  { section: 'zones', key: 'markets', label: 'Zones clients', fallback: { fr: 'Zones clients : Canada, Benelux, France, Allemagne, Suisse et Espagne', en: 'Client regions: Canada, Benelux, France, Germany, Switzerland and Spain' } },
  { section: 'contact', key: 'title', label: 'Titre de demande de mission', fallback: { fr: 'Parlons de votre besoin', en: 'Tell us what you need' } },
  { section: 'contact', key: 'button', label: 'Bouton principal', fallback: { fr: 'Demander une mission', en: 'Request a mission' } },
]

export default function SiteContentQuickEditor({ adminId }: { adminId: string }) {
  const [language, setLanguage] = useState<Language>('fr')
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    void supabase.from('site_content').select('section,key,language,content').then(({ data }) => {
      if (!data) return
      setValues(Object.fromEntries(data.map((row) => [`${row.language}.${row.section}.${row.key}`, row.content])))
    })
  }, [])

  const valueFor = (field: ContentField) => values[`${language}.${field.section}.${field.key}`] ?? field.fallback[language]
  const update = (field: ContentField, content: string) => setValues((current) => ({ ...current, [`${language}.${field.section}.${field.key}`]: content }))
  const save = async () => {
    if (!supabase) return
    setBusy(true); setError(''); setMessage('')
    try {
      const rows = fields.map((field) => ({ section: field.section, key: field.key, language, content: valueFor(field), updated_by: adminId, updated_at: new Date().toISOString() }))
      const { error: saveError } = await supabase.from('site_content').upsert(rows, { onConflict: 'section,key,language' })
      if (saveError) throw saveError
      setMessage('Les contenus de cette langue sont enregistrés.')
    } catch (err) {
      setError(getErrorMessage(err) || 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="site-quick-editor">
    <div className="site-quick-heading"><div><p className="partner-form-kicker">CONTENU PUBLIC</p><h3>Édition rapide</h3></div><div className="site-language-switch" role="group" aria-label="Langue du contenu">{(['fr', 'en'] as const).map((item) => <button key={item} className={language === item ? 'active' : ''} onClick={() => setLanguage(item)}>{item.toUpperCase()}</button>)}</div></div>
    <div className="site-quick-fields">{fields.map((field) => <label key={`${field.section}.${field.key}`} className={field.multiline ? 'wide' : ''}>{field.label}
      {field.multiline ? <textarea rows={field.key === 'items' || field.key === 'steps' || field.key === 'domains' ? 6 : 3} value={valueFor(field)} onChange={(event) => update(field, event.target.value)} /> : <input value={valueFor(field)} onChange={(event) => update(field, event.target.value)} />}
    </label>)}</div>
    {error && <p className="site-quick-error" role="alert">{error}</p>}{message && <p className="site-quick-success" role="status">{message}</p>}
    <button className="site-quick-save" onClick={() => void save()} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer les textes'}</button>
  </section>
}
