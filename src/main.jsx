import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

const CATEGORIES = [
  'Account and Access',
  'Password Reset',
  'Locked Account',
  'Computer/Laptop Issue',
  'Network/Internet',
  'Email Issue',
  'Software/Application',
  'Printer/Peripheral',
  'System/Portal Issue',
  'Access Permission',
  'Other'
];

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ROLE_ROUTES = {
  User: '/user/dashboard',
  'IT Staff': '/staff/dashboard',
  Administrator: '/admin/dashboard'
};

const AuthContext = React.createContext(null);

async function apiFetch(path, options = {}) {
  const hasBody = options.body !== undefined && !(options.body instanceof FormData);
  const finalHeaders = new Headers(options.headers || {});

  if (hasBody) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: finalHeaders
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function useAuth() {
  return React.useContext(AuthContext);
}

function getDashboardPath(role) {
  return ROLE_ROUTES[role] || '/login';
}

function normalizeRole(rawRole) {
  if (!rawRole) return 'User';
  return rawRole;
}

function suggestTicket(subject = '', description = '') {
  const text = `${subject} ${description}`.toLowerCase();

  let category = 'Other';
  if (/(password|login|access|credential|reset)/.test(text)) category = 'Password Reset';
  if (/(lock|locked|account)/.test(text)) category = 'Locked Account';
  if (/(vpn|network|internet|wifi|connection|latency|offline)/.test(text)) category = 'Network/Internet';
  if (/(email|mail|outlook|gmail)/.test(text)) category = 'Email Issue';
  if (/(printer|scanner|peripheral)/.test(text)) category = 'Printer/Peripheral';
  if (/(portal|system|website|site|portal error)/.test(text)) category = 'System/Portal Issue';
  if (/(software|application|app|office|microsoft|zoom)/.test(text)) category = 'Software/Application';
  if (/(computer|laptop|device|hardware|desktop|battery)/.test(text)) category = 'Computer/Laptop Issue';
  if (/(permission|access.*role|role.*access|portal.*permission)/.test(text)) category = 'Access Permission';
  if (/(account.*access|user.*account|unable.*login)/.test(text)) category = 'Account and Access';

  let priority = 'Medium';
  if (/(critical|urgent|major outage|unable to access|campus.*down|network.*down|cannot.*login)/.test(text)) priority = 'Urgent';
  else if (/(password|login|locked|portal|network|email|printer|system)/.test(text)) priority = 'High';
  else if (/(info|question|minor|check|update)/.test(text)) priority = 'Low';

  return { suggestedCategory: category, suggestedPriority: priority };
}

function PageHead({ eyebrow, title, description, action }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ value }) {
  const cssValue = String(value || 'Open').toLowerCase().replace(/\s+/g, '-');
  return <span className={`badge status-${cssValue}`}>{value || 'Open'}</span>;
}

function PriorityBadge({ value }) {
  const cssValue = String(value || 'Medium').toLowerCase();
  return <span className={`priority priority-${cssValue}`}><i /> {value || 'Medium'}</span>;
}

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function Logo() {
  return (
    <Link className="brand" to="/">
      <span className="logo"><Icon>⌁</Icon></span>
      <span>
        <b>CampusHelp</b>
        <small>Department of Information Technology</small>
      </span>
    </Link>
  );
}

function Protected({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-shell"><div className="empty"><h3>Loading CampusHelp...</h3></div></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(normalizeRole(user.role))) {
    return <Navigate to={getDashboardPath(normalizeRole(user.role))} replace />;
  }

  return children;
}

