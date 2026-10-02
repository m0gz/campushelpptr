import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './styles.css';

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

  let response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      ...options,
      headers: finalHeaders
    });
  } catch (error) {
    throw new Error(`Could not reach ${path}: ${error.message}`);
  }

  const responseText = await response.text();
  let data = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {}

  if (!response.ok) {
    const detail = data.message || responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(detail || `Request failed (HTTP ${response.status} ${response.statusText}).`);
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
    return <div className="empty"><h3>Loading CampusHelp...</h3></div>;
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
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    apiFetch('/api/notifications')
      .then((data) => {
        if (isCurrent) setUnreadCount((data.notifications || []).filter((item) => !item.is_read).length);
      })
      .catch(() => {});

    return () => {
      isCurrent = false;
    };
  }, []);

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
  const rolePath = role === 'User' ? 'user' : role === 'IT Staff' ? 'staff' : 'admin';

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
            <Link key={to} className={location.pathname === to ? 'active' : ''} to={to} onClick={() => setOpen(false)}>
              <Icon>{icon}</Icon>
              {label}
              {label === 'Notifications' && unreadCount > 0 && <em>{unreadCount}</em>}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="support-card">
            <strong>Need help?</strong>
            <span>Our IT team is here for you.</span>
            <Link to={`/${rolePath}/tickets`}>View support center →</Link>
          </div>
          <button type="button" className="logout" onClick={handleLogout}><Icon>↪</Icon> Log out</button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button type="button" className="mobile-menu" onClick={() => setOpen(!open)}>☰</button>
          <div className="crumb">{role === 'Administrator' ? 'Administration' : role === 'IT Staff' ? 'IT Staff workspace' : 'My workspace'} <span>/</span> {location.pathname.split('/').pop().replaceAll('-', ' ')}</div>
          <div className="top-user">
            <div className="avatar">{(user?.full_name || user?.email || 'CH').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div><b>{user?.full_name || user?.email}</b><small>{role === 'Administrator' ? 'Administrator' : role === 'IT Staff' ? 'IT Staff' : user?.account_type || 'Student'}</small></div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
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
        <p>Try adjusting your filters or create a new ticket.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Requester</th>
            <th>Subject</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Date submitted</th>
            <th>Assigned to</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.ticket_id || ticket.id} onClick={() => linkPrefix && navigate(`${linkPrefix}/${ticket.ticket_id || ticket.id}`)} style={{ cursor: linkPrefix ? 'pointer' : 'default' }}>
              <td><b className="ticket-id">{ticket.ticket_id || ticket.id}</b></td>
              <td>{ticket.requester_name || 'You'}</td>
              <td><strong>{ticket.subject}</strong></td>
              <td>{ticket.category}</td>
              <td><PriorityBadge value={ticket.priority || 'Medium'} /></td>
              <td>{new Date(ticket.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              <td>{ticket.assigned_staff_name || <span className="muted">Unassigned</span>}</td>
              <td><StatusBadge value={ticket.status || 'Open'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterBar({ setSearch, setStatus, setCategory, setPriority, staffFilter = false }) {
  return (
    <div className="filters">
      <label className="search">⌕<input placeholder="Search tickets..." onChange={(event) => setSearch(event.target.value)} /></label>
      <select aria-label="Filter by status" onChange={(event) => setStatus(event.target.value)}>
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
      </select>
      <select aria-label="Filter by category" onChange={(event) => setCategory(event.target.value)}>
        <option value="">All categories</option>
        {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
      </select>
      {staffFilter && (
        <select aria-label="Filter by priority" onChange={(event) => setPriority(event.target.value)}>
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((priority) => <option key={priority}>{priority}</option>)}
        </select>
      )}
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

  const countStatus = (status) => tickets.filter((ticket) => ticket.status === status).length;
  const resolvedCount = tickets.filter((ticket) => ['Resolved', 'Closed'].includes(ticket.status)).length;
  const statCards = role === 'User'
    ? [
        { label: 'Open', value: countStatus('Open'), tone: '', icon: '⌁', note: 'Awaiting support' },
        { label: 'In Progress', value: countStatus('In Progress'), tone: 'purple', icon: '↻', note: 'Being worked on' },
        { label: 'Resolved', value: resolvedCount, tone: 'green', icon: '✓', note: 'Successfully resolved' },
        { label: 'Total Tickets', value: tickets.length, tone: 'orange', icon: '▤', note: 'Across all time' }
      ]
    : role === 'IT Staff'
      ? [
          { label: 'New Tickets', value: countStatus('Open'), tone: '', icon: '✦', note: 'Ready for review' },
          { label: 'Open Tickets', value: countStatus('Open'), tone: 'orange', icon: '⌁', note: 'Need attention' },
          { label: 'In Progress', value: countStatus('In Progress'), tone: 'purple', icon: '↻', note: 'Being worked on' },
          { label: 'Resolved', value: resolvedCount, tone: 'green', icon: '✓', note: 'Successfully resolved' }
        ]
      : [
          { label: 'Total Tickets', value: tickets.length, tone: '', icon: '▤', note: 'Across all time' },
          { label: 'Open Tickets', value: countStatus('Open'), tone: 'orange', icon: '⌁', note: 'Need attention' },
          { label: 'In Progress', value: countStatus('In Progress'), tone: 'purple', icon: '↻', note: 'Being worked on' },
          { label: 'Resolved', value: resolvedCount, tone: 'green', icon: '✓', note: 'Successfully resolved' },
          { label: 'Active Accounts', value: '—', tone: '', icon: '◉', note: 'Campus community' }
        ];

  return (
    <>
      <PageHead eyebrow={role === 'Administrator' ? 'ADMINISTRATION' : 'OVERVIEW'} title={role === 'Administrator' ? 'CampusHelp Analytics' : `Welcome back, ${(user?.full_name || 'User').split(' ')[0]}`} description={role === 'Administrator' ? 'A clear view of your department’s support operations.' : 'Here’s what is happening with your support requests today.'} action={role === 'User' && <Link className="button primary" to="/user/create-ticket">＋ Create New Ticket</Link>} />
      <div className="stat-grid">
        {statCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className={`stat-icon ${card.tone}`}><Icon>{card.icon}</Icon></div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </div>
          </div>
        ))}
      </div>

      {role === 'Administrator' ? <AdminOverview tickets={tickets} /> : (
        <section className="panel">
          <div className="panel-head">
            <div><h2>{role === 'IT Staff' ? 'Ticket queue' : 'Recent tickets'}</h2><p>{role === 'IT Staff' ? 'Tickets that need your team’s attention.' : 'Keep track of your latest support requests.'}</p></div>
            <Link to={role === 'IT Staff' ? '/staff/tickets' : '/user/tickets'} className="text-link">View all →</Link>
          </div>
          <TicketTable tickets={tickets.slice(0, 5)} linkPrefix={role === 'User' ? '/user/tickets' : '/staff/tickets'} emptyText="No tickets yet." />
        </section>
      )}
    </>
  );
}

function AdminOverview({ tickets }) {
  const categories = CATEGORIES.slice(0, 6).map((category) => [category, tickets.filter((ticket) => ticket.category === category).length]);
  const maxCount = Math.max(1, ...categories.map(([, count]) => count));

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head"><div><h2>Tickets by category</h2><p>Distribution across support areas.</p></div><Link className="text-link" to="/admin/analytics">View report →</Link></div>
        <div className="bars">{categories.map(([category, count]) => <div className="bar-row" key={category}><span>{category}</span><div><i style={{ width: `${count / maxCount * 100}%` }} /></div><b>{count}</b></div>)}</div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>Tickets by status</h2><p>Current workload snapshot.</p></div></div>
        <div className="status-list">{STATUS_OPTIONS.map((status) => <div key={status}><span><StatusBadge value={status} /></span><b>{countStatusFor(tickets, status)}</b></div>)}</div>
      </section>
    </div>
  );
}

function countStatusFor(tickets, status) {
  return tickets.filter((ticket) => ticket.status === status).length;
}

function TicketList({ role }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
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
  const filteredTickets = tickets.filter((ticket) => (
    JSON.stringify(ticket).toLowerCase().includes(search.toLowerCase())
    && (!status || ticket.status === status)
    && (!category || ticket.category === category)
    && (!priority || ticket.priority === priority)
  ));

  return (
    <>
      <PageHead eyebrow={role === 'User' ? 'SUPPORT REQUESTS' : 'TICKET MANAGEMENT'} title={role === 'User' ? 'My tickets' : 'All tickets'} description="Search, filter, and select a ticket to view its details." action={role === 'User' && <Link className="button primary" to="/user/create-ticket">＋ Create Ticket</Link>} />
      <section className="panel">
        <FilterBar setSearch={setSearch} setStatus={setStatus} setCategory={setCategory} setPriority={setPriority} staffFilter={role !== 'User'} />
        <TicketTable tickets={filteredTickets} linkPrefix={basePath} emptyText="No tickets found." />
      </section>
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
        <div className="form-grid">
          <label>Subject <span>*</span>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Unable to access my university account" required />
          </label>
          <label>Category <span>*</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="full">Description <span>*</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="7" placeholder="Describe the issue and any steps you have already tried." required />
          </label>
          <label>Priority
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div>
            <label>Suggested routing</label>
            <small className="hint">{suggestion.suggestedCategory} · {suggestion.suggestedPriority} priority</small>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <Link className="button secondary" to="/user/dashboard">Cancel</Link>
          <button type="submit" className="button primary">Submit Ticket</button>
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

  if (!ticket) return <div className="empty"><h3>{error || 'Loading ticket...'}</h3></div>;

  const canManage = ['IT Staff', 'Administrator'].includes(user.role);
  const rolePath = normalizeRole(user.role) === 'IT Staff' ? 'staff' : normalizeRole(user.role) === 'Administrator' ? 'admin' : 'user';

  return (
    <>
      <PageHead eyebrow="TICKET DETAILS" title={ticket.subject} description={<span className="ticket-id">#{ticket.ticket_id}</span>} action={<Link className="button secondary" to={`/${rolePath}/tickets`}>← Back to tickets</Link>} />
      {error && <div className="error">{error}</div>}

      <div className="detail-grid" style={{ gridTemplateColumns: canManage ? undefined : '1fr' }}>
        <div>
          <section className="panel ticket-summary">
            <div className="summary-top">
              <div><span className="muted">Current status</span><StatusBadge value={status} /></div>
              <PriorityBadge value={ticket.priority} />
            </div>
            <h2>{ticket.subject}</h2>
            <p>{ticket.description}</p>
            <div className="meta-grid">
              <span><b>Category</b>{ticket.category}</span>
              <span><b>Submitted</b>{new Date(ticket.created_at).toLocaleDateString()}</span>
              <span><b>Last updated</b>{new Date(ticket.updated_at || ticket.created_at).toLocaleDateString()}</span>
              <span><b>Assigned IT staff</b>{ticket.assigned_staff_name || 'Unassigned'}</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><div><h2>Conversation</h2><p>Updates and responses on this request.</p></div></div>
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-dot">⌁</div>
                <div><b>{ticket.requester_name || 'Requester'}</b><small>{new Date(ticket.created_at).toLocaleString()}</small><p>{ticket.description}</p></div>
              </div>
              {messages.map((message) => (
                <div className="timeline-item" key={message.message_id}>
                  <div className="timeline-dot">◉</div>
                  <div><b>{message.sender_name} <small>{message.sender_email}</small></b><small>{new Date(message.sent_at).toLocaleString()}</small><p>{message.message}</p></div>
                </div>
              ))}
            </div>
            <div className="reply-box">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows="4" placeholder="Write a response..." />
              <button type="button" className="button primary" onClick={sendReply}>Send Reply</button>
            </div>
          </section>
        </div>

        {canManage && <aside>
          <section className="panel">
            <div className="panel-head"><h2>Manage ticket</h2></div>
            <label>Status
              <select value={status} onChange={(event) => handleStatusChange(event.target.value)}>
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <p><strong>Requester</strong><br />{ticket.requester_name || 'Unknown'}</p>
            <p><strong>Assigned to</strong><br />{ticket.assigned_staff_name || 'Unassigned'}</p>
          </section>
        </aside>}
      </div>
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
        <section className="panel notification-list">
          {notifications.map((item) => (
            <div key={item.notification_id} className={item.is_read ? 'notification' : 'notification unread'}>
              <div className="notification-icon">♢</div>
              <div>
                <p>{item.message}</p>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
              {!item.is_read && <button onClick={() => markRead(item.notification_id)}>Mark read</button>}
            </div>
          ))}
        </section>
      ) : (
        <section className="panel"><div className="empty"><h3>No notifications yet.</h3><p>You’re all caught up.</p></div></section>
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
        <div className="profile-avatar">{user.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
        <h2>{user.full_name}</h2>
        <p>{user.email}</p>
        <div className="profile-fields">
          <span><b>{user.account_type === 'Student' ? 'Student number' : user.account_type === 'Faculty' ? 'Employee ID' : 'Account type'}</b>{user.student_number || user.employee_id || user.account_type || 'Staff account'}</span>
          <span><b>Department</b>{user.department || 'Not specified'}</span>
          <span><b>Role</b>{user.role}</span>
        </div>
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

  const categories = analytics.byCategory || [];
  const maxCount = Math.max(1, ...categories.map((category) => category.count));

  return (
    <>
      <PageHead eyebrow="ADMINISTRATION" title="CampusHelp Analytics" description="A clear view of your department’s support operations." />
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-icon"><Icon>▤</Icon></div><div><span>Total Tickets</span><strong>{analytics.totals.total}</strong><small>Across all time</small></div></div>
        <div className="stat-card"><div className="stat-icon orange"><Icon>⌁</Icon></div><div><span>Open Tickets</span><strong>{analytics.totals.open}</strong><small>Need attention</small></div></div>
        <div className="stat-card"><div className="stat-icon purple"><Icon>↻</Icon></div><div><span>In Progress</span><strong>{analytics.totals.inProgress}</strong><small>Being worked on</small></div></div>
        <div className="stat-card"><div className="stat-icon green"><Icon>✓</Icon></div><div><span>Resolved</span><strong>{analytics.totals.resolved}</strong><small>Successfully resolved</small></div></div>
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><div><h2>Tickets by category</h2><p>Distribution across support areas.</p></div></div>
          <div className="bars">
            {categories.map((item) => (
              <div className="bar-row" key={item.category}>
                <span>{item.category}</span><div><i style={{ width: `${item.count / maxCount * 100}%` }} /></div><b>{item.count}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Tickets by status</h2><p>Current workload snapshot.</p></div></div>
          <div className="status-list">
            {(analytics.byStatus || []).map((item) => (
              <div key={item.status}><span><StatusBadge value={item.status} /></span><b>{item.count}</b></div>
            ))}
          </div>
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
      <div className="login-art">
        <Logo />
        <div className="art-copy">
          <div className="eyebrow">UNIVERSITY IT SUPPORT</div>
          <h1>Help when you need it.<br /><em>Support you can trust.</em></h1>
          <p>CampusHelp makes it simple to report technology issues and stay connected with the people working to solve them.</p>
          <div className="art-stat"><b>24/7</b><span>IT support visibility<br />for our campus community</span></div>
        </div>
      </div>
      <div className="login-panel">
        <div className="login-form">
          <div className="mobile-logo"><Logo /></div>
          <div className="eyebrow">WELCOME BACK</div>
          <h1>Sign in to CampusHelp</h1>
          <p>Use your university credentials to continue.</p>
          <form onSubmit={submit}>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@mymail.mapua.edu.ph" required /></label>
            <label>Password<div className="password"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" required /><span>◉</span></div></label>
            <div className="login-options"><span>Use your university email address</span></div>
            {error && <div className="error">{error}</div>}
            <button type="submit" className="button primary login-button">Sign in</button>
          </form>
          <div className="demo">
            <b>New to CampusHelp?</b>
            <span>Create an account to submit and track support requests.</span>
            <Link to="/register">Create an account →</Link>
          </div>
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
      <div className="login-art">
        <Logo />
        <div className="art-copy">
          <div className="eyebrow">UNIVERSITY IT SUPPORT</div>
          <h1>Help when you need it.<br /><em>Support you can trust.</em></h1>
          <p>CampusHelp makes it simple to report technology issues and stay connected with the people working to solve them.</p>
          <div className="art-stat"><b>24/7</b><span>IT support visibility<br />for our campus community</span></div>
        </div>
      </div>
      <div className="login-panel">
        <div className="form-card">
          <div className="mobile-logo"><Logo /></div>
          <div className="eyebrow">CREATE ACCOUNT</div>
          <h2>Create your account</h2>
          <p>Use your Mapúa account to join the CampusHelp support community.</p>
          <form onSubmit={submit}>
            {error && <div className="error">{error}</div>}

            <div className="form-grid">
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

              <label>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@mymail.mapua.edu.ph" required />
              </label>

              <label>
                <span>Department</span>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Department or unit" />
              </label>

              <label>
                <span>Password</span>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </label>

              <label>
                <span>Confirm Password</span>
                <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
              </label>

            {form.accountType === 'Student' ? (
              <>
                <label>
                  <span>Student Number</span>
                  <input value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} required />
                </label>

                <label>
                  <span>ECM Upload <small className="hint">PDF, PNG, or JPG (required)</small></span>
                  <input type="file" accept=".pdf,image/png,image/jpeg" onChange={(e) => setForm({ ...form, ecm: e.target.files[0] })} required />
                </label>
              </>
            ) : (
              <label>
                <span>Employee ID</span>
                <input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
              </label>
            )}

            </div>
            <div className="form-actions">
              <Link className="button secondary" to="/login">Back to sign in</Link>
              <button type="submit" className="button primary">Create account</button>
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
    return <div className="login-page"><div className="login-panel"><div className="login-form"><div className="empty"><h3>Loading CampusHelp...</h3></div></div></div></div>;
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

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
