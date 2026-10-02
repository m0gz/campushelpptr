import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campushelp';

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon') ? { rejectUnauthorized: false } : false
});

export function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

export function isMapuaEmail(email = '', accountType = 'Student') {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) return false;

  if (accountType === 'Faculty') {
    return normalized.endsWith('@mymail.mapua.edu.ph');
  }

  if (accountType === 'Student') {
    return normalized.endsWith('@mymail.mapua.edu.ph');
  }

  return normalized.endsWith('@mapua.edu.ph');
}

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGSERIAL PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      role VARCHAR(30) NOT NULL CHECK (role IN ('User', 'IT Staff', 'Administrator')),
      account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('Student', 'Faculty', 'IT Staff', 'Administrator')),
      student_number VARCHAR(30),
      employee_id VARCHAR(30),
      department VARCHAR(100),
      ecm_file_path VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id BIGSERIAL PRIMARY KEY,
      requester_id BIGINT NOT NULL REFERENCES users(user_id),
      assigned_staff_id BIGINT REFERENCES users(user_id),
      subject VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      suggested_category VARCHAR(100),
      priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
      suggested_priority VARCHAR(20) CHECK (suggested_priority IS NULL OR suggested_priority IN ('Low', 'Medium', 'High', 'Urgent')),
      priority_manually_escalated BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(30) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
      message_id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
      sender_id BIGINT NOT NULL REFERENCES users(user_id),
      message TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(user_id),
      ticket_id BIGINT REFERENCES tickets(ticket_id) ON DELETE CASCADE,
      message VARCHAR(255) NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(user_id),
      ticket_id BIGINT REFERENCES tickets(ticket_id) ON DELETE SET NULL,
      action VARCHAR(150) NOT NULL,
      action_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR(255) PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned_staff_id ON tickets(assigned_staff_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
  `);
}

export async function seedDefaultAccounts() {
  const adminHash = await bcrypt.hash('admin', 10);
  const staffHash = await bcrypt.hash('staff123', 10);

  await pool.query(
    `
      INSERT INTO users (
        full_name, email, password_hash, role, account_type, department
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING
    `,
    ['CampusHelp Administrator', 'admin@mapua.edu.ph', adminHash, 'Administrator', 'Administrator', 'Information Technology']
  );

  await pool.query(
    `
      INSERT INTO users (
        full_name, email, password_hash, role, account_type, department
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING
    `,
    ['IT Support Desk', 'itstaff@mapua.edu.ph', staffHash, 'IT Staff', 'IT Staff', 'Information Technology']
  );
}

export function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.user_id,
    user_id: user.user_id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    account_type: user.account_type,
    must_change_password: Boolean(user.must_change_password),
    student_number: user.student_number,
    employee_id: user.employee_id,
    department: user.department,
    ecm_file_path: user.ecm_file_path,
    created_at: user.created_at
  };
}

export async function logAudit(userId, ticketId, action) {
  await pool.query(
    `INSERT INTO audit_logs (user_id, ticket_id, action) VALUES ($1, $2, $3)`,
    [userId, ticketId ?? null, action]
  );
}

export async function createNotification(userId, ticketId, message) {
  if (!userId) return;

  await pool.query(
    `INSERT INTO notifications (user_id, ticket_id, message) VALUES ($1, $2, $3)`,
    [userId, ticketId ?? null, message]
  );
}
