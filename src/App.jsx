import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

const KEY = 'campushelp-data-v1';
const users = [
  { username: 'user', password: 'user123', role: 'user', name: 'Miguel Mendoza', email: 'miguel.mendoza@university.edu', department: 'Computer Science', id: '2024-00123' },
  { username: 'itstaff', password: 'staff123', role: 'staff', name: 'Jordan Lee', email: 'jordan.lee@university.edu', department: 'Information Technology', id: 'IT-0042' },
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Dr. Alicia Reyes', email: 'alicia.reyes@university.edu', department: 'Information Technology', id: 'ADM-0001' }
];

const staff = [
  { name: 'Jordan Lee', username: 'itstaff' },
  { name: 'Priya Shah', username: 'staff2' },
  { name: 'Marcus Chen', username: 'staff3' }
];

const categories = [
  'Account & Access',
  'Password Reset',
  'Locked Account',
  'Computer/Laptop Issue',
  'Network/Internet',
  'Email Issue',
  'Software/Application',
  'Printer/Peripheral',
  'System/Portal Issue'
];

const statuses = ['Open', 'Assigned', 'In Progress', 'Pending User', 'Resolved', 'Closed'];
const priorities = ['Low', 'Normal', 'High', 'Urgent'];

const seedTickets = [
  { id: 'IT-2026-001', subject: 'Locked Account', category: 'Locked Account', description: 'I cannot access my university account.', priority: 'Normal', status: 'Open', requesterId: 'user', requesterName: 'Miguel Mendoza', assignedTo: 'itstaff', createdAt: '2026-01-18T09:00:00.000Z' },
  { id: 'IT-2026-002', subject: 'No Internet Connection', category: 'Network/Internet', description: 'The wireless connection in the library is unavailable.', priority: 'High', status: 'In Progress', requesterId: 'user', requesterName: 'Miguel Mendoza', assignedTo: 'itstaff', createdAt: '2026-01-19T11:30:00.000Z' },
  { id: 'IT-2026-003', subject: 'Forgotten Password', category: 'Password Reset', description: 'Please help me reset my portal password.', priority: 'Normal', status: 'Resolved', requesterId: 'user', requesterName: 'Miguel Mendoza', assignedTo: 'itstaff', createdAt: '2026-01-15T14:20:00.000Z' },
  { id: 'IT-2026-004', subject: 'Printer Not Working', category: 'Printer/Peripheral', description: 'The printer in Room 204 is displaying an error.', priority: 'Low', status: 'Pending User', requesterId: 'user', requesterName: 'Miguel Mendoza', assignedTo: 'itstaff', createdAt: '2026-01-22T08:10:00.000Z' },
  { id: 'IT-2026-005', subject: 'University Portal Error', category: 'System/Portal Issue', description: 'The enrollment portal shows an unexpected error.', priority: 'High', status: 'Resolved', requesterId: 'user', requesterName: 'Miguel Mendoza', assignedTo: 'itstaff', createdAt: '2026-01-14T13:40:00.000Z' }
];

const seedNotifications = [
  { id: 1, role: 'staff', text: 'New ticket IT-2026-001 has been submitted.', read: false },
  { id: 2, role: 'user', text: 'Welcome to CampusHelp. Your tickets will appear here.', read: true },
  { id: 3, role: 'admin', text: 'IT staff review summary is ready.', read: false }
];

function initialData() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.tickets) return saved;
  } catch {}
  return { tickets: seedTickets, notifications: seedNotifications, next: 6 };
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function getSession() {
  return JSON.parse(localStorage.getItem('campushelp-session') || 'null');
}

function setSession(session) {
  localStorage.setItem('campushelp-session', JSON.stringify(session));
}

function fmt(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function time(value) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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

function Status({ value }) {
  return <span className={'badge status-' + value.toLowerCase().replaceAll(' ', '-')}>{value}</span>;
}

function Priority({ value }) {
  return <span className={'priority priority-' + value.toLowerCase()}><i /> {value}</span>;
}

function Protected({ role, children }) {
  const session = getSession();

  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) return <Navigate to={session.role === 'user' ? '/user/dashboard' : session.role === 'staff' ? '/staff/dashboard' : '/admin/dashboard'} replace />;

  return children;
}

