export type PositioningLanguage = 'fr' | 'en'

export interface PositioningContentSeed {
  section: 'hero' | 'intro' | 'situations' | 'limits'
  key: string
  language: PositioningLanguage
  content: string
}

export const positioningCopy: Record<PositioningLanguage, Record<string, string>> = {
  fr: {
    hero_positioning_eyebrow: 'Vérification terrain indépendante',
    hero_positioning_title_1: 'Vérifiez sur place',
    hero_positioning_title_2: 'avant votre décision.',
    hero_positioning_text: 'Vous devez évaluer un fournisseur, suivre une production ou documenter un projet sans pouvoir vous déplacer ? SCOPE-VERIFY vérifie sur place les points définis ensemble et vous remet des constats documentés.',
    hero_positioning_audience: 'Pour les entreprises qui doivent décider à distance.',
    hero_positioning_action: 'Décrire ma situation',
    intro_positioning_title_1: 'Décider à distance',
    intro_positioning_title_2: 'avec des faits.',
    intro_positioning_text: 'Avant de référencer un partenaire, de valider une étape de production ou d’engager un projet, vous avez besoin de savoir ce qui est effectivement observable sur place. Nous cadrons les points à vérifier, réalisons la visite et vous transmettons les éléments constatés, les preuves disponibles et les limites de la mission.',
    deliverables_delivery_time: 'Le compte rendu est remis sous 48 h après la fin de la vérification sur site.',
    situations_tag: 'Quand intervenir',
    situations_title: 'Trois situations concrètes',
    situations_subtitle: 'Un périmètre défini avant la visite. Des constats utiles à votre prochaine décision.',
    situations_item_1_title: 'Avant de référencer un fournisseur',
    situations_item_1_text: 'Documenter l’existence du site, l’activité visible, les équipements et l’environnement observé.',
    situations_item_2_title: 'Avant une étape de production ou d’expédition',
    situations_item_2_text: 'Vérifier sur place l’avancement, les références ou le conditionnement selon les points convenus.',
    situations_item_3_title: 'Pour suivre un projet à distance',
    situations_item_3_text: 'Observer l’état d’avancement, la configuration visible et les éléments accessibles au moment de la visite.',
    limits_positioning_title: 'La compétence adaptée à chaque mission.',
    limits_positioning_text: 'Scope-Verify qualifie chaque demande. Lorsqu’une compétence spécialisée est requise, la mission est confiée à un partenaire adapté et sa restitution est organisée par Scope-Verify.',
  },
  en: {
    hero_positioning_eyebrow: 'Independent field verification',
    hero_positioning_title_1: 'Verify on site',
    hero_positioning_title_2: 'before you decide.',
    hero_positioning_text: 'Need to assess a supplier, follow production or document a project without travelling? SCOPE-VERIFY checks the agreed points on site and provides documented findings.',
    hero_positioning_audience: 'For businesses making decisions from a distance.',
    hero_positioning_action: 'Describe your situation',
    intro_positioning_title_1: 'Make decisions',
    intro_positioning_title_2: 'with facts.',
    intro_positioning_text: 'Before approving a supplier, a production milestone or a project, you need to know what can actually be observed on site. We agree the checks, carry out the visit and report observations, available evidence and the limits of the mission.',
    deliverables_delivery_time: 'The report is delivered within 48 hours after the on-site verification is complete.',
    situations_tag: 'When to call us',
    situations_title: 'Three concrete situations',
    situations_subtitle: 'An agreed scope before the visit. Findings that inform your next decision.',
    situations_item_1_title: 'Before approving a supplier',
    situations_item_1_text: 'Document the site’s existence, visible activity, equipment and observed environment.',
    situations_item_2_title: 'Before a production or shipping milestone',
    situations_item_2_text: 'Check progress, references or packaging on site against the agreed points.',
    situations_item_3_title: 'To follow a project remotely',
    situations_item_3_text: 'Observe visible progress, layout and accessible items at the time of the visit.',
    limits_positioning_title: 'The right expertise for each mission.',
    limits_positioning_text: 'Scope-Verify qualifies each request. When specialist expertise is required, the work is assigned to a suitable partner and its findings are coordinated by Scope-Verify.',
  },
}

export const positioningContentSeeds: PositioningContentSeed[] = Object.entries(positioningCopy).flatMap(([language, values]) => {
  const entries: [PositioningContentSeed['section'], string, string][] = [
    ['hero', 'positioning_eyebrow', values.hero_positioning_eyebrow],
    ['hero', 'positioning_title_1', values.hero_positioning_title_1],
    ['hero', 'positioning_title_2', values.hero_positioning_title_2],
    ['hero', 'positioning_text', values.hero_positioning_text],
    ['hero', 'positioning_audience', values.hero_positioning_audience],
    ['hero', 'positioning_action', values.hero_positioning_action],
    ['intro', 'positioning_title_1', values.intro_positioning_title_1],
    ['intro', 'positioning_title_2', values.intro_positioning_title_2],
    ['intro', 'positioning_text', values.intro_positioning_text],
    ['deliverables', 'delivery_time', values.deliverables_delivery_time],
    ['situations', 'tag', values.situations_tag],
    ['situations', 'title', values.situations_title],
    ['situations', 'subtitle', values.situations_subtitle],
    ['situations', 'item_1_title', values.situations_item_1_title],
    ['situations', 'item_1_text', values.situations_item_1_text],
    ['situations', 'item_2_title', values.situations_item_2_title],
    ['situations', 'item_2_text', values.situations_item_2_text],
    ['situations', 'item_3_title', values.situations_item_3_title],
    ['situations', 'item_3_text', values.situations_item_3_text],
    ['limits', 'positioning_title', values.limits_positioning_title],
    ['limits', 'positioning_text', values.limits_positioning_text],
  ]

  return entries.map(([section, key, content]) => ({
    section,
    key,
    language: language as PositioningLanguage,
    content,
  }))
})