import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import {
  pool,
  ensureSchema,
  seedDefaultAccounts,
  normalizeEmail,
  isMapuaEmail,
  sanitizeUser,
  logAudit,
  createNotification
} from './db.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.VERCEL
  ? path.join('/tmp', 'campushelp-uploads')
  : path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const PgSessionStore = pgSession(session);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'campushelp-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 10
    }
  })
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF, PNG, and JPG files are allowed for ECM documents.'));
  }
});

app.use('/uploads', express.static(uploadDir));

async function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.session.userId]);
    if (!result.rows[0]) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Session invalid or expired.' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth lookup failed:', error);
    return res.status(500).json({ message: 'Unable to verify session.' });
  }
}

function allowRole(req, allowedRoles) {
  if (!req.user) return false;
  return allowedRoles.includes(req.user.role);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'CampusHelp API is running.' });
});

app.post('/api/auth/register', upload.single('ecm'), async (req, res) => {
  try {
    const fullName = String(req.body.full_name || req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email || req.body.emailAddress || '');
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || req.body.confirm_password || '');
    const accountType = String(req.body.account_type || req.body.accountType || 'Student');
    const studentNumber = String(req.body.student_number || req.body.studentNumber || '').trim();
    const employeeId = String(req.body.employee_id || req.body.employeeId || '').trim();
    const department = String(req.body.department || '').trim();

    if (!fullName) {
      return res.status(400).json({ message: 'Full name is required.' });
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    if (!['Student', 'Faculty'].includes(accountType)) {
      return res.status(400).json({ message: 'Invalid account type.' });
    }

    if (!isMapuaEmail(email, accountType)) {
      return res.status(400).json({ message: 'Mapúa email is required. Use your @mymail.mapua.edu.ph address.' });
    }

    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    if (accountType === 'Student') {
      if (!studentNumber) {
        return res.status(400).json({ message: 'Student number is required.' });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'Student ECM upload is required.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ecmFilePath = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      `
        INSERT INTO users (
          full_name,
          email,
          password_hash,
          role,
          account_type,
          student_number,
          employee_id,
          department,
          ecm_file_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        fullName,
        email,
        passwordHash,
        'User',
        accountType,
        accountType === 'Student' ? studentNumber : null,
        accountType === 'Faculty' ? employeeId || null : null,
        department || null,
        ecmFilePath
      ]
    );

    const user = sanitizeUser(result.rows[0]);
    req.session.userId = user.user_id;
    await logAudit(user.user_id, null, 'Registration');

    return res.status(201).json({ message: 'Registration successful.', user });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message && error.message.includes('Only PDF')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || req.body.emailAddress || '');
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    req.session.userId = user.user_id;
    await logAudit(user.user_id, null, 'Login');

    return res.json({ message: 'Login successful.', user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: 'Unable to log out.' });
    }
    return res.json({ message: 'Logged out.' });
  });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.session.userId]);
    if (!result.rows[0]) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Session invalid or expired.' });
    }
    return res.json({ user: sanitizeUser(result.rows[0]) });
  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json({ message: 'Unable to load session.' });
  }
});

app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const query =
      req.user.role === 'User'
        ? 'SELECT t.*, requester.full_name AS requester_name, assigned.full_name AS assigned_staff_name FROM tickets t LEFT JOIN users requester ON requester.user_id = t.requester_id LEFT JOIN users assigned ON assigned.user_id = t.assigned_staff_id WHERE t.requester_id = $1 ORDER BY t.created_at DESC'
        : 'SELECT t.*, requester.full_name AS requester_name, assigned.full_name AS assigned_staff_name FROM tickets t LEFT JOIN users requester ON requester.user_id = t.requester_id LEFT JOIN users assigned ON assigned.user_id = t.assigned_staff_id ORDER BY t.created_at DESC';

    const params = req.user.role === 'User' ? [req.user.user_id] : [];
    const result = await pool.query(query, params);
    return res.json({ tickets: result.rows });
  } catch (error) {
    console.error('List tickets error:', error);
    return res.status(500).json({ message: 'Unable to load tickets.' });
  }
});