function Shell({ role, children }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [open, setOpen] = useState(false);

  const links = {
    User: [
      ['Dashboard', '/user/dashboard', '⌂'],
      ['My Tickets', '/user/tickets', '▣'],
      ['Create Ticket', '/user/create-ticket', '＋'],
      ['Notifications', '/user/notifications', '◌'],
      ['Profile', '/user/profile', '◍']
    ],
    'IT Staff': [
      ['Dashboard', '/staff/dashboard', '⌂'],
      ['Tickets', '/staff/tickets', '▣'],
      ['Notifications', '/staff/notifications', '◌'],
      ['Profile', '/staff/profile', '◍']
    ],
    Administrator: [
      ['Dashboard', '/admin/dashboard', '⌂'],
      ['Tickets', '/admin/tickets', '▣'],
      ['Analytics', '/admin/analytics', '◫'],
      ['Notifications', '/admin/notifications', '◌'],
      ['Profile', '/admin/profile', '◍']
    ]
  };

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // session may already be invalid, but we still clear UI
    }

    setUser(null);
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <Logo />
        <div className="side-label">WORKSPACE</div>
        <nav>
          {links[role].map(([label, to, icon]) => (
            <Link key={to} className="nav-link" to={to} onClick={() => setOpen(false)}>
              <span className="nav-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <button type="button" className="button secondary full" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button type="button" className="menu-toggle" onClick={() => setOpen(!open)}>☰</button>
          <div className="topbar-title">CampusHelp</div>
        </header>
        <div className="content-wrap">{children}</div>
      </main>
    </div>
  );
}

function TicketTable({ tickets, linkPrefix, emptyText = 'No tickets found.' }) {
  const navigate = useNavigate();

  if (!tickets || !tickets.length) {
    return (
      <div className="empty">
        <div>⌁</div>
        <h3>{emptyText}</h3>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Subject</th>
            <th>Category</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.ticket_id || ticket.id} onClick={() => navigate(`${linkPrefix}/${ticket.ticket_id || ticket.id}`)} style={{ cursor: 'pointer' }}>
              <td>{ticket.ticket_id || ticket.id}</td>
              <td>{ticket.subject}</td>
              <td>{ticket.category}</td>
              <td><StatusBadge value={ticket.status || 'Open'} /></td>
              <td><PriorityBadge value={ticket.priority || 'Medium'} /></td>
              <td>{new Date(ticket.created_at || Date.now()).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({ role }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [ticketData, noteData] = await Promise.all([
          apiFetch('/api/tickets'),
          apiFetch('/api/notifications')
        ]);

        setTickets(ticketData.tickets || []);
        setNotifications(noteData.notifications || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [role]);

  if (loading) {
    return <div className="empty"><h3>Loading dashboard...</h3></div>;
  }

  const statCards = [
    { label: 'Total Tickets', value: tickets.length, tone: 'blue' },
    { label: 'Open', value: tickets.filter((t) => t.status === 'Open').length, tone: 'green' },
    { label: 'In Progress', value: tickets.filter((t) => t.status === 'In Progress').length, tone: 'amber' },
    { label: 'Resolved', value: tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length, tone: 'cyan' }
  ];

  return (
    <>
      <PageHead eyebrow="Overview" title={`${role === 'User' ? 'My Dashboard' : role === 'IT Staff' ? 'IT Staff Dashboard' : 'Admin Dashboard'}`} description={`Welcome, ${user?.full_name || 'User'}.`} />
      <div className="stat-grid">
        {statCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className={`stat-icon ${card.tone}`}><Icon>{card.label[0]}</Icon></div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <section className="panel-card">
          <div className="panel-head">
            <h3>Recent Tickets</h3>
          </div>
          <TicketTable tickets={tickets.slice(0, 5)} linkPrefix={role === 'User' ? '/user/tickets' : role === 'IT Staff' ? '/staff/tickets' : '/admin/tickets'} emptyText="No tickets yet." />
        </section>

        <section className="panel-card">
          <div className="panel-head">
            <h3>Notifications</h3>
          </div>
          {notifications.length ? (
            <ul className="notification-list">
              {notifications.slice(0, 5).map((item) => (
                <li key={item.notification_id}><span>{item.message}</span></li>
              ))}
            </ul>
          ) : (
            <div className="empty"><h3>No notifications.</h3></div>
          )}
        </section>
      </div>
    </>
  );
}

function TicketList({ role }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTickets() {
      try {
        const data = await apiFetch('/api/tickets');
        setTickets(data.tickets || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, [role]);

  if (loading) {
    return <div className="empty"><h3>Loading tickets...</h3></div>;
  }

  const basePath = role === 'User' ? '/user/tickets' : role === 'IT Staff' ? '/staff/tickets' : '/admin/tickets';

  return (
    <>
      <PageHead eyebrow="TICKETS" title="Ticket List" description="Review and monitor submitted requests." action={<Link className="button" to={role === 'User' ? '/user/create-ticket' : '#'}>New Ticket</Link>} />
      <TicketTable tickets={tickets} linkPrefix={basePath} emptyText="No tickets found." />
    </>
  );
}

function CreateTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'Network/Internet',
    priority: 'Medium'
  });
  const [error, setError] = useState('');

  const suggestion = useMemo(() => suggestTicket(form.subject, form.description), [form.subject, form.description]);

  async function submit(e) {
    e.preventDefault();
    setError('');

    const systemPriority = suggestion.suggestedPriority;
    if (form.priority === 'Urgent' && systemPriority !== 'Urgent') {
      const confirmed = window.confirm(
        'Confirm Urgent Priority\n\nUrgent priority should only be used for issues that significantly prevent academic or university operations or affect critical services. Incorrectly marking a non-urgent concern as urgent may delay the handling of genuinely critical requests.'
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      await apiFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          suggested_category: suggestion.suggestedCategory,
          suggested_priority: systemPriority,
          priority_manually_escalated: form.priority === 'Urgent' && systemPriority !== 'Urgent'
        })
      });

      navigate('/user/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageHead eyebrow="NEW REQUEST" title="Create a ticket" description="Tell us what you need help with and our IT team will get back to you." />
      <form className="form-card" onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}

        <div className="field-grid two-up">
          <label>
            <span>Subject</span>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of the issue" required />
          </label>

          <label>
            <span>Category</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>Problem Description</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="6" placeholder="Describe the issue in detail" required />
        </label>

        <div className="field-grid two-up">
          <label>
            <span>Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <div className="suggestion-box">
            <div><strong>Suggested Category:</strong> {suggestion.suggestedCategory}</div>
            <div><strong>Suggested Priority:</strong> {suggestion.suggestedPriority}</div>
          </div>
        </div>

        <div className="action-row">
          <button type="submit" className="button">Submit Ticket</button>
        </div>
      </form>
    </>
  );
}

function TicketDetailPage() {
  const { ticketId } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('Open');
  const [error, setError] = useState('');

  async function loadTicket() {
    try {
      const data = await apiFetch(`/api/tickets/${ticketId}`);
      setTicket(data.ticket);
      setStatus(data.ticket.status || 'Open');
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function handleStatusChange(nextStatus) {
    try {
      await apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      setStatus(nextStatus);
      await loadTicket();
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;

    try {
      await apiFetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply })
      });
      setReply('');
      await loadTicket();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ticket) {
    return <div className="empty"><h3>Loading ticket...</h3></div>;
  }

  return (
    <>
      <PageHead eyebrow="TICKET DETAILS" title={ticket.subject} description={<span className="ticket-id">#{ticket.ticket_id}</span>} action={<Link className="button secondary" to={getDashboardPath(user.role)}>Back</Link>} />
      {error && <div className="alert error">{error}</div>}

      <section className="panel-card">
        <div className="field-grid two-up">
          <div>
            <p><strong>Category:</strong> {ticket.category}</p>
            <p><strong>Priority:</strong> <PriorityBadge value={ticket.priority} /></p>
            <p><strong>Suggested Category:</strong> {ticket.suggested_category || 'Not provided'}</p>
            <p><strong>Suggested Priority:</strong> {ticket.suggested_priority || 'Not provided'}</p>
          </div>
          <div>
            {['IT Staff', 'Administrator'].includes(user.role) && (
              <label>
                <span>Status</span>
                <select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            )}
            <p><strong>Requester:</strong> {ticket.requester_name}</p>
            <p><strong>Assigned:</strong> {ticket.assigned_staff_name || 'Unassigned'}</p>
          </div>
        </div>

        <div className="ticket-description">
          <h3>Description</h3>
          <p>{ticket.description}</p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-head">
          <h3>Conversation</h3>
        </div>
        {messages.length ? (
          <div className="message-list">
            {messages.map((message) => (
              <div key={message.message_id} className="message-item">
                <div className="message-meta">
                  <strong>{message.sender_name}</strong>
                  <span>{new Date(message.sent_at).toLocaleString()}</span>
                </div>
                <p>{message.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty"><h3>No messages yet.</h3></div>
        )}

        <div className="reply-box">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows="4" placeholder="Write a response..." />
          <button type="button" className="button" onClick={sendReply}>Send Reply</button>
        </div>
      </section>
    </>
  );
}

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const data = await apiFetch('/api/notifications');
        setNotifications(data.notifications || []);
      } catch (error) {
        console.error(error);
      }
    }

    loadNotifications();
  }, []);

  async function markRead(notificationId) {
    try {
      await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      setNotifications((current) => current.map((item) => item.notification_id === notificationId ? { ...item, is_read: true } : item));
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <PageHead eyebrow="INBOX" title="Notifications" description="Track updates from the CampusHelp system." />
      {notifications.length ? (
        <div className="notification-stack">
          {notifications.map((item) => (
            <div key={item.notification_id} className={`notification-item ${item.is_read ? 'read' : 'unread'}`}>
              <div>
                <strong>{item.message}</strong>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
              {!item.is_read && <button className="button secondary" onClick={() => markRead(item.notification_id)}>Mark Read</button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty"><h3>No notifications yet.</h3></div>
      )}
    </>
  );
}

function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return <div className="empty"><h3>No profile data.</h3></div>;
  }

  return (
    <>
      <PageHead eyebrow="ACCOUNT" title="Profile" description="Your CampusHelp account details." />
      <section className="profile-card">
        <div className="profile-row"><strong>Full Name:</strong> <span>{user.full_name}</span></div>
        <div className="profile-row"><strong>Email:</strong> <span>{user.email}</span></div>
        <div className="profile-row"><strong>Role:</strong> <span>{user.role}</span></div>
        <div className="profile-row"><strong>Account Type:</strong> <span>{user.account_type}</span></div>
        <div className="profile-row"><strong>Department:</strong> <span>{user.department || 'Not specified'}</span></div>
        {user.account_type === 'Student' && user.student_number && (
          <div className="profile-row"><strong>Student Number:</strong> <span>{user.student_number}</span></div>
        )}
        {user.account_type === 'Faculty' && user.employee_id && (
          <div className="profile-row"><strong>Employee ID:</strong> <span>{user.employee_id}</span></div>
        )}
      </section>
    </>
  );
}

function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const data = await apiFetch('/api/admin/analytics');
        setAnalytics(data);
      } catch (error) {
        console.error(error);
      }
    }

    loadAnalytics();
  }, []);

  if (!analytics) {
    return <div className="empty"><h3>Loading analytics...</h3></div>;
  }

  return (
    <>
      <PageHead eyebrow="ADMINISTRATION" title="Analytics" description="PostgreSQL-backed CampusHelp activity overview." />
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-icon blue"><Icon>◫</Icon></div><div><span>Total Tickets</span><strong>{analytics.totals.total}</strong></div></div>
        <div className="stat-card"><div className="stat-icon green"><Icon>⌂</Icon></div><div><span>Open</span><strong>{analytics.totals.open}</strong></div></div>
        <div className="stat-card"><div className="stat-icon amber"><Icon>◌</Icon></div><div><span>In Progress</span><strong>{analytics.totals.inProgress}</strong></div></div>
        <div className="stat-card"><div className="stat-icon cyan"><Icon>✓</Icon></div><div><span>Resolved</span><strong>{analytics.totals.resolved}</strong></div></div>
      </div>

      <div className="two-col">
        <section className="panel-card">
          <div className="panel-head"><h3>Tickets by Category</h3></div>
          <ul className="bullet-list">
            {(analytics.byCategory || []).map((item) => (
              <li key={item.category}><span>{item.category}</span><strong>{item.count}</strong></li>
            ))}
          </ul>
        </section>

        <section className="panel-card">
          <div className="panel-head"><h3>Tickets by Status</h3></div>
          <ul className="bullet-list">
            {(analytics.byStatus || []).map((item) => (
              <li key={item.status}><span>{item.status}</span><strong>{item.count}</strong></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      setUser(data.user);
      navigate(getDashboardPath(normalizeRole(data.user.role)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-art">
          <div className="brand logo-block"><span className="logo"><Icon>⌁</Icon></span><div><b>CampusHelp</b><small>Department of Information Technology</small></div></div>
          <h1>Need help with your university account or device?</h1>
          <p>Submit and track requests with the CampusHelp help desk.</p>
        </div>

        <div className="login-card">
          <div className="eyebrow">WELCOME BACK</div>
          <h2>Sign In</h2>
          <form onSubmit={submit}>
            {error && <div className="alert error">{error}</div>}
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@mymail.mapua.edu.ph" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" required />
            </label>
            <button type="submit" className="button full">Login</button>
            <div className="signup-row">
              <Link to="/register">Create an account</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'Student',
    studentNumber: '',
    employeeId: '',
    department: '',
    ecm: null
  });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!form.email.endsWith('@mymail.mapua.edu.ph')) {
      setError('Mapúa email is required. Use your @mymail.mapua.edu.ph address.');
      return;
    }

    if (form.accountType === 'Student' && !form.ecm) {
      setError('Student ECM upload is required.');
      return;
    }

    try {
      const data = new FormData();
      data.append('full_name', form.full_name);
      data.append('email', form.email);
      data.append('password', form.password);
      data.append('confirmPassword', form.confirmPassword);
      data.append('account_type', form.accountType);
      data.append('student_number', form.studentNumber);
      data.append('employee_id', form.employeeId);
      data.append('department', form.department);

      if (form.ecm) {
        data.append('ecm', form.ecm);
      }

      const result = await apiFetch('/api/auth/register', { method: 'POST', body: data });
      setUser(result.user);
      navigate(getDashboardPath(normalizeRole(result.user.role)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel single-column">
        <div className="login-card wide-card">
          <div className="eyebrow">CREATE ACCOUNT</div>
          <h2>Sign Up</h2>
          <form onSubmit={submit}>
            {error && <div className="alert error">{error}</div>}

            <div className="field-grid two-up">
              <label>
                <span>Full Name</span>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </label>

              <label>
                <span>Account Type</span>
                <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                </select>
              </label>
            </div>

            <div className="field-grid two-up">
              <label>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@mymail.mapua.edu.ph" required />
              </label>

              <label>
                <span>Department</span>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Department or unit" />
              </label>
            </div>

            <div className="field-grid two-up">
              <label>
                <span>Password</span>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </label>

              <label>
                <span>Confirm Password</span>
                <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
              </label>
            </div>

            {form.accountType === 'Student' ? (
              <>
                <label>
                  <span>Student Number</span>
                  <input value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} required />
                </label>

                <label>
                  <span>ECM Upload (required)</span>
                  <input type="file" accept=".pdf,image/png,image/jpeg" onChange={(e) => setForm({ ...form, ecm: e.target.files[0] })} required />
                </label>
              </>
            ) : (
              <label>
                <span>Employee ID</span>
                <input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
              </label>
            )}

            <div className="action-row">
              <button type="submit" className="button">Create Account</button>
            </div>
            <div className="signup-row">
              <Link to="/login">Back to login</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AppShellRoutes() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-shell"><div className="empty"><h3>Loading CampusHelp...</h3></div></div>;
  }

  if (!user && location.pathname !== '/login' && location.pathname !== '/register') {
    return <Navigate to="/login" replace />;
  }

  if (user && (location.pathname === '/login' || location.pathname === '/register')) {
    return <Navigate to={getDashboardPath(normalizeRole(user.role))} replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? getDashboardPath(normalizeRole(user.role)) : '/login'} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/user/dashboard" element={<Protected allowedRoles={['User']}><Shell role="User"><Dashboard role="User" /></Shell></Protected>} />
      <Route path="/user/tickets" element={<Protected allowedRoles={['User']}><Shell role="User"><TicketList role="User" /></Shell></Protected>} />
      <Route path="/user/tickets/:ticketId" element={<Protected allowedRoles={['User']}><Shell role="User"><TicketDetailPage /></Shell></Protected>} />
      <Route path="/user/create-ticket" element={<Protected allowedRoles={['User']}><Shell role="User"><CreateTicket /></Shell></Protected>} />
      <Route path="/user/notifications" element={<Protected allowedRoles={['User']}><Shell role="User"><NotificationsPage /></Shell></Protected>} />
      <Route path="/user/profile" element={<Protected allowedRoles={['User']}><Shell role="User"><ProfilePage /></Shell></Protected>} />

      <Route path="/staff/dashboard" element={<Protected allowedRoles={['IT Staff']}><Shell role="IT Staff"><Dashboard role="IT Staff" /></Shell></Protected>} />
      <Route path="/staff/tickets" element={<Protected allowedRoles={['IT Staff']}><Shell role="IT Staff"><TicketList role="IT Staff" /></Shell></Protected>} />
      <Route path="/staff/tickets/:ticketId" element={<Protected allowedRoles={['IT Staff']}><Shell role="IT Staff"><TicketDetailPage /></Shell></Protected>} />
      <Route path="/staff/notifications" element={<Protected allowedRoles={['IT Staff']}><Shell role="IT Staff"><NotificationsPage /></Shell></Protected>} />
      <Route path="/staff/profile" element={<Protected allowedRoles={['IT Staff']}><Shell role="IT Staff"><ProfilePage /></Shell></Protected>} />

      <Route path="/admin/dashboard" element={<Protected allowedRoles={['Administrator']}><Shell role="Administrator"><Dashboard role="Administrator" /></Shell></Protected>} />
      <Route path="/admin/tickets" element={<Protected allowedRoles={['Administrator']}><Shell role="Administrator"><TicketList role="Administrator" /></Shell></Protected>} />
      <Route path="/admin/tickets/:ticketId" element={<Protected allowedRoles={['Administrator']}><Shell role="Administrator"><TicketDetailPage /></Shell></Protected>} />
      <Route path="/admin/analytics" element={<Protected allowedRoles={['Administrator']}><Shell role="Administrator"><AdminAnalyticsPage /></Shell></Protected>} />
      <Route path="/admin/notifications" element={<Protected allowedRoles={['Administrator']}><Shell role="Administrator"><NotificationsPage /></Shell></Protected>} />
      <Route path="/admin/profile" element={<Protected allowedRoles={['Administrator']}><Shell role="Administrator"><ProfilePage /></Shell></Protected>} />
    </Routes>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const data = await apiFetch('/api/auth/me');
        setUser(data.user || null);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      <AppShellRoutes />
    </AuthContext.Provider>
  );
}
