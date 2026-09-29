export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const { name, company, email, phone, mission } = request.body ?? {}
  if (!name || !email || !mission) return response.status(400).json({ error: 'Missing contact details' })

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SCOPE-VERIFY <notifications@scopeverify-services.com>',
      to: ['contact@scopeverify-services.com', process.env.VITE_ADMIN_EMAIL || 'sotbirida@yahoo.fr'],
      reply_to: email,
      subject: `Nouvelle demande SCOPE-VERIFY - ${name}`,
      text: `Nouvelle demande reçue\n\nNom : ${name}\nSociété : ${company || 'Non renseignée'}\nE-mail : ${email}\nTéléphone : ${phone || 'Non renseigné'}\n\nMission :\n${mission}`,
    }),
  })

  if (!emailResponse.ok) {
    const error = await emailResponse.text()
    console.error('Resend notification failed:', error)
    return response.status(502).json({ error: 'Notification could not be sent' })
  }

  return response.status(200).json({ sent: true })
}