app.get('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const ticketResult = await pool.query(
      `
        SELECT t.*, requester.full_name AS requester_name, assigned.full_name AS assigned_staff_name
        FROM tickets t
        LEFT JOIN users requester ON requester.user_id = t.requester_id
        LEFT JOIN users assigned ON assigned.user_id = t.assigned_staff_id
        WHERE t.ticket_id = $1
      `,
      [req.params.id]
    );

    const ticket = ticketResult.rows[0];
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    if (req.user.role === 'User' && ticket.requester_id !== req.user.user_id) {
      return res.status(403).json({ message: 'You are not authorized to view this ticket.' });
    }

    const messagesResult = await pool.query(
      `
        SELECT tm.*, u.full_name AS sender_name, u.email AS sender_email
        FROM ticket_messages tm
        LEFT JOIN users u ON u.user_id = tm.sender_id
        WHERE tm.ticket_id = $1
        ORDER BY tm.sent_at ASC
      `,
      [req.params.id]
    );

    return res.json({ ticket, messages: messagesResult.rows });
  } catch (error) {
    console.error('Fetch ticket error:', error);
    return res.status(500).json({ message: 'Unable to load ticket details.' });
  }
});

app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const subject = String(req.body.subject || '').trim();
    const description = String(req.body.description || '').trim();
    const category = String(req.body.category || 'Other').trim();
    const priority = String(req.body.priority || 'Medium');
    const suggestedCategory = String(req.body.suggested_category || '').trim();
    const suggestedPriority = String(req.body.suggested_priority || '').trim();
    const priorityManuallyEscalated = Boolean(req.body.priority_manually_escalated);

    if (!subject || !description) {
      return res.status(400).json({ message: 'Subject and description are required.' });
    }

    const result = await pool.query(
      `
        INSERT INTO tickets (
          requester_id,
          subject,
          description,
          category,
          suggested_category,
          priority,
          suggested_priority,
          priority_manually_escalated,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open')
        RETURNING *
      `,
      [
        req.user.user_id,
        subject,
        description,
        category,
        suggestedCategory || null,
        priority,
        suggestedPriority || null,
        priorityManuallyEscalated
      ]
    );

    const ticket = result.rows[0];
    const staffUsers = await pool.query(`SELECT user_id FROM users WHERE role IN ('IT Staff', 'Administrator')`);
    for (const staffUser of staffUsers.rows) {
      await createNotification(staffUser.user_id, ticket.ticket_id, `New ticket: ${subject}`);
    }

    await logAudit(req.user.user_id, ticket.ticket_id, 'Ticket creation');
    return res.status(201).json({ message: 'Ticket submitted successfully.', ticket });
  } catch (error) {
    console.error('Create ticket error:', error);
    return res.status(500).json({ message: 'Ticket submission failed.' });
  }
});

app.patch('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const existing = await pool.query('SELECT * FROM tickets WHERE ticket_id = $1', [ticketId]);

    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    const ticket = existing.rows[0];
    const isStaff = allowRole(req, ['IT Staff', 'Administrator']);
    const isRequester = ticket.requester_id === req.user.user_id;

    if (!isStaff && !isRequester) {
      return res.status(403).json({ message: 'You do not have permission to update this ticket.' });
    }

    const status = String(req.body.status || ticket.status);
    const priority = String(req.body.priority || ticket.priority);
    const category = String(req.body.category || ticket.category);
    const assignedStaffId = req.body.assigned_staff_id !== undefined ? Number(req.body.assigned_staff_id) : ticket.assigned_staff_id;

    const updateResult = await pool.query(
      `
        UPDATE tickets
        SET status = $1,
            priority = $2,
            category = $3,
            assigned_staff_id = $4,
            updated_at = NOW(),
            resolved_at = CASE WHEN $1 = 'Resolved' OR $1 = 'Closed' THEN NOW() ELSE NULL END
        WHERE ticket_id = $5
        RETURNING *
      `,
      [status, priority, category, assignedStaffId, ticketId]
    );

    const updatedTicket = updateResult.rows[0];

    if (req.body.message && String(req.body.message).trim()) {
      await pool.query(
        `INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES ($1, $2, $3)`,
        [ticketId, req.user.user_id, String(req.body.message).trim()]
      );
      await createNotification(ticket.requester_id, ticketId, `New response on ticket #${ticketId}`);
      await logAudit(req.user.user_id, ticketId, 'IT Staff response');
    }

    if (ticket.requester_id !== req.user.user_id) {
      await createNotification(ticket.requester_id, ticketId, `Ticket status updated to ${status}.`);
    }

    await logAudit(req.user.user_id, ticketId, 'Ticket update');
    return res.json({ message: 'Ticket updated successfully.', ticket: updatedTicket });
  } catch (error) {
    console.error('Ticket patch error:', error);
    return res.status(500).json({ message: 'The ticket could not be updated.' });
  }
});

