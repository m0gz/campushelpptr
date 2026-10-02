import pg from 'pg'
const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const mapTicket = (row) => ({ id: row.id, subject: row.subject, category: row.category, suggestedCategory: row.suggested_category, description: row.description, suggestedPriority: row.suggested_priority, priority: row.priority, priorityManuallyEscalated: row.priority_manually_escalated, status: row.status, requesterId: row.requester_id, requesterType: row.requester_type, requesterName: row.requester_name, requesterEmail: row.requester_email, assignedTo: row.assigned_to, createdAt: row.created_at, updatedAt: row.updated_at, messages: row.messages, internalNotes: row.internal_notes, history: row.history })
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  try {
    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM campushelp_tickets ORDER BY created_at DESC')
      return res.status(200).json(result.rows.map(mapTicket))
    }
    if (req.method === 'POST') {
      const t = req.body || {}
      if (!t.id || !t.subject || !t.description || !t.requesterId) return res.status(400).json({ error: 'Missing required ticket fields.' })
      await pool.query(`INSERT INTO campushelp_tickets (id,subject,category,suggested_category,description,suggested_priority,priority,priority_manually_escalated,status,requester_id,requester_type,requester_name,requester_email,assigned_to,messages,internal_notes,history) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [t.id,t.subject,t.category || 'Other',t.suggestedCategory || null,t.description,t.suggestedPriority || null,t.priority || 'Normal',Boolean(t.priorityManuallyEscalated),'Open',t.requesterId,t.requesterType || 'Student',t.requesterName,t.requesterEmail,t.assignedTo || null,JSON.stringify(t.messages || []),JSON.stringify(t.internalNotes || []),JSON.stringify(t.history || [])])
      return res.status(201).json(t)
    }
    if (req.method === 'PATCH') {
      const t = req.body || {}
      const result = await pool.query(`UPDATE campushelp_tickets SET status=COALESCE($2,status), priority=COALESCE($3,priority), assigned_to=COALESCE($4,assigned_to), messages=COALESCE($5,messages), internal_notes=COALESCE($6,internal_notes), history=COALESCE($7,history), updated_at=now() WHERE id=$1 RETURNING *`, [t.id,t.status,t.priority,t.assignedTo,t.messages ? JSON.stringify(t.messages) : null,t.internalNotes ? JSON.stringify(t.internalNotes) : null,t.history ? JSON.stringify(t.history) : null])
      if (!result.rowCount) return res.status(404).json({ error: 'Ticket not found.' })
      return res.status(200).json(mapTicket(result.rows[0]))
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('[v0] ticket API error', error)
    return res.status(500).json({ error: 'Unable to complete the ticket request.' })
  }
}