function useData() {
  const [data, setData] = useState(initialData);

  const update = (fn) => {
    setData((old) => {
      const next = fn({ ...old, tickets: old.tickets.map((ticket) => ({ ...ticket })), notifications: [...old.notifications] });
      persist(next);
      return next;
    });
  };

  return [data, update];
}

function Shell({ role, children }) {
  const navigate = useNavigate();
  const [data] = useData();
  const [open, setOpen] = useState(false);
  const session = getSession();

  const links = {
    user: [
      ['Dashboard', '/user/dashboard', '⌂'],
      ['My Tickets', '/user/tickets', '▣'],
      ['Create Ticket', '/user/create-ticket', '＋'],
      ['Notifications', '/user/notifications', '◌'],
      ['Profile', '/user/profile', '◍']
    ],
    staff: [
      ['Dashboard', '/staff/dashboard', '⌂'],
      ['Tickets', '/staff/tickets', '▣'],
      ['Notifications', '/staff/notifications', '◌'],
      ['Profile', '/staff/profile', '◍']
    ],
    admin: [
      ['Dashboard', '/admin/dashboard', '⌂'],
      ['Tickets', '/admin/tickets', '▣'],
      ['Overview', '/admin/overview', '◫'],
      ['Notifications', '/admin/notifications', '◌'],
      ['Profile', '/admin/profile', '◍']
    ]
  };

  function logout() {
    localStorage.removeItem('campushelp-session');
    navigate('/login');
  }

  const unread = data.notifications.filter((n) => (n.role === role || n.role === session?.role) && !n.read).length;

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
              {label === 'Notifications' && unread ? <span className="dot">{unread}</span> : null}
            </Link>
          ))}
        </nav>
        <button type="button" className="button secondary full" onClick={logout}>Logout</button>
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

