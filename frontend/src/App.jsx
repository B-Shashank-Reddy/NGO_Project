import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5001';

const decodeToken = (token) => {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
};

const getStoredAuth = () => {
  const token = localStorage.getItem('ngo_token');
  const role = localStorage.getItem('ngo_role');

  if (!token) {
    return { token: '', role: '' };
  }

  const payload = decodeToken(token);
  return { token, role: payload?.role || role || '' };
};

const buildHeaders = (token, includeJson = true) => {
  const headers = {};

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const roleMeta = {
  admin: {
    label: 'Admin',
    path: 'admin',
    includeUsername: false,
    description: 'Manage organizers, volunteers, events, and registrations',
  },
  organizer: {
    label: 'Organizer',
    path: 'organizer',
    includeUsername: true,
    description: 'Create events and assign volunteer tasks',
  },
  volunteer: {
    label: 'Volunteer',
    path: 'volunteer',
    includeUsername: true,
    description: 'Browse events and register for tasks',
  },
};

const emptyForm = {
  name: '',
  username: '',
  email: '',
  password: '',
};

function App() {
  const [role, setRole] = useState('admin');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(getStoredAuth);
  const [dashboard, setDashboard] = useState({ stats: null, organizers: [], volunteers: [], events: [], registrations: [] });
  const [organizerEvents, setOrganizerEvents] = useState([]);
  const [organizerLoading, setOrganizerLoading] = useState(false);
  const [volunteerEvents, setVolunteerEvents] = useState([]);
  const [volunteerRegistrations, setVolunteerRegistrations] = useState([]);
  const [eventForm, setEventForm] = useState({ name: '', description: '', place: '', eventDate: '', startTime: '09:00', endTime: '12:00' });
  const [taskForm, setTaskForm] = useState({ eventId: '', title: '', description: '', requiredVolunteers: '1' });
  const [statusUpdateId, setStatusUpdateId] = useState('');
  const [account, setAccount] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', username: '', password: '' });
  const [accountLoading, setAccountLoading] = useState(false);

  const isLoggedIn = Boolean(session.token);
  const activeRole = session.role || role;

  useEffect(() => {
    if (!session.token) {
      localStorage.removeItem('ngo_token');
      localStorage.removeItem('ngo_role');
      return;
    }

    localStorage.setItem('ngo_token', session.token);
    localStorage.setItem('ngo_role', session.role);
  }, [session]);

  useEffect(() => {
    if (session.role === 'admin' && session.token) {
      loadAdminDashboard();
    }
  }, [session.role, session.token]);

  useEffect(() => {
    if (session.role === 'organizer' && session.token) {
      loadOrganizerDashboard();
    }
  }, [session.role, session.token]);

  useEffect(() => {
    if (session.role === 'volunteer' && session.token) {
      loadVolunteerDashboard();
    }
  }, [session.role, session.token]);

  useEffect(() => {
    if (session.token) {
      loadAccount();
    }
  }, [session.token]);

  const loadAccount = async () => {
    try {
      const response = await fetch(`${API_BASE}/account/me`, { headers: buildHeaders(session.token) });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load account');
      }

      setAccount(data.account);
      setAccountForm({
        name: data.account.name || '',
        username: data.account.username || '',
        password: '',
      });
    } catch (error) {
      setError(error.message);
    }
  };

  const loadAdminDashboard = async () => {
    try {
      const [statsRes, organizersRes, volunteersRes, eventsRes, registrationsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/dashboard`, { headers: buildHeaders(session.token) }),
        fetch(`${API_BASE}/admin/organizers`, { headers: buildHeaders(session.token) }),
        fetch(`${API_BASE}/admin/volunteers`, { headers: buildHeaders(session.token) }),
        fetch(`${API_BASE}/admin/events`, { headers: buildHeaders(session.token) }),
        fetch(`${API_BASE}/admin/registrations`, { headers: buildHeaders(session.token) }),
      ]);

      if (![statsRes, organizersRes, volunteersRes, eventsRes, registrationsRes].every((response) => response.ok)) {
        const failedResponse = [statsRes, organizersRes, volunteersRes, eventsRes, registrationsRes].find((response) => !response.ok);
        const failedData = await failedResponse.json();
        throw new Error(failedData.message || 'Unable to load admin dashboard data');
      }

      const [stats, organizers, volunteers, events, registrations] = await Promise.all([
        statsRes.json(),
        organizersRes.json(),
        volunteersRes.json(),
        eventsRes.json(),
        registrationsRes.json(),
      ]);

      setDashboard({ stats, organizers, volunteers, events, registrations });
    } catch (error) {
      setError('Unable to load dashboard data.');
    }
  };

  const loadOrganizerDashboard = async () => {
    setOrganizerLoading(true);
    setError('');

    try {
      const payload = decodeToken(session.token);
      const userId = payload?.id;

      if (!userId) {
        return;
      }

      const response = await fetch(`${API_BASE}/organizer/events/${userId}`, {
        headers: buildHeaders(session.token),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load events');
      }

      setOrganizerEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      setError(error.message);
    } finally {
      setOrganizerLoading(false);
    }
  };

  const loadVolunteerDashboard = async () => {
    try {
      const payload = decodeToken(session.token);
      const volunteerId = payload?.id;

      const [eventsRes, registrationsRes] = await Promise.all([
        fetch(`${API_BASE}/volunteer/events`, { headers: buildHeaders(session.token) }),
        volunteerId
          ? fetch(`${API_BASE}/volunteer/registrations/${volunteerId}`, { headers: buildHeaders(session.token) })
          : Promise.resolve({ ok: true, json: async () => [] }),
      ]);

      const [events, registrations] = await Promise.all([
        eventsRes.json(),
        registrationsRes.json(),
      ]);

      if (!eventsRes.ok) {
        throw new Error(events.message || 'Unable to load events');
      }

      setVolunteerEvents(Array.isArray(events) ? events : []);
      setVolunteerRegistrations(Array.isArray(registrations) ? registrations : []);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleSessionFromToken = (token) => {
    const payload = decodeToken(token);

    if (!payload) {
      setError('Login response was missing a valid token.');
      return;
    }

    setSession({ token, role: payload.role });
    setResult({ message: 'Login successful', token });
    setForm(emptyForm);
    setError('');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const endpoint = mode === 'login' ? `${meta.path}/login` : `${meta.path}/create-${meta.path}`;
      const payload = {
        ...(role === 'admin' && mode === 'register' && { name: form.name }),
        ...(meta.includeUsername && mode === 'register' && { username: form.username }),
        email: form.email,
        password: form.password,
      };

      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: buildHeaders('', true),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      if (mode === 'login' && data.token) {
        handleSessionFromToken(data.token);
      } else {
        setResult(data);
        setForm(emptyForm);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/organizer/events/create`, {
        method: 'POST',
        headers: buildHeaders(session.token),
        body: JSON.stringify(eventForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to create event');
      }

      setEventForm({ name: '', description: '', place: '', eventDate: '', startTime: '09:00', endTime: '12:00' });
      setResult(data);
      await loadOrganizerDashboard();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/organizer/events/${taskForm.eventId}/tasks`, {
        method: 'POST',
        headers: buildHeaders(session.token),
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description,
          requiredVolunteers: Number(taskForm.requiredVolunteers),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to create task');
      }

      setTaskForm({ eventId: '', title: '', description: '', requiredVolunteers: '1' });
      setResult(data);
      await loadOrganizerDashboard();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleVolunteerRegistration = async (taskId, isRegistered) => {
    try {
      if (isRegistered && !window.confirm('Unregister from this task?')) {
        return;
      }

      const response = await fetch(
        isRegistered
          ? `${API_BASE}/volunteer/events/tasks/${taskId}/registration`
          : `${API_BASE}/volunteer/events/register-task`,
        {
        method: isRegistered ? 'DELETE' : 'POST',
        headers: buildHeaders(session.token),
        ...(isRegistered ? {} : { body: JSON.stringify({ taskId }) }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setResult(data);
      await loadVolunteerDashboard();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleAccountStatus = async (accountType, account) => {
    const nextStatus = !account.isActive;
    const action = nextStatus ? 'activate' : 'deactivate';

    if (!window.confirm(`Are you sure you want to ${action} ${account.username}?`)) {
      return;
    }

    const key = `${accountType}-${account.id}`;
    setStatusUpdateId(key);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/${accountType}s/${account.id}/status`, {
        method: 'PATCH',
        headers: buildHeaders(session.token),
        body: JSON.stringify({ isActive: nextStatus }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Unable to ${action} account`);
      }

      setResult(data);
      await loadAdminDashboard();
    } catch (error) {
      setError(error.message);
    } finally {
      setStatusUpdateId('');
    }
  };

  const logout = () => {
    localStorage.removeItem('ngo_token');
    localStorage.removeItem('ngo_role');
    setSession({ token: '', role: '' });
    setDashboard({ stats: null, organizers: [], volunteers: [], events: [], registrations: [] });
    setOrganizerEvents([]);
    setVolunteerEvents([]);
    setVolunteerRegistrations([]);
    setAccount(null);
    setAccountMenuOpen(false);
    setResult(null);
    setError('');
  };

  const handleAccountUpdate = async (event) => {
    event.preventDefault();
    setAccountLoading(true);
    setError('');

    try {
      const body = {
        ...(activeRole === 'admin' ? { name: accountForm.name } : { username: accountForm.username }),
        ...(accountForm.password ? { password: accountForm.password } : {}),
      };
      const response = await fetch(`${API_BASE}/account/profile`, {
        method: 'PATCH',
        headers: buildHeaders(session.token),
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update account');
      }

      setAccount(data.account);
      setAccountForm({
        name: data.account.name || '',
        username: data.account.username || '',
        password: '',
      });
      setResult(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleAccountDelete = async () => {
    if (!window.confirm('Delete your account permanently? This action cannot be undone.')) {
      return;
    }

    setAccountLoading(true);
    try {
      const response = await fetch(`${API_BASE}/account/me`, {
        method: 'DELETE',
        headers: buildHeaders(session.token),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to delete account');
      }

      logout();
    } catch (error) {
      setError(error.message);
      setAccountLoading(false);
    }
  };

  const summaryCards = useMemo(() => {
    if (!dashboard.stats) {
      return [];
    }

    return [
      { label: 'Total Organizers', value: dashboard.stats.organizerCount ?? dashboard.organizers.length },
      { label: 'Total Volunteers', value: dashboard.stats.volunteerCount ?? dashboard.volunteers.length },
      { label: 'Total Events', value: dashboard.stats.eventCount ?? dashboard.events.length },
      { label: 'Total Tasks', value: dashboard.stats.taskCount ?? 0 },
      { label: 'Registrations', value: dashboard.registrations.length },
    ];
  }, [dashboard]);

  const meta = roleMeta[role];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    handleAuthSubmit(event);
  };

  if (isLoggedIn) {
    return (
      <div className="dashboard-shell">
        <header className="topbar">
          <div>
            <span className="badge">NGO Dashboard</span>
            <h2>{activeRole.charAt(0).toUpperCase() + activeRole.slice(1)} workspace</h2>
          </div>
          <div className="account-area">
            <button type="button" className="account-button" onClick={() => setAccountMenuOpen((open) => !open)}>
              <span className="account-icon">{(account?.name || account?.username || account?.email || 'U').charAt(0).toUpperCase()}</span>
              <span>{account?.name || account?.username || 'Account'}</span>
            </button>
            {accountMenuOpen && (
              <div className="account-menu">
                <div className="account-details">
                  <strong>{account?.name || account?.username}</strong>
                  <span>{account?.email}</span>
                  <small>{activeRole}</small>
                </div>
                <form onSubmit={handleAccountUpdate} className="account-form">
                  {activeRole === 'admin' ? (
                    <input type="text" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Name" required />
                  ) : (
                    <input type="text" value={accountForm.username} onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })} placeholder="Username" required />
                  )}
                  <input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} placeholder="New password (optional)" minLength="6" />
                  <button type="submit" className="menu-action" disabled={accountLoading}>{accountLoading ? 'Saving...' : 'Save changes'}</button>
                </form>
                <button type="button" className="menu-action" onClick={logout}>Logout</button>
                <button type="button" className="delete-account-button" onClick={handleAccountDelete} disabled={accountLoading}>Delete account</button>
              </div>
            )}
          </div>
        </header>

        {activeRole === 'admin' && (
          <div className="dashboard-section">
            <div className="stats-grid">
              {summaryCards.map((item) => (
                <div className="stat-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="data-grid">
              <div className="data-panel">
                <h3>Organizers</h3>
                <ul>
                  {dashboard.organizers.map((organizer) => (
                    <li className="managed-row" key={organizer.id}>
                      <span>{organizer.username} - {organizer.email} <em className={organizer.isActive ? 'status-active' : 'status-inactive'}>{organizer.isActive ? 'Active' : 'Inactive'}</em></span>
                      <button type="button" className="small-button management-button" onClick={() => handleAccountStatus('organizer', organizer)} disabled={statusUpdateId === `organizer-${organizer.id}`}>
                        {statusUpdateId === `organizer-${organizer.id}` ? 'Saving...' : organizer.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="data-panel">
                <h3>Volunteers</h3>
                <ul>
                  {dashboard.volunteers.map((volunteer) => (
                    <li className="managed-row" key={volunteer.id}>
                      <span>{volunteer.username} - {volunteer.email} <em className={volunteer.isActive ? 'status-active' : 'status-inactive'}>{volunteer.isActive ? 'Active' : 'Inactive'}</em></span>
                      <button type="button" className="small-button management-button" onClick={() => handleAccountStatus('volunteer', volunteer)} disabled={statusUpdateId === `volunteer-${volunteer.id}`}>
                        {statusUpdateId === `volunteer-${volunteer.id}` ? 'Saving...' : volunteer.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="data-panel wide">
                <h3>Events</h3>
                <ul>
                  {dashboard.events.map((event) => (
                    <li key={event.id}>{event.name} - {event.place} ({new Date(event.eventDate).toLocaleDateString()})</li>
                  ))}
                </ul>
              </div>

              <div className="data-panel wide">
                <h3>Volunteer registrations</h3>
                <ul>
                  {dashboard.registrations.map((registration) => (
                    <li key={registration.id}>
                      {registration.volunteer?.username || 'Volunteer'} - {registration.task?.title || 'Task'} ({registration.status})
                    </li>
                  ))}
                  {!dashboard.registrations.length && <li>No registrations yet</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeRole === 'organizer' && (
          <div className="dashboard-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Organizer tools</span>
                <h3>Events and tasks</h3>
              </div>
              <button type="button" className="refresh-button" onClick={loadOrganizerDashboard} disabled={organizerLoading}>
                {organizerLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="forms-grid">
              <form onSubmit={handleCreateEvent} className="dashboard-form">
                <h3>Create Event</h3>
                <input type="text" placeholder="Event name" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} required />
                <textarea placeholder="Event description" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} required />
                <input type="text" placeholder="Location" value={eventForm.place} onChange={(e) => setEventForm({ ...eventForm, place: e.target.value })} required />
                <div className="inline-fields">
                  <input type="date" value={eventForm.eventDate} onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })} required />
                  <input type="time" value={eventForm.startTime} onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })} required />
                  <input type="time" value={eventForm.endTime} onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })} required />
                </div>
                <button type="submit" className="submit-button">Save Event</button>
              </form>

              <form onSubmit={handleCreateTask} className="dashboard-form">
                <h3>Create Task</h3>
                <select value={taskForm.eventId} onChange={(e) => setTaskForm({ ...taskForm, eventId: e.target.value })} required>
                  <option value="">Select event</option>
                  {organizerEvents.map((event) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <input type="text" placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
                <textarea placeholder="Task description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                <input type="number" min="1" value={taskForm.requiredVolunteers} onChange={(e) => setTaskForm({ ...taskForm, requiredVolunteers: e.target.value })} required />
                <button type="submit" className="submit-button">Add Task</button>
              </form>
            </div>

            <div className="event-list">
              {organizerEvents.map((event) => (
                <div className="event-card" key={event.id}>
                  <h4>{event.name}</h4>
                  <p>{event.description}</p>
                  <small>{event.place} • {new Date(event.eventDate).toLocaleDateString()}</small>
                  <div className="task-list">
                    {(event.tasks || []).map((task) => (
                      <div className="task-item" key={task.id}>
                        <strong>{task.title}</strong>
                        <span>{task.description}</span>
                        <em>{task.filledVolunteers}/{task.requiredVolunteers} volunteers filled</em>
                      </div>
                    ))}
                    {!event.tasks?.length && <p className="empty-state">No tasks added to this event yet.</p>}
                  </div>
                </div>
              ))}
              {!organizerLoading && !organizerEvents.length && (
                <div className="empty-state-panel">Create your first event to start assigning volunteer tasks.</div>
              )}
            </div>
          </div>
        )}

        {activeRole === 'volunteer' && (
          <div className="dashboard-section">
            <div className="data-grid single-column">
              <div className="data-panel">
                <h3>Available events</h3>
                <div className="event-list">
                  {volunteerEvents.map((event) => (
                    <div className="event-card" key={event.id}>
                      <h4>{event.name}</h4>
                      <p>{event.description}</p>
                      <small>{event.place} • {new Date(event.eventDate).toLocaleDateString()}</small>
                      <div className="task-list">
                        {(event.tasks || []).map((task) => (
                          <div className="task-item" key={task.id}>
                            <div>
                              <strong>{task.title}</strong>
                              <span>{task.description}</span>
                            </div>
                            {(() => {
                              const isRegistered = volunteerRegistrations.some((registration) => registration.taskId === task.id);
                              const isFull = task.filledVolunteers >= task.requiredVolunteers;

                              return (
                                <button
                                  type="button"
                                  className={isRegistered ? 'small-button registered-button' : 'small-button'}
                                  onClick={() => handleVolunteerRegistration(task.id, isRegistered)}
                                  disabled={!isRegistered && isFull}
                                >
                                  {isRegistered ? 'Registered - Unregister' : isFull ? 'Full' : 'Register'}
                                </button>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="data-panel">
                <h3>My registrations</h3>
                <ul>
                  {volunteerRegistrations.map((registration) => (
                    <li key={registration.id}>{registration.task?.title || 'Task'} - {registration.status}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {error && <div className="message error">{error}</div>}
        {result && (
          <div className="message success">
            <strong>Success:</strong>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="panel">
        <div className="panel-header">
          <span className="badge">NGO Platform</span>
          <h1>Role-based access</h1>
          <p>{meta.description}</p>
        </div>

        <div className="role-switcher" aria-label="Choose role">
          {Object.entries(roleMeta).map(([key, value]) => (
            <button
              key={key}
              type="button"
              className={role === key ? 'role-button active' : 'role-button'}
              onClick={() => setRole(key)}
            >
              {value.label}
            </button>
          ))}
        </div>

        <div className="mode-switcher">
          <button
            type="button"
            className={mode === 'login' ? 'mode-button active' : 'mode-button'}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'mode-button active' : 'mode-button'}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {role === 'admin' && mode === 'register' && (
            <label>
              Name
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
            </label>
          )}

          {meta.includeUsername && mode === 'register' && (
            <label>
              Username
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Enter username"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
            />
          </label>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        {error && <div className="message error">{error}</div>}

        {result && (
          <div className="message success">
            <strong>Success:</strong>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
