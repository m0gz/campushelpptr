import bcrypt from 'bcryptjs'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

function json(res, status, body) {
  res.status(status).json(body)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const { action, username, email, password, name, accountType, universityId, department } = req.body || {}
  if (!password || (action === 'register' ? (!email || !name) : !username)) return json(res, 400, { error: 'Missing required fields.' })

  try {
    if (action === 'register') {
      const normalizedEmail = email.trim().toLowerCase()
      const existing = await pool.query('SELECT id FROM campushelp_users WHERE email = $1', [normalizedEmail])
      if (existing.rowCount) return json(res, 409, { error: 'This email address is already registered.' })
      const user = {
        id: crypto.randomUUID(), username: normalizedEmail.split('@')[0], email: normalizedEmail,
        name: name.trim(), role: 'user', accountType: accountType || 'Student',
        department: department || accountType || 'Student', universityId: universityId || 'Pending',
      }
      const passwordHash = await bcrypt.hash(password, 12)
      await pool.query(`INSERT INTO campushelp_users (id, username, email, password_hash, role, account_type, name, department, university_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [user.id, user.username, user.email, passwordHash, user.role, user.accountType, user.name, user.department, user.universityId])
      return json(res, 201, user)
    }

    const result = await pool.query(`SELECT id, username, email, password_hash, role, account_type, name, department, university_id
      FROM campushelp_users WHERE username = $1 OR email = $1 LIMIT 1`, [username.trim().toLowerCase()])
    const row = result.rows[0]
    if (!row || !(await bcrypt.compare(password, row.password_hash))) return json(res, 401, { error: 'Invalid username or password.' })
    return json(res, 200, { id: row.university_id || row.id, userId: row.id, username: row.username, email: row.email, role: row.role, accountType: row.account_type, name: row.name, department: row.department, universityId: row.university_id })
  } catch (error) {
    console.error('[v0] auth API error', error)
    return json(res, 500, { error: 'Unable to complete the request.' })
  }
}
