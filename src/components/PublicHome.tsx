import { useEffect, useState, type FormEvent } from 'react'
import { contactSchema } from '../lib/validation'
import { getErrorMessage } from '../lib/errors'
import { parseTestimonial } from '../lib/testimonials'
import type { Testimonial } from '../lib/testimonials'
import { parsePartnerLogo } from '../lib/partner-logos'
import type { PartnerLogo } from '../lib/partner-logos'
import PublishedDocumentLinks from './PublishedDocumentLinks'
import { supabase } from '../supabase'
import './PublicHome.css'

type Language = 'fr' | 'en'
type PublicPartner = {
  id: string
  public_name: string | null
  public_summary: string | null
  public_domains: string[]
  public_country: string | null
  public_area: string | null
  public_website: string | null
  public_logo_path: string | null
}
type PublicSettings = { contact_email: string; contact_phone: string; phone_display_enabled: string; whatsapp_number: string; whatsapp_display_enabled: string; mission_form_enabled: string }

const translations = {
  fr: {
    nav: ['Pour qui', 'Nos interventions', 'Notre réseau', 'Zones'],
    cta: 'Demander une mission',
    partnerCta: 'Candidater au réseau',
    title: 'Un besoin. Un interlocuteur.\nLa bonne compétence sur le terrain.',
    intro: 'Vous expliquez ce que vous souhaitez vérifier. Scope-Verify qualifie le besoin, intervient directement lorsque la vérification est simple ou mobilise un partenaire spécialisé lorsque la mission l’exige.',
    audienceTitle: 'Une réponse terrain avant une décision',
    audience: 'Pour les dirigeants et entreprises, investisseurs, financeurs, organismes, chefs de projet, acheteurs et porteurs de projets.',
    needsTitle: 'Ce que nous pouvons vérifier',
    needs: ['Réalité d’une activité ou d’un site', 'Existence et état d’un bien, équipement, stock ou marchandise', 'Constat d’une situation sur le terrain', 'Expertise technique, analyses ou essais spécialisés', 'Avis juridique ou financier lorsque nécessaire', 'Éléments avant un achat, investissement ou engagement'],
    howTitle: 'Une demande, cinq étapes',
    steps: ['Vous avez une question ou un besoin', 'Vous nous expliquez ce que vous souhaitez vérifier', 'Scope-Verify identifie la compétence nécessaire', 'La mission est réalisée directement ou par le partenaire adapté', 'Vous recevez la restitution et suivez votre mission'],
    networkTitle: 'Un réseau restreint, des compétences vérifiées',
    networkCopy: 'Nous sélectionnons des professionnels et organismes dans leur domaine. Scope-Verify coordonne la réponse et reste votre interlocuteur. Les compétences, qualifications, agréments, accréditations et assurances pertinents des partenaires sont vérifiés selon leur domaine d’intervention et la nature des missions.',
    domains: ['Inspection et expertise technique', 'BTP et génie civil', 'Industrie et équipements', 'Laboratoires et essais', 'Environnement et immobilier', 'Droit des affaires, comptabilité et finance'],
    zoneTitle: 'Une présence organisée sur plusieurs zones',
    offices: 'Bureaux : France et Maroc',
    clientZones: 'Zones clients : Canada, Benelux, France, Allemagne, Suisse et Espagne',
    partners: 'Partenaires sélectionnés',
    formTitle: 'Parlons de votre besoin',
    formCopy: 'Décrivez la question à résoudre. Nous revenons vers vous pour qualifier le périmètre et la compétence nécessaire.',
    name: 'Nom et prénom', company: 'Entreprise', email: 'Email professionnel', phone: 'Téléphone', situation: 'Que souhaitez-vous vérifier ?', message: 'Questions et éléments à vérifier', deadline: 'Délai souhaité', budget: 'Budget indicatif', send: 'Envoyer la demande',
    placeholder: 'Décrivez votre situation et les questions auxquelles vous avez besoin d’une réponse.', requestDocuments: 'Documents utiles pour votre demande', success: 'Demande envoyée. Scope-Verify reviendra vers vous pour qualifier votre besoin.', partnerLink: 'Candidater au réseau partenaire', login: 'Espace client', footer: 'Scope-Verify coordonne votre demande et organise la réponse adaptée.',
  },
  en: {
    nav: ['Who we serve', 'What we do', 'Our network', 'Coverage'],
    cta: 'Request a mission',
    partnerCta: 'Apply to the network',
    title: 'One need. One point of contact.\nThe right expertise on site.',
    intro: 'Tell us what you need to verify. Scope-Verify qualifies the request, handles straightforward field checks directly, or appoints a specialist when the work requires it.',
    audienceTitle: 'Field information before a decision',
    audience: 'For business leaders, companies, investors, funders, institutions, project managers, buyers and project sponsors.',
    needsTitle: 'What we can verify',
    needs: ['Whether an activity or site exists', 'The existence and condition of an asset, equipment, stock or goods', 'A situation observed on site', 'Specialist technical expertise, analysis or testing', 'Legal or financial advice where needed', 'Information before a purchase, investment or commitment'],
    howTitle: 'A request, five steps',
    steps: ['You have a question or need', 'You explain what you need verified', 'Scope-Verify identifies the required expertise', 'The work is carried out directly or by a suitable partner', 'You receive the findings and track the mission'],
    networkTitle: 'A focused network with verified expertise',
    networkCopy: 'We select professionals and organizations for their expertise. Scope-Verify coordinates the response and remains your point of contact. Relevant partner skills, qualifications, approvals, accreditations and insurance are verified according to their field and the nature of each mission.',
    domains: ['Inspection and technical expertise', 'Construction and civil engineering', 'Industry and equipment', 'Laboratories and testing', 'Environment and real estate', 'Business law, accounting and finance'],
    zoneTitle: 'Organized coverage across selected regions',
    offices: 'Offices: France and Morocco',
    clientZones: 'Client regions: Canada, Benelux, France, Germany, Switzerland and Spain',
    partners: 'Selected partners',
    formTitle: 'Tell us what you need',
    formCopy: 'Describe the question to resolve. We will contact you to qualify the scope and required expertise.',
    name: 'Full name', company: 'Company', email: 'Business email', phone: 'Phone', situation: 'What do you need verified?', message: 'Questions and items to verify', deadline: 'Preferred timeframe', budget: 'Indicative budget', send: 'Send request',
    placeholder: 'Describe the situation and the questions you need answered.', requestDocuments: 'Documents useful for your request', success: 'Request sent. Scope-Verify will contact you to qualify your need.', partnerLink: 'Apply to the partner network', login: 'Client area', footer: 'Scope-Verify coordinates your request and organizes the appropriate response.',
  },
} satisfies Record<Language, Record<string, string | string[]>>

