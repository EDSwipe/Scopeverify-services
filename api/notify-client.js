import { getAuthenticatedUser } from './_supabaseAuth.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthenticatedUser(request)
  if (!user) return response.status(401).json({ error: 'Unauthorized' })

  const { clientEmail, clientName, missionTitle, event } = request.body ?? {}
  if (!clientEmail || !missionTitle) return response.status(400).json({ error: 'Missing mission details' })

  const name = clientName || ''
  const messages = {
    started: {
      subject: `Votre mission "${missionTitle}" est en cours`,
      text: `Bonjour ${name},\n\nUn collaborateur a démarré votre mission "${missionTitle}" sur le terrain.\n\nVous serez notifié dès que le rapport sera vérifié et validé par notre équipe.\n\nCordialement,\nL'équipe SCOPE-VERIFY`,
    },
    validated: {
      subject: `Votre mission "${missionTitle}" a été validée`,
      text: `Bonjour ${name},\n\nVotre mission "${missionTitle}" vient d'être vérifiée et validée par notre équipe.\n\nLe rapport (observations, résultats et photos) est disponible dans votre tableau de bord client sur scopeverify-services.com.\n\nCordialement,\nL'équipe SCOPE-VERIFY`,
    },
  }
  const { subject, text } = messages[event] || messages.validated

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SCOPE-VERIFY <notifications@scopeverify-services.com>',
      to: [clientEmail],
      subject,
      text,
    }),
  })

  if (!emailResponse.ok) {
    const error = await emailResponse.text()
    console.error('Resend client notification failed:', error)
    return response.status(502).json({ error: 'Notification could not be sent' })
  }

  return response.status(200).json({ sent: true })
}
