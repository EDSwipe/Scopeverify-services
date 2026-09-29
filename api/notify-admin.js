const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || 'sotbirida@yahoo.fr'

import { getAuthenticatedUser } from './_supabaseAuth.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthenticatedUser(request)
  if (!user) return response.status(401).json({ error: 'Unauthorized' })

  const { missionTitle, collaboratorName, event } = request.body ?? {}
  if (!missionTitle) return response.status(400).json({ error: 'Missing mission details' })

  const name = collaboratorName || 'Un collaborateur'
  const messages = {
    accepted: {
      subject: `Mission acceptée : ${missionTitle}`,
      text: `${name} a accepté la mission "${missionTitle}".\n\nConnectez-vous à votre tableau de bord administrateur pour suivre son avancement.`,
    },
    started: {
      subject: `Mission démarrée : ${missionTitle}`,
      text: `${name} a démarré (mise en cours) la mission "${missionTitle}".\n\nConnectez-vous à votre tableau de bord administrateur pour suivre son avancement.`,
    },
    completed: {
      subject: `Mission à valider : ${missionTitle}`,
      text: `Une mission vient d'être clôturée et attend votre validation.\n\nMission : ${missionTitle}\nSoumise par : ${name}\n\nConnectez-vous à votre tableau de bord administrateur pour vérifier, corriger ou valider le travail avant transmission au client.`,
    },
  }
  const { subject, text } = messages[event] || messages.completed

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SCOPE-VERIFY <notifications@scopeverify-services.com>',
      to: [ADMIN_EMAIL],
      subject,
      text,
    }),
  })

  if (!emailResponse.ok) {
    const error = await emailResponse.text()
    console.error('Resend admin notification failed:', error)
    return response.status(502).json({ error: 'Notification could not be sent' })
  }

  return response.status(200).json({ sent: true })
}