function Brand() {
  return <span className="sv-brand">
    <span className="sv-mark" aria-hidden="true"><i /></span>
    <span className="sv-brand-copy"><span className="sv-brand-name">Scope<span>-</span><b>Verify</b></span><small>FIELD VERIFICATION</small></span>
  </span>
}

export default function PublicHome({ onPartnerSignup, onLogin }: { onPartnerSignup: () => void; onLogin: () => void }) {
  const [language, setLanguage] = useState<Language>('fr')
  const [partners, setPartners] = useState<PublicPartner[]>([])
  const [partnerLogos, setPartnerLogos] = useState<PartnerLogo[]>([])
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [siteValues, setSiteValues] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<PublicSettings>({ contact_email: 'contact@scopeverify-services.com', contact_phone: '', phone_display_enabled: 'false', whatsapp_number: '', whatsapp_display_enabled: 'false', mission_form_enabled: 'true' })
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const t = translations[language]

  useEffect(() => {
    if (!supabase) return
    void supabase.from('partner_public_directory')
      .select('id,public_name,public_summary,public_domains,public_country,public_area,public_website,public_logo_path')
      .eq('is_visible', true).order('public_name')
      .then(({ data }) => setPartners((data || []) as PublicPartner[]))
    void supabase.from('site_content').select('section,key,language,content').then(({ data }) => {
      if (!data) return
      setPartnerLogos(data.map(parsePartnerLogo).filter((item): item is PartnerLogo => item !== null))
      setTestimonials(data.map(parseTestimonial).filter((item): item is Testimonial =>
        item !== null && item.is_published && item.consent_confirmed,
      ))
      setSiteValues(Object.fromEntries(data.map((row) => [`${row.language}.${row.section}.${row.key}`, row.content])))
    })
    void supabase.from('site_settings').select('key,value').then(({ data }) => {
      if (!data) return
      const values = Object.fromEntries(data.map((row) => [row.key, row.value]))
      setSettings((current) => ({ ...current, ...values }))
    })
  }, [])

  const text = (section: string, key: string, fallback: string) => siteValues[`${language}.${section}.${key}`] || fallback
  const list = (section: string, key: string, fallback: string[]) => text(section, key, fallback.join('\n')).split('\n').map((item) => item.trim()).filter(Boolean)
  const heroTitle = text('hero', 'main_title', t.title as string)
  const heroSubtitle = text('hero', 'subtitle', t.intro as string)
  const audienceSummary = text('audience', 'summary', t.audience as string)
  const needs = list('needs', 'items', t.needs as string[])
  const steps = list('process', 'steps', t.steps as string[])
  const networkSummary = text('network', 'summary', t.networkCopy as string)
  const domains = list('network', 'domains', t.domains as string[])
  const offices = text('zones', 'offices', t.offices as string)
  const clientZones = text('zones', 'markets', t.clientZones as string)
  const requestTitle = text('contact', 'title', t.formTitle as string)
  const requestButton = text('contact', 'button', t.cta as string)

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const message = [
      String(form.get('situation') || '') && `Besoin : ${form.get('situation')}`,
      String(form.get('message') || ''),
      String(form.get('deadline') || '') && `Délai souhaité : ${form.get('deadline')}`,
      String(form.get('budget') || '') && `Budget indicatif : ${form.get('budget')}`,
    ].filter(Boolean).join('\n\n')
    try {
      const request = contactSchema.parse({
        name: String(form.get('name') || ''), company: String(form.get('company') || ''),
        email: String(form.get('email') || ''), phone, mission: message,
      })
      if (!supabase) throw new Error('Le service est temporairement indisponible.')
      const { error: insertError } = await supabase.from('contact_requests').insert(request)
      if (insertError) throw insertError
      void fetch('/api/contact-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
      setSent(true)
      formElement.reset()
      setPhone('')
    } catch (err) {
      setError(getErrorMessage(err) || 'Vérifiez les informations saisies.')
    }
  }

  const getLogoUrl = (path: string | null) => {
    if (!path || !supabase) return ''
    return supabase.storage.from('partner-public-assets').getPublicUrl(path).data.publicUrl
  }

  return <main className="sv-home">
    <header className="sv-header">
      <a className="sv-brand-link" href="#home" aria-label="Scope-Verify accueil"><Brand /></a>
      <nav aria-label="Navigation principale">{t.nav.map((label, index) => <a key={label} href={['#who', '#needs', '#network', '#zones'][index]}>{label}</a>)}</nav>
      <div className="sv-header-actions"><div className="sv-language"><button className={language === 'fr' ? 'active' : ''} onClick={() => setLanguage('fr')}>FR</button><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button></div><button className="sv-login" onClick={onLogin}>{t.login}</button><button className="sv-button sv-partner-cta" onClick={onPartnerSignup}>{t.partnerCta} <span aria-hidden="true">↗</span></button></div>
    </header>
    <section className="sv-hero" id="home">
      <div className="sv-hero-grid" aria-hidden="true" />
      <p className="sv-eyebrow">SCOPE-VERIFY · COORDINATION DE MISSIONS TERRAIN</p>
      <h1>{heroTitle.split('\n').map((line, index) => <span key={`${index}-${line}`}>{line}{index === 0 && <br />}</span>)}</h1>
      <p className="sv-lede">{heroSubtitle}</p>
      <a href="#request" className="sv-button sv-button-light">{requestButton} <span aria-hidden="true">↘</span></a>
      <div className="sv-hero-bottom"><span>FRANCE <i /> MAROC</span><span>UN INTERLOCUTEUR POUR CHAQUE DEMANDE</span></div>
    </section>
    <section className="sv-audience" id="who"><div><p className="sv-eyebrow">POUR QUI</p><h2>{t.audienceTitle}</h2></div><p>{audienceSummary}</p></section>
    <section className="sv-needs" id="needs"><div className="sv-section-heading"><p className="sv-eyebrow">BESOINS TERRAIN</p><h2>{t.needsTitle}</h2></div><ul>{needs.map((need, index) => <li key={need}><span>{String(index + 1).padStart(2, '0')}</span>{need}</li>)}</ul></section>
    <section className="sv-process"><div className="sv-section-heading"><p className="sv-eyebrow">UN PARCOURS SIMPLE</p><h2>{t.howTitle}</h2></div><ol>{steps.map((step, index) => <li key={`${index}-${step}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol></section>
    <section className="sv-network" id="network"><div className="sv-network-copy"><p className="sv-eyebrow">AVEC QUI</p><h2>{t.networkTitle}</h2><p>{networkSummary}</p><ul>{domains.map((domain) => <li key={domain}>{domain}</li>)}</ul></div><div className="sv-network-note"><span className="sv-network-symbol" aria-hidden="true">◎</span><p>Scope-Verify ne revendique pas les qualifications de ses partenaires. Chaque mission est confiée selon les compétences requises.</p></div></section>
    {partnerLogos.length > 0 && <section className="sv-logo-wall" aria-label={language === 'fr' ? 'Partenaires' : 'Partners'}>
      <div className="sv-logo-heading"><p className="sv-eyebrow">{language === 'fr' ? 'RÉSEAU PARTENAIRE' : 'PARTNER NETWORK'}</p><h2>{language === 'fr' ? 'Des partenaires mobilisés sur le terrain' : 'Partners working on the ground'}</h2></div>
      <div className="sv-logo-window"><div className="sv-logo-track">{[...partnerLogos, ...partnerLogos].map((partnerLogo, index) => {
        const content = <><img src={supabase?.storage.from('partner-public-assets').getPublicUrl(partnerLogo.logo_path).data.publicUrl} alt="" loading="lazy" /><span>{partnerLogo.name}</span></>
        return <div className="sv-logo-item" key={`${partnerLogo.id}-${index}`}>
          {partnerLogo.website ? <a href={partnerLogo.website} target="_blank" rel="noreferrer" aria-label={`${partnerLogo.name} (site externe)`}>{content}</a> : content}
        </div>
      })}</div></div>
    </section>}
    <section className="sv-zones" id="zones"><div><p className="sv-eyebrow">OÙ</p><h2>{t.zoneTitle}</h2></div><div><p>{offices}</p><p>{clientZones}</p><small>Le périmètre peut évoluer par pays selon la demande et les compétences disponibles.</small></div></section>
    {testimonials.length > 0 && <section className="sv-testimonials">
      <div className="sv-testimonial-heading"><p className="sv-eyebrow">{language === 'fr' ? 'RETOURS D’EXPÉRIENCE' : 'CLIENT FEEDBACK'}</p><h2>{language === 'fr' ? 'Leurs retours sur nos missions' : 'What they say about our work'}</h2></div>
      <div className="sv-testimonial-list">{testimonials.map((testimonial) => <figure key={testimonial.id}>
        <blockquote>{language === 'en' && testimonial.quote_en.trim() ? testimonial.quote_en : testimonial.quote_fr}</blockquote>
        <figcaption><strong>{testimonial.name}</strong><span>{[testimonial.role, testimonial.organization].filter(Boolean).join(' · ')}</span></figcaption>
      </figure>)}</div>
    </section>}
    <section className="sv-request" id="request"><div><p className="sv-eyebrow">VOTRE DEMANDE</p><h2>{requestTitle}</h2><p>{t.formCopy}</p><button className="sv-text-button" onClick={onLogin}>{t.login} <span aria-hidden="true">↗</span></button><div className="sv-contact-links"><a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>{settings.phone_display_enabled === 'true' && settings.contact_phone && <a href={`tel:${settings.contact_phone.replace(/[^\d+]/g, '')}`}>{settings.contact_phone}</a>}{settings.whatsapp_display_enabled === 'true' && settings.whatsapp_number.replace(/\D/g, '') && <a href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}</div></div>{settings.mission_form_enabled !== 'false' ? <form onSubmit={submitRequest}>
      <div className="sv-form-row"><label>{t.name}<input name="name" required minLength={2} autoComplete="name" /></label><label>{t.company}<input name="company" autoComplete="organization" /></label></div>
      <div className="sv-form-row"><label>{t.email}<input name="email" required type="email" autoComplete="email" /></label><label>{t.phone}<input name="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label></div>
      <label>{t.situation}<select name="situation" defaultValue=""><option value="">{language === 'fr' ? 'Choisir ou préciser dans le message' : 'Choose or describe below'}</option>{needs.map((need) => <option key={need}>{need}</option>)}</select></label>
      <label>{t.message}<textarea name="message" required minLength={10} rows={3} placeholder={t.placeholder} /></label>
      <div className="sv-form-row"><label>{t.deadline}<input name="deadline" placeholder={language === 'fr' ? 'Ex. avant le 15 novembre' : 'e.g. by November 15'} /></label><label>{t.budget}<input name="budget" placeholder="EUR / USD" /></label></div>
      <PublishedDocumentLinks allVisible publicOnly title="Documents publiés" language={language} />
      {error && <p className="sv-message error" role="alert">{error}</p>}{sent && <p className="sv-message" role="status">{t.success}</p>}
      <button className="sv-button sv-submit" type="submit">{requestButton} <span aria-hidden="true">↗</span></button>
      <p className="sv-partner-link"><button type="button" onClick={onPartnerSignup}>{t.partnerLink}</button></p>
    </form> : <div className="sv-form-disabled"><p>{language === 'fr' ? 'Le formulaire de demande est temporairement désactivé.' : 'The request form is temporarily unavailable.'}</p><a href={`mailto:${settings.contact_email}`}>{language === 'fr' ? 'Contacter Scope-Verify par email' : 'Contact Scope-Verify by email'} ↗</a></div>}</section>
    {partners.length > 0 && <section className="sv-partners" aria-label={t.partners}><p className="sv-eyebrow">{t.partners}</p><div className="sv-partner-track">{[...partners, ...partners].map((partner, index) => <article key={`${partner.id}-${index}`} className="sv-partner-item">
      {partner.public_logo_path && <img src={getLogoUrl(partner.public_logo_path)} alt="" loading="lazy" />}
      <div><strong>{partner.public_name || 'Partenaire Scope-Verify'}</strong><p>{partner.public_summary}</p><small>{[partner.public_domains.join(' · '), partner.public_country, partner.public_area].filter(Boolean).join(' · ')}</small></div>
      {partner.public_website && <a href={partner.public_website} target="_blank" rel="noreferrer" aria-label={`Site de ${partner.public_name}`}>↗</a>}
    </article>)}</div></section>}
    <footer className="sv-footer"><a className="sv-brand-link" href="#home" aria-label="Scope-Verify accueil"><Brand /></a><p>{t.footer}</p><button onClick={onPartnerSignup}>{t.partnerLink}</button></footer>
  </main>
}