function Cards({ items }) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <div className={'stat-icon ' + (item.tone || '')}><Icon>{item.icon}</Icon></div>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketTable({ tickets, linkPrefix, empty = 'No tickets found.' }) {
  const navigate = useNavigate();

  if (!tickets.length) {
    return (
      <div className="empty">
        <div>⌁</div>
        <h3>{empty}</h3>
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
            <tr key={ticket.id} onClick={() => navigate(`${linkPrefix}/${ticket.id}`)} style={{ cursor: 'pointer' }}>
              <td>{ticket.id}</td>
              <td>{ticket.subject}</td>
              <td>{ticket.category}</td>
              <td><Status value={ticket.status} /></td>
              <td><Priority value={ticket.priority} /></td>
              <td>{fmt(ticket.createdAt)}</td>
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
      <label className="search">⌕
        <input placeholder="Search tickets..." onChange={(e) => setSearch(e.target.value)} />
      </label>
      <select defaultValue="" onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <select defaultValue="" onChange={(e) => setCategory(e.target.value)}>
        <option value="">All categories</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      {!staffFilter && (
        <select defaultValue="" onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
      )}
    </div>
  );
}

function Dashboard({ role }) {
  const session = getSession();
  const [data] = useData();

  const mine = role === 'user'
    ? data.tickets.filter((ticket) => ticket.requesterId === session.username)
    : data.tickets.filter((ticket) => ticket.assignedTo === session.username || ticket.assignedTo === 'itstaff');

  const cards = [
    { label: 'Total Tickets', value: data.tickets.length, tone: 'blue', icon: '▣' },
    { label: 'Open', value: data.tickets.filter((ticket) => ticket.status === 'Open').length, tone: 'green', icon: '⌂' },
    { label: 'In Progress', value: data.tickets.filter((ticket) => ticket.status === 'In Progress').length, tone: 'amber', icon: '◌' },
    { label: 'Resolved', value: data.tickets.filter((ticket) => ['Resolved', 'Closed'].includes(ticket.status)).length, tone: 'cyan', icon: '✓' }
  ];

  return (
    <>
      <PageHead eyebrow="Overview" title={role === 'user' ? 'My Dashboard' : role === 'staff' ? 'IT Staff Dashboard' : 'Admin Dashboard'} description={`Welcome, ${session?.name || 'User'}.`} />
      <Cards items={cards} />

      <div className="two-col">
        <section className="panel-card">
          <div className="panel-head"><h3>Recent Tickets</h3></div>
          <TicketTable tickets={mine.slice(0, 5)} linkPrefix={role === 'user' ? '/user/tickets' : role === 'staff' ? '/staff/tickets' : '/admin/tickets'} empty="No tickets yet." />
        </section>

        <section className="panel-card">
          <div className="panel-head"><h3>Notifications</h3></div>
          <ul className="notification-list">
            {data.notifications.filter((notification) => notification.role === role || notification.role === 'staff' || notification.role === 'admin').slice(0, 5).map((item) => (
              <li key={item.id}><span>{item.text}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function TicketList({ role, assigned = false }) {
  const [data, update] = useData();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');

  const session = getSession();

  const list = data.tickets.filter((ticket) => {
    if (role === 'user') {
      if (ticket.requesterId !== session.username) return false;
    }
    if (role === 'staff' && assigned && ticket.assignedTo !== session.username) return false;
    if (search && !`${ticket.subject} ${ticket.description} ${ticket.id}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (status && ticket.status !== status) return false;
    if (category && ticket.category !== category) return false;
    if (priority && ticket.priority !== priority) return false;
    return true;
  });

  return (
    <>
      <PageHead eyebrow="TICKETS" title="Ticket List" description="Review and monitor submitted requests." action={role === 'user' ? <Link className="button" to="/user/create-ticket">New Ticket</Link> : null} />
      <FilterBar setSearch={setSearch} setStatus={setStatus} setCategory={setCategory} setPriority={setPriority} staffFilter={role !== 'user'} />
      <TicketTable tickets={list} linkPrefix={role === 'user' ? '/user/tickets' : role === 'staff' ? '/staff/tickets' : '/admin/tickets'} empty="No tickets found." />
    </>
  );
}

function CreateTicket() {
  const navigate = useNavigate();
  const [data, update] = useData();
  const [form, setForm] = useState({ subject: '', category: 'Account & Access', description: '', priority: 'Normal' });
  const [error, setError] = useState('');

  const session = getSession();

  function submit(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      setError('Subject and description are required.');
      return;
    }

    const ticket = {
      id: `IT-${new Date().getFullYear()}-${String(data.next).padStart(3, '0')}`,
      subject: form.subject.trim(),
      category: form.category,
      description: form.description.trim(),
      priority: form.priority,
      status: 'Open',
      requesterId: session.username,
      requesterName: session.name,
      assignedTo: 'itstaff',
      createdAt: new Date().toISOString()
    };

    update((old) => ({
      ...old,
      tickets: [ticket, ...old.tickets],
      notifications: [
        { id: Date.now(), role: 'staff', text: `New ticket ${ticket.id} has been submitted.`, read: false },
        ...old.notifications
      ],
      next: old.next + 1
    }));

    navigate('/user/tickets');
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
              {categories.map((option) => <option key={option} value={option}>{option}</option>)}
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
              {priorities.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="suggestion-box">
            <div><strong>Suggested Category:</strong> {form.category}</div>
            <div><strong>Suggested Priority:</strong> {form.priority}</div>
          </div>
        </div>

        <div className="action-row">
          <button type="submit" className="button">Submit Ticket</button>
        </div>
      </form>
    </>
  );
}

function TicketDetail({ role }) {
  const { ticketId } = useParams();
  const [data, update] = useData();
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const session = getSession();

  const ticket = data.tickets.find((item) => item.id === ticketId);
  if (!ticket) {
    return <div className="empty"><div>⌁</div><h3>Ticket not found.</h3></div>;
  }

  function updateStatus(nextStatus) {
    update((old) => ({
      ...old,
      tickets: old.tickets.map((item) => item.id === ticketId ? { ...item, status: nextStatus } : item)
    }));
  }

  function sendReply() {
    if (!reply.trim()) return;

    update((old) => ({
      ...old,
      tickets: old.tickets.map((item) => item.id === ticketId ? { ...item, status: 'In Progress' } : item),
      notifications: [
        { id: Date.now(), role: role === 'user' ? 'staff' : 'user', text: `${session.name} replied on ${ticketId}.`, read: false },
        ...old.notifications
      ]
    }));

    setReply('');
  }

  return (
    <>
      <PageHead eyebrow="TICKET DETAILS" title={ticket.subject} description={<span className="ticket-id">#{ticket.id}</span>} action={<Link className="button secondary" to={role === 'user' ? '/user/tickets' : role === 'staff' ? '/staff/tickets' : '/admin/tickets'}>Back</Link>} />
      {error && <div className="alert error">{error}</div>}

      <section className="panel-card">
        <div className="field-grid two-up">
          <div>
            <p><strong>Category:</strong> {ticket.category}</p>
            <p><strong>Priority:</strong> <Priority value={ticket.priority} /></p>
            <p><strong>Requester:</strong> {ticket.requesterName}</p>
            <p><strong>Assigned:</strong> {ticket.assignedTo ? ticket.assignedTo : 'Unassigned'}</p>
          </div>
          <div>
            {['staff', 'admin'].includes(role) && (
              <label>
                <span>Status</span>
                <select value={ticket.status} onChange={(e) => updateStatus(e.target.value)}>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            )}
            <p><strong>Created:</strong> {time(ticket.createdAt)}</p>
          </div>
        </div>

        <div className="ticket-description">
          <h3>Description</h3>
          <p>{ticket.description}</p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-head"><h3>Conversation</h3></div>
        <div className="message-list">
          <div className="message-item">
            <div className="message-meta">
              <strong>{ticket.requesterName}</strong>
              <span>{time(ticket.createdAt)}</span>
            </div>
            <p>{ticket.description}</p>
          </div>
        </div>

        <div className="reply-box">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows="4" placeholder="Write a response..." />
          <button type="button" className="button" onClick={sendReply}>Send Reply</button>
        </div>
      </section>
    </>
  );
}

function NotificationsPage({ role }) {
  const [data, update] = useData();
  const session = getSession();

  const notes = data.notifications.filter((notification) => notification.role === role || notification.role === session?.role);

  function markRead(id) {
    update((old) => ({
      ...old,
      notifications: old.notifications.map((note) => note.id === id ? { ...note, read: true } : note)
    }));
  }

  return (
    <>
      <PageHead eyebrow="INBOX" title="Notifications" description="Stay up to date with the latest CampusHelp activity." />
      {notes.length ? (
        <div className="notification-stack">
          {notes.map((item) => (
            <div key={item.id} className={'notification-item ' + (item.read ? 'read' : 'unread')}>
              <div>
                <strong>{item.text}</strong>
                <small>{fmt(new Date().toISOString())}</small>
              </div>
              {!item.read && <button type="button" className="button secondary" onClick={() => markRead(item.id)}>Mark Read</button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty"><div>⌁</div><h3>No notifications yet.</h3></div>
      )}
    </>
  );
}

function Profile({ role }) {
  const session = getSession();
  const user = users.find((entry) => entry.role === role);

  return (
    <>
      <PageHead eyebrow="ACCOUNT" title="Profile" description="Your CampusHelp account information." />
      <section className="profile-card">
        <div className="profile-row"><strong>Full Name:</strong> <span>{session?.name || user?.name}</span></div>
        <div className="profile-row"><strong>Email:</strong> <span>{session?.email || user?.email}</span></div>
        <div className="profile-row"><strong>Role:</strong> <span>{role}</span></div>
        <div className="profile-row"><strong>Department:</strong> <span>{session?.department || user?.department}</span></div>
        <div className="profile-row"><strong>Employee ID:</strong> <span>{session?.id || user?.id}</span></div>
      </section>
    </>
  );
}

function AdminOverview() {
  const [data] = useData();

  const byCategory = categories.map((category) => [category, data.tickets.filter((ticket) => ticket.category === category).length]);
  const max = Math.max(1, ...byCategory.map(([, count]) => count));

  return (
    <>
      <PageHead eyebrow="ADMINISTRATION" title="Overview" description="High-level visibility into CampusHelp ticket health." />
      <div className="two-col">
        <section className="panel-card">
          <div className="panel-head"><h3>Tickets by Category</h3></div>
          <ul className="bullet-list">
            {byCategory.map(([category, count]) => (
              <li key={category}><span>{category}</span><strong>{count}</strong></li>
            ))}
          </ul>
        </section>

        <section className="panel-card">
          <div className="panel-head"><h3>Ticket Status Breakdown</h3></div>
          <ul className="bullet-list">
            {statuses.map((status) => (
              <li key={status}><span>{status}</span><strong>{data.tickets.filter((ticket) => ticket.status === status).length}</strong></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    const match = users.find((user) => user.username === form.username && user.password === form.password);
    if (!match) {
      setError('Invalid username or password.');
      return;
    }

    const session = { username: match.username, name: match.name, role: match.role, email: match.email, department: match.department, id: match.id };
    setSession(session);
    navigate(match.role === 'user' ? '/user/dashboard' : match.role === 'staff' ? '/staff/dashboard' : '/admin/dashboard');
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-art">
          <div className="brand logo-block">
            <span className="logo"><Icon>⌁</Icon></span>
            <div>
              <b>CampusHelp</b>
              <small>Department of Information Technology</small>
            </div>
          </div>
          <h1>Need help with your university account or device?</h1>
          <p>Submit and track requests with the CampusHelp help desk.</p>
        </div>

        <div className="login-card">
          <div className="eyebrow">WELCOME BACK</div>
          <h2>Sign In</h2>
          <form onSubmit={submit}>
            {error && <div className="alert error">{error}</div>}
            <label>
              <span>Username</span>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" required />
            </label>
            <button type="submit" className="button full">Login</button>
            <div className="signup-row">
              <span>Demo accounts: user / staff / admin</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const session = getSession();

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={session.role === 'user' ? '/user/dashboard' : session.role === 'staff' ? '/staff/dashboard' : '/admin/dashboard'} replace /> : <Login />} />
      <Route path="/" element={<Navigate to={session ? (session.role === 'user' ? '/user/dashboard' : session.role === 'staff' ? '/staff/dashboard' : '/admin/dashboard') : '/login'} replace />} />

      <Route path="/user/dashboard" element={<Protected role="user"><Shell role="user"><Dashboard role="user" /></Shell></Protected>} />
      <Route path="/user/tickets" element={<Protected role="user"><Shell role="user"><TicketList role="user" /></Shell></Protected>} />
      <Route path="/user/tickets/:ticketId" element={<Protected role="user"><Shell role="user"><TicketDetail role="user" /></Shell></Protected>} />
      <Route path="/user/create-ticket" element={<Protected role="user"><Shell role="user"><CreateTicket /></Shell></Protected>} />
      <Route path="/user/notifications" element={<Protected role="user"><Shell role="user"><NotificationsPage role="user" /></Shell></Protected>} />
      <Route path="/user/profile" element={<Protected role="user"><Shell role="user"><Profile role="user" /></Shell></Protected>} />

      <Route path="/staff/dashboard" element={<Protected role="staff"><Shell role="staff"><Dashboard role="staff" /></Shell></Protected>} />
      <Route path="/staff/tickets" element={<Protected role="staff"><Shell role="staff"><TicketList role="staff" /></Shell></Protected>} />
      <Route path="/staff/tickets/:ticketId" element={<Protected role="staff"><Shell role="staff"><TicketDetail role="staff" /></Shell></Protected>} />
      <Route path="/staff/notifications" element={<Protected role="staff"><Shell role="staff"><NotificationsPage role="staff" /></Shell></Protected>} />
      <Route path="/staff/profile" element={<Protected role="staff"><Shell role="staff"><Profile role="staff" /></Shell></Protected>} />

      <Route path="/admin/dashboard" element={<Protected role="admin"><Shell role="admin"><Dashboard role="admin" /></Shell></Protected>} />
      <Route path="/admin/tickets" element={<Protected role="admin"><Shell role="admin"><TicketList role="admin" /></Shell></Protected>} />
      <Route path="/admin/tickets/:ticketId" element={<Protected role="admin"><Shell role="admin"><TicketDetail role="admin" /></Shell></Protected>} />
      <Route path="/admin/overview" element={<Protected role="admin"><Shell role="admin"><AdminOverview /></Shell></Protected>} />
      <Route path="/admin/notifications" element={<Protected role="admin"><Shell role="admin"><NotificationsPage role="admin" /></Shell></Protected>} />
      <Route path="/admin/profile" element={<Protected role="admin"><Shell role="admin"><Profile role="admin" /></Shell></Protected>} />
    </Routes>
  );
}
