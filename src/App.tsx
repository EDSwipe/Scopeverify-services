import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { prices } from './pricing'
import { supabase } from './supabase'
import { contactSchema } from './lib/validation'
import { z } from 'zod'
import './App.css'

type Language = 'fr' | 'en'
type SitePrice = { id: number; title_fr: string; title_en: string; description_fr: string; description_en: string; amount: string }

const fallbackPrices: SitePrice[] = prices.map(([title_fr, title_en, description_fr, description_en, amount], index) => ({ id: index + 1, title_fr, title_en, description_fr, description_en, amount }))
const fallbackSettings = { contact_email: 'contact@scopeverify-services.com', contact_phone: '+33 (0) 7 69 96 07 66', service_area: 'France et international' }

// Fallback content for when site_content is not available
const fallbackContent: Record<string, Record<string, string>> = {
  fr: {
    'hero_eyebrow': 'Présentation de service · Field Verification',
    'hero_title_1': 'Votre relais indépendant',
    'hero_title_2': 'sur le terrain.',
    'hero_text': 'Vous ne pouvez pas être sur place ? Nous y allons pour vous. SCOPE-VERIFY constate, documente et rapporte les éléments définis dans votre cahier des charges.',
    'hero_action': 'Définir une mission',
    'hero_field': 'VOS YEUX SUR LE TERRAIN',
    'hero_footer': 'Constater · Documenter · Rapporter',
    'hero_country': 'FRANCE',
    'intro_tag': 'Le problème · Notre réponse',
    'intro_title_1': 'À distance, certaines décisions nécessitent simplement…',
    'intro_title_2': 'd\'être sur place.',
    'intro_text': 'Le problème n\'est pas de savoir quoi vérifier. Le problème est de pouvoir être physiquement sur place. Nous devenons vos yeux sur le terrain, afin de vous transmettre des faits documentés avant votre décision.',
    'intro_discover': 'Découvrir nos missions',
    'missions_tag': 'Nos missions',
    'missions_subtitle': 'Une mission. Un cahier des charges. Un rapport exploitable.',
    'process_tag': 'Comment ça marche',
    'process_title_1': 'De la demande',
    'process_title_2': 'au rapport.',
    'process_note': 'Vous n\'avez aucune logistique terrain à gérer : déplacement, prise de rendez-vous et exécution sont de notre côté.',
    'deliverables_tag': 'Le livrable',
    'deliverables_title_1': 'Vous ne recevez pas simplement des',
    'deliverables_title_2': 'photos.',
    'deliverables_text': 'Chaque observation importante est reliée à un élément de preuve lorsque celui-ci est disponible.',
    'limits_tag': 'Nos limites = notre fiabilité',
    'limits_title_1': 'Une mission indépendante, avec un cadre',
    'limits_title_2': 'clair.',
    'limits_text': 'Nous constatons et documentons les éléments définis dans le cahier des charges. Notre rôle est de vous donner une vision fiable de ce qui peut être constaté sur le terrain.',
    'limits_more': 'Nous ne nous substituons pas à un expert technique, un auditeur, un organisme de certification, un contrôleur réglementaire ou un professionnel habilité. Lorsqu\'une qualification est nécessaire, la mission est complétée par un spécialiste.',
    'contact_tag': 'Passons à l\'action',
    'contact_title_1': 'Besoin de quelqu\'un',
    'contact_title_2': 'sur le terrain ?',
    'contact_text': 'Remplissez le formulaire ci-dessous ou contactez-nous directement par email.',
    'contact_phone_label': 'Téléphone',
    'contact_send': 'Envoyer',
    'contact_success': 'Demande envoyée. Nous vous répondrons rapidement.',
    'contact_disabled_message': 'Le formulaire de mission est temporairement désactivé. Veuillez nous contacter par email pour toute demande de mission.',
    'footer_text': 'Tous droits réservés.',
    'nav_missions': 'Missions',
    'nav_tarifs': 'Tarifs',
    'nav_contact': 'Contact',
    'label_name': 'Nom',
    'label_company': 'Entreprise',
    'label_email': 'Email',
    'label_phone': 'Téléphone',
    'label_mission': 'Mission',
    'placeholder_name': 'Votre nom',
    'placeholder_company': 'Votre entreprise',
    'placeholder_email': 'votre@email.com',
    'placeholder_phone': '+33 ...',
    'placeholder_mission': 'Décrivez votre mission...',
  },
  en: {
    'hero_eyebrow': 'Service presentation · Field Verification',
    'hero_title_1': 'Your independent representative',
    'hero_title_2': 'on the ground.',
    'hero_text': 'Cannot be on site? We go for you. SCOPE-VERIFY observes, documents and reports the items defined in your scope of work.',
    'hero_action': 'Define a mission',
    'hero_field': 'YOUR EYES ON THE GROUND',
    'hero_footer': 'Observe · Document · Report',
    'hero_country': 'FRANCE',
    'intro_tag': 'The issue · Our response',
    'intro_title_1': 'From a distance, some decisions simply require…',
    'intro_title_2': 'being on site.',
    'intro_text': 'The issue is not knowing what to check. The issue is being physically present. We become your eyes on the ground, giving you documented facts before you decide.',
    'intro_discover': 'Explore our missions',
    'missions_tag': 'Our missions',
    'missions_subtitle': 'One mission. One scope of work. One actionable report.',
    'process_tag': 'How it works',
    'process_title_1': 'From request',
    'process_title_2': 'to report.',
    'process_note': 'You have no field logistics to manage: travel, appointment scheduling and execution are our responsibility.',
    'deliverables_tag': 'What you receive',
    'deliverables_title_1': 'You do not simply receive',
    'deliverables_title_2': 'photos.',
    'deliverables_text': 'Every important observation is linked to supporting evidence whenever it is available.',
    'limits_tag': 'Our limits = our reliability',
    'limits_title_1': 'An independent mission,',
    'limits_title_2': 'with a clear framework.',
    'limits_text': 'We observe and document the items defined in the scope of work. Our role is to give you a reliable view of what can be observed on site.',
    'limits_more': 'We do not replace a technical expert, auditor, certification body, regulatory inspector or licensed professional. When a specific qualification is required, the mission is complemented by a specialist.',
    'contact_tag': 'Let\'s take action',
    'contact_title_1': 'Need someone',
    'contact_title_2': 'on the ground?',
    'contact_text': 'Fill out the form below or contact us directly by email.',
    'contact_phone_label': 'Phone',
    'contact_send': 'Send',
    'contact_success': 'Request sent. We will respond quickly.',
    'contact_disabled_message': 'The mission form is temporarily disabled. Please contact us by email for any mission request.',
    'footer_text': 'All rights reserved.',
    'nav_missions': 'Missions',
    'nav_tarifs': 'Rates',
    'nav_contact': 'Contact',
    'label_name': 'Name',
    'label_company': 'Company',
    'label_email': 'Email',
    'label_phone': 'Phone',
    'label_mission': 'Mission',
    'placeholder_name': 'Your name',
    'placeholder_company': 'Your company',
    'placeholder_email': 'your@email.com',
    'placeholder_phone': '+33 ...',
    'placeholder_mission': 'Describe your mission...',
  }
}