app.get('/api/tickets/:id/messages', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT tm.*, u.full_name AS sender_name, u.email AS sender_email
        FROM ticket_messages tm
        LEFT JOIN users u ON u.user_id = tm.sender_id
        WHERE tm.ticket_id = $1
        ORDER BY tm.sent_at ASC
      `,
      [req.params.id]
    );

    return res.json({ messages: result.rows });
  } catch (error) {
    console.error('Ticket messages error:', error);
    return res.status(500).json({ message: 'Unable to load conversation.' });
  }
});

app.post('/api/tickets/:id/messages', requireAuth, async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'Message content is required.' });
    }

    const ticket = await pool.query('SELECT * FROM tickets WHERE ticket_id = $1', [req.params.id]);
    if (!ticket.rows[0]) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    const result = await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.user_id, message]
    );

    const otherUserId = ticket.rows[0].requester_id === req.user.user_id
      ? ticket.rows[0].assigned_staff_id
      : ticket.rows[0].requester_id;

    if (otherUserId) {
      await createNotification(otherUserId, Number(req.params.id), 'A new ticket message was posted.');
    }

    await logAudit(req.user.user_id, Number(req.params.id), 'Ticket message sent');
    return res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Message create error:', error);
    return res.status(500).json({ message: 'Unable to send message.' });
  }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.user_id]
    );
    return res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Load notifications error:', error);
    return res.status(500).json({ message: 'Unable to load notifications.' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.user_id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    return res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ message: 'Unable to update notification.' });
  }
});

app.get('/api/admin/analytics', requireAuth, async (req, res) => {
  try {
    if (!allowRole(req, ['IT Staff', 'Administrator'])) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const totalResult = await pool.query('SELECT COUNT(*) AS count FROM tickets');
    const openResult = await pool.query("SELECT COUNT(*) AS count FROM tickets WHERE status = 'Open'");
    const inProgressResult = await pool.query("SELECT COUNT(*) AS count FROM tickets WHERE status = 'In Progress'");
    const resolvedResult = await pool.query("SELECT COUNT(*) AS count FROM tickets WHERE status IN ('Resolved', 'Closed')");

    const categoryResult = await pool.query(
      'SELECT category, COUNT(*) AS count FROM tickets GROUP BY category ORDER BY count DESC LIMIT 8'
    );

    const statusResult = await pool.query(
      'SELECT status, COUNT(*) AS count FROM tickets GROUP BY status ORDER BY count DESC'
    );

    const timeResult = await pool.query(
      'SELECT DATE(created_at) AS date, COUNT(*) AS count FROM tickets GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 10'
    );

    return res.json({
      totals: {
        total: Number(totalResult.rows[0]?.count || 0),
        open: Number(openResult.rows[0]?.count || 0),
        inProgress: Number(inProgressResult.rows[0]?.count || 0),
        resolved: Number(resolvedResult.rows[0]?.count || 0)
      },
      byCategory: categoryResult.rows,
      byStatus: statusResult.rows,
      overTime: timeResult.rows
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return res.status(500).json({ message: 'Unable to load analytics.' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ message: 'Unexpected server error.' });
});

const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

let databaseInitialization;

export function initializeDatabase() {
  if (!databaseInitialization) {
    databaseInitialization = ensureSchema()
      .then(seedDefaultAccounts)
      .catch((error) => {
        databaseInitialization = undefined;
        throw error;
      });
  }

  return databaseInitialization;
}

export { app };

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      console.log(`CampusHelp API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize CampusHelp server:', error);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  startServer();
}
