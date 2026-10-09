const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || 'sotbirida@yahoo.fr'

import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from './_supabaseAuth.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthenticatedUser(request)
  if (!user) return response.status(401).json({ error: 'Unauthorized' })

  const { missionTitle: requestedMissionTitle, collaboratorName, event, missionId } = request.body ?? {}
  let missionTitle = requestedMissionTitle
  let name = collaboratorName || 'Un collaborateur'

  if (event === 'submitted') {
    if (!missionId) return response.status(400).json({ error: 'Missing mission ID' })
    const authHeader = request.headers.authorization || request.headers.Authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
    if (!token || !supabaseUrl || !supabaseAnonKey) return response.status(503).json({ error: 'Mission verification is not configured' })

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: mission, error: missionError } = await userClient
      .from('missions')
      .select('title,status')
      .eq('id', missionId)
      .eq('client_id', caller.id)
      .maybeSingle()
    if (missionError || !mission) return response.status(403).json({ error: 'Mission not found for this client' })
    if (mission.status !== 'submitted') return response.status(409).json({ error: 'Mission has not been submitted' })

    missionTitle = mission.title
    name = caller.user_metadata?.full_name || caller.email || 'Un client'
  }

  if (!missionTitle) return response.status(400).json({ error: 'Missing mission details' })

  const messages = {
    submitted: {
      subject: `Nouvelle demande de mission : ${missionTitle}`,
      text: `${name} vient d'envoyer une nouvelle demande de mission :\n\n${missionTitle}\n\nConnectez-vous au tableau de bord pour la qualifier et la traiter.`,
    },
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