const missionData = [
  ['01', ['Fournisseur / Partenaire', 'Supplier / Partner'], ['Existence du site, activité constatée, équipements visibles, effectif présent, environnement de production, documents accessibles et photographies.', 'Site existence, observed activity, visible equipment, staff present, production environment, accessible documents and photographs.']],
  ['02', ['Commande / Production', 'Order / Production'], ['Références, quantités, dimensions, état apparent, conditionnement, avancement, préparation avant expédition et preuves photographiques.', 'References, quantities, dimensions, apparent condition, packaging, progress, pre-shipment preparation and photographic evidence.']],
  ['03', ['Projet / Implantation', 'Project / Site'], ['Visite du site, état d’avancement, environnement, équipements présents, configuration générale et relevés photographiques.', 'Site visit, progress status, environment, equipment present, general configuration and photographic records.']],
  ['04', ['Mission sur mesure', 'Custom mission'], ['Toute mission définie précisément par un cahier des charges terrain. Vous listez les points à vérifier, nous les traitons un par un.', 'Any mission precisely defined by an on-site scope of work. You list the items to check; we handle them one by one.']],
] as const
function Brand() { return <span className="brand"><span className="brand-mark" aria-hidden="true"><i /></span><span><span className="brand-name">Scope<span>-</span><b>Verify</b></span><small>FIELD VERIFICATION</small></span></span> }
function App() {
  const [language, setLanguage] = useState<Language>('fr'); const [phone, setPhone] = useState<string>(); const [sent, setSent] = useState(false); const [formError, setFormError] = useState(''); const [validationErrors, setValidationErrors] = useState<Record<string, string>>({}); const [sitePrices, setSitePrices] = useState<SitePrice[]>(fallbackPrices); const [settings, setSettings] = useState(fallbackSettings); const [missionFormEnabled, setMissionFormEnabled] = useState(true); const t = fallbackContent[language]; const index = language === 'fr' ? 0 : 1
  useEffect(() => { if (!supabase) return; supabase.from('prices').select('*').order('id').then(({ data }) => { if (data?.length) setSitePrices(data as SitePrice[]) }); supabase.from('site_settings').select('*').then(({ data }) => { if (data?.length) { const settingsMap = Object.fromEntries(data.map((item) => [item.key, item.value])); setSettings({ ...fallbackSettings, ...settingsMap }); setMissionFormEnabled(settingsMap.mission_form_enabled === 'true'); } }); supabase.from('page_views').insert({ page: window.location.pathname }).then(() => {}) }, [])
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => { 
    event.preventDefault(); 
    const form = new FormData(event.currentTarget); 
    const request = { name: String(form.get('name')), company: String(form.get('company') || ''), email: String(form.get('email')), phone: phone ?? '', mission: String(form.get('message')) }; 
    setSent(false); 
    setFormError(''); 
    setValidationErrors({})
    
    // Validate with Zod
    try {
      const validationResult = contactSchema.parse(request)
      
      if (!supabase) { setFormError('Le service de contact est temporairement indisponible.'); return }; 
      const { error } = await supabase.from('contact_requests').insert(validationResult); 
      if (error) setFormError(error.message); 
      else { 
        setSent(true); 
        event.currentTarget.reset(); 
        setPhone(undefined); 
        void fetch('/api/contact-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validationResult) }) 
      } 
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message
          }
        })
        setValidationErrors(errors)
      }
    }
  }
  return <main>
    <header className="topbar"><a href="#accueil" aria-label="Home"><Brand /></a><nav><a href="#missions">{t.nav[0]}</a><a href="#tarifs">{t.nav[1]}</a><a href="#contact" className="nav-contact">{t.nav[2]}</a><span className="language-switch" aria-label="Language"><button className={language === 'fr' ? 'active' : ''} onClick={() => setLanguage('fr')}>FR</button><span>/</span><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button></span></nav></header>
    <section className="hero" id="accueil"><div className="hero-grid" aria-hidden="true" /><p className="eyebrow">{t.eyebrow}</p><h1>{t.hero[0]}<br /><em>{t.hero[1]}</em></h1><p className="hero-copy">{t.heroText}</p><a className="button button-gold" href="#contact">{t.action} <span>↘</span></a><div className="hero-foot"><span>{t.field}</span><p>Constater · Documenter · Rapporter</p><span>FRANCE</span></div></section>
    <section className="intro section-pad"><p className="eyebrow">{t.introTag}</p><div className="intro-layout"><h2>{t.intro[0]}<br /><em>{t.intro[1]}</em></h2><div><p>{t.introText}</p><a className="text-link" href="#missions">{t.discover} <span>→</span></a></div></div></section>
    <section className="services section-pad" id="missions"><div className="section-heading"><p className="eyebrow">{t.missionsTag}</p><p>{t.missionsSub}</p></div><div className="service-list mission-list">{missionData.map(([number, title, description]) => <article className="service" key={number}><span className="service-number">{number}</span><h3>{title[index]}</h3><p>{description[index]}</p></article>)}</div></section>
    <section className="process section-pad"><div><p className="eyebrow">{t.processTag}</p><h2>{t.process[0]}<br /><em>{t.process[1]}</em></h2><p className="process-note">{t.processNote}</p></div><ol>{['Brief', 'Préparation', 'Visite', 'Documentation', 'Rapport'].map((title, stepIndex) => <li key={title}><span>0{stepIndex + 1}</span><div><h3>{language === 'fr' ? title : ['Brief', 'Preparation', 'Visit', 'Documentation', 'Report'][stepIndex]}</h3><p>{language === 'fr' ? ['Vous définissez l’objectif et les points à vérifier.', 'Nous transformons la demande en checklist terrain.', 'Déplacement sur site et réalisation de la mission.', 'Photos, relevés, observations et éléments autorisés.', 'Un rapport clair, avec les preuves associées.'][stepIndex] : ['You define the objective and items to check.', 'We turn the request into a field checklist.', 'Travel to the site and carry out the mission.', 'Photos, records, observations and authorized items.', 'A clear report, with supporting evidence.'][stepIndex]}</p></div></li>)}</ol></section>
    <section className="deliverables section-pad"><p className="eyebrow">{t.deliverTag}</p><div className="deliverable-layout"><h2>{t.deliver[0]}<br /><em>{t.deliver[1]}</em></h2><div><p>{t.deliverText}</p><ul>{(language === 'fr' ? ['Rapport PDF et synthèse de mission', 'Checklist complétée, point par point', 'Observations factuelles et écarts constatés', 'Photographies originales et relevés effectués', 'Documents accessibles et autorisés', 'Points nécessitant éventuellement un spécialiste'] : ['PDF report and mission summary', 'Checklist completed, point by point', 'Factual observations and noted discrepancies', 'Original photographs and records taken', 'Accessible and authorized documents', 'Items that may require a specialist']).map((item) => <li key={item}>{item}</li>)}</ul></div></div></section>
    <section className="limits section-pad"><p className="eyebrow">{t.limitsTag}</p><div className="intro-layout"><h2>{t.limits[0]}<br /><em>{t.limits[1]}</em></h2><div><p>{t.limitsText}</p><p>{t.limitsMore}</p></div></div></section>
    <section className="pricing section-pad" id="tarifs"><div className="section-heading"><p className="eyebrow">{t.priceTag}</p><p>{t.priceSub}</p></div><div className="price-list">{sitePrices.map((price) => <article key={price.id}><h3>{language === 'fr' ? price.title_fr : price.title_en}</h3><p>{language === 'fr' ? price.description_fr : price.description_en}</p><strong>{t.from}<b>{price.amount}</b></strong></article>)}</div><p className="pricing-note">{t.priceNote}</p></section>
    <section className="contact section-pad" id="contact"><div className="contact-title"><p className="eyebrow">{t.contactTag}</p><h2>{t.contact[0]}<br /><em>{t.contact[1]}</em></h2><p>{t.contactText}</p><a href={`mailto:${settings.contact_email}`} className="email-link">{settings.contact_email}</a><p className="contact-person">{t.phone} {settings.contact_phone}</p></div>{!missionFormEnabled && <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}><p style={{ margin: 0, color: '#856404' }}><strong>⚠️ Le formulaire de mission est temporairement désactivé.</strong><br />Veuillez nous contacter par email à {settings.contact_email} pour toute demande de mission.</p></div>}<form onSubmit={handleSubmit}><label>{t.labels[0]}<input required name="name" type="text" placeholder={t.placeholders[0]} />{validationErrors.name && <p className="form-message">{validationErrors.name}</p>}</label><label>{t.labels[1]}<input name="company" type="text" placeholder={t.placeholders[1]} /></label><label>{t.labels[2]}<input required name="email" type="email" placeholder={t.placeholders[2]} />{validationErrors.email && <p className="form-message">{validationErrors.email}</p>}</label><label>{t.labels[3]}<PhoneInput international defaultCountry="FR" value={phone} onChange={setPhone} placeholder="+33 ..." /></label>{missionFormEnabled ? <label>{t.labels[4]}<textarea required name="message" rows={4} placeholder={t.placeholders[3]} />{validationErrors.mission && <p className="form-message">{validationErrors.mission}</p>}</label> : <label>{t.labels[4]}<textarea name="message" rows={4} placeholder={language === 'fr' ? 'Votre message...' : 'Your message...'} />{validationErrors.mission && <p className="form-message">{validationErrors.mission}</p>}</label>}<button className="button button-dark" type="submit">{t.send} <span>↗</span></button>{sent && <p className="form-message">Demande envoyée. Nous vous répondrons rapidement.</p>}{formError && <p className="form-message">{formError}</p>}</form></section>
    <footer><a href="#accueil" aria-label="Home"><Brand /></a><p>© 2026 SCOPE-VERIFY · {t.footer}</p></footer>
  </main>
}
export default App