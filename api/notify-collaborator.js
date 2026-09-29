import { getAuthenticatedUser } from './_supabaseAuth.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthenticatedUser(request)
  if (!user) return response.status(401).json({ error: 'Unauthorized' })

  const { collaboratorEmail, collaboratorName, missionTitle, missionLocation } = request.body ?? {}
  if (!collaboratorEmail || !missionTitle) return response.status(400).json({ error: 'Missing mission details' })

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SCOPE-VERIFY <notifications@scopeverify-services.com>',
      to: [collaboratorEmail],
      subject: `Nouvelle mission assignée : ${missionTitle}`,
      text: `Bonjour ${collaboratorName || ''},\n\nUne nouvelle mission vient de vous être assignée.\n\nMission : ${missionTitle}${missionLocation ? `\nLieu : ${missionLocation}` : ''}\n\nConnectez-vous à votre tableau de bord collaborateur sur scopeverify-services.com pour consulter les détails et démarrer la mission.\n\nCordialement,\nL'équipe SCOPE-VERIFY`,
    }),
  })

  if (!emailResponse.ok) {
    const error = await emailResponse.text()
    console.error('Resend collaborator notification failed:', error)
    return response.status(502).json({ error: 'Notification could not be sent' })
  }

  return response.status(200).json({ sent: true })
}
