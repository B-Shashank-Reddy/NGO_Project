import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
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
  locationLabel: '',
  latitude: '',
  longitude: '',
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
  const [volunteerSort, setVolunteerSort] = useState('soonest');
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [volunteerPage, setVolunteerPage] = useState(1);
  const [volunteerHasNext, setVolunteerHasNext] = useState(false);
  const [eventWeather, setEventWeather] = useState({});
  const [eventForm, setEventForm] = useState({ name: '', description: '', place: '', locationLabel: '', latitude: '', longitude: '', eventDate: '', startTime: '09:00', endTime: '12:00' });
  const [taskForm, setTaskForm] = useState({ eventId: '', title: '', description: '', requiredVolunteers: '1' });
  const [statusUpdateId, setStatusUpdateId] = useState('');
  const [account, setAccount] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', username: '', password: '', locationLabel: '', latitude: '', longitude: '' });
  const [accountLoading, setAccountLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [eventLocationSuggestions, setEventLocationSuggestions] = useState([]);
  const [eventLocationLoading, setEventLocationLoading] = useState(false);

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
      setVolunteerPage(1);
      loadVolunteerDashboard(volunteerSort, 1, false);
    }
  }, [session.role, session.token, volunteerSort]);

  useEffect(() => {
    if (session.token) {
      loadAccount();
    }
  }, [session.token]);

  useEffect(() => {
    if (mode !== 'register' || form.locationLabel.trim().length < 3 || (form.latitude && form.longitude)) {
      setLocationSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLocationLoading(true);

      try {
        const response = await fetch(`${API_BASE}/location/search?q=${encodeURIComponent(form.locationLabel)}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok) {
          setLocationSuggestions(data.locations || []);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setError('Location search is temporarily unavailable.');
        }
      } finally {
        setLocationLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.locationLabel, form.latitude, form.longitude, mode]);

  useEffect(() => {
    if (!accountMenuOpen || accountForm.locationLabel.trim().length < 3 || (accountForm.latitude && accountForm.longitude)) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLocationLoading(true);

      try {
        const response = await fetch(`${API_BASE}/location/search?q=${encodeURIComponent(accountForm.locationLabel)}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok) {
          setLocationSuggestions(data.locations || []);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setError('Location search is temporarily unavailable.');
        }
      } finally {
        setLocationLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [accountForm.locationLabel, accountForm.latitude, accountForm.longitude, accountMenuOpen]);

  useEffect(() => {
    if (activeRole !== 'organizer' || eventForm.locationLabel.trim().length < 3 || (eventForm.latitude && eventForm.longitude)) {
      setEventLocationSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEventLocationLoading(true);

      try {
        const response = await fetch(`${API_BASE}/location/search?q=${encodeURIComponent(eventForm.locationLabel)}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok) {
          setEventLocationSuggestions(data.locations || []);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setError('Location search is temporarily unavailable.');
        }
      } finally {
        setEventLocationLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeRole, eventForm.locationLabel, eventForm.latitude, eventForm.longitude]);

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
        locationLabel: data.account.locationLabel || '',
        latitude: data.account.latitude ?? '',
        longitude: data.account.longitude ?? '',
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

  const loadVolunteerDashboard = async (sort = volunteerSort, page = 1, append = false) => {
    setVolunteerLoading(true);

    try {
      const payload = decodeToken(session.token);
      const volunteerId = payload?.id;

      const [eventsRes, registrationsRes] = await Promise.all([
        fetch(`${API_BASE}/volunteer/events?sort=${encodeURIComponent(sort)}&page=${page}&limit=20`, { headers: buildHeaders(session.token) }),
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

      const nextEvents = Array.isArray(events.events) ? events.events : [];
      setVolunteerEvents((currentEvents) => (append ? [...currentEvents, ...nextEvents] : nextEvents));
      setVolunteerPage(events.page || page);
      setVolunteerHasNext(Boolean(events.hasNext));
      setVolunteerRegistrations(Array.isArray(registrations) ? registrations : []);
      await loadEventWeather(Array.isArray(events.events) ? events.events : []);
    } catch (error) {
      setError(error.message);
    } finally {
      setVolunteerLoading(false);
    }
  };

  const loadEventWeather = async (events) => {
    const weatherEntries = await Promise.all(events.map(async (event) => {
      try {
        const response = await fetch(`${API_BASE}/events/${event.id}/weather`, {
          headers: buildHeaders(session.token),
        });
        const data = await response.json();
        return [event.id, response.ok ? data : { unavailable: true, message: data.message }];
      } catch (error) {
        return [event.id, { unavailable: true, message: 'Weather unavailable' }];
      }
    }));

    setEventWeather(Object.fromEntries(weatherEntries));
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
        ...(mode === 'register' && {
          locationLabel: form.locationLabel,
          latitude: form.latitude,
          longitude: form.longitude,
        }),
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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser location is not available. Enter coordinates manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((prev) => ({ ...prev, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
        setError('');
      },
      () => setError('Location permission was not granted. Enter coordinates manually.'),
    );
  };

  const selectLocation = (location) => {
    setForm((prev) => ({
      ...prev,
      locationLabel: location.locationLabel,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    }));
    setLocationSuggestions([]);
    setError('');
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

      setEventForm({ name: '', description: '', place: '', locationLabel: '', latitude: '', longitude: '', eventDate: '', startTime: '09:00', endTime: '12:00' });
      setResult(data);
      await loadOrganizerDashboard();
    } catch (error) {
      setError(error.message);
    }
  };

  const useCurrentEventLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser location is not available. Search for an event location instead.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setEventForm((prev) => ({
          ...prev,
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
          locationLabel: prev.locationLabel || 'Current device location',
          place: prev.locationLabel || 'Current device location',
        }));
        setError('');
      },
      () => setError('Location permission was not granted. Search for an event location instead.'),
    );
  };

  const selectEventLocation = (location) => {
    setEventForm((prev) => ({
      ...prev,
      place: location.locationLabel,
      locationLabel: location.locationLabel,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    }));
    setEventLocationSuggestions([]);
    setError('');
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
      await loadVolunteerDashboard(volunteerSort, 1, false);
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
    setVolunteerSort('soonest');
    setVolunteerPage(1);
    setVolunteerHasNext(false);
    setVolunteerRegistrations([]);
    setEventWeather({});
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
        locationLabel: accountForm.locationLabel,
        latitude: accountForm.latitude,
        longitude: accountForm.longitude,
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
        locationLabel: data.account.locationLabel || '',
        latitude: data.account.latitude ?? '',
        longitude: data.account.longitude ?? '',
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

  const useCurrentAccountLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser location is not available. Search for a location instead.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setAccountForm((prev) => ({
          ...prev,
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
        }));
        setError('');
      },
      () => setError('Location permission was not granted. Search for a location instead.'),
    );
  };

  const selectAccountLocation = (location) => {
    setAccountForm((prev) => ({
      ...prev,
      locationLabel: location.locationLabel,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    }));
    setLocationSuggestions([]);
    setError('');
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
                  <label className="account-location-label">
                    Location
                    <input
                      type="text"
                      value={accountForm.locationLabel}
                      onChange={(event) => setAccountForm((prev) => ({ ...prev, locationLabel: event.target.value, latitude: '', longitude: '' }))}
                      placeholder="Search city or address"
                      autoComplete="off"
                    />
                  </label>
                  <div className="location-fields account-location-fields">
                    <input type="number" value={accountForm.latitude} onChange={(event) => setAccountForm({ ...accountForm, latitude: event.target.value })} placeholder="Latitude" min="-90" max="90" step="any" />
                    <input type="number" value={accountForm.longitude} onChange={(event) => setAccountForm({ ...accountForm, longitude: event.target.value })} placeholder="Longitude" min="-180" max="180" step="any" />
                  </div>
                  {locationLoading && <small className="location-hint">Searching locations...</small>}
                  {!!locationSuggestions.length && (
                    <div className="location-suggestions account-location-suggestions">
                      {locationSuggestions.map((location) => (
                        <button type="button" key={`${location.latitude}-${location.longitude}-${location.locationLabel}`} onClick={() => selectAccountLocation(location)}>
                          <strong>{location.locationLabel}</strong>
                          <span>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" className="location-button" onClick={useCurrentAccountLocation}>Use current location</button>
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
                <label className="event-location-label">
                  Event location
                  <input
                    type="text"
                    placeholder="Search exact venue or address"
                    value={eventForm.locationLabel}
                    onChange={(e) => setEventForm({ ...eventForm, place: e.target.value, locationLabel: e.target.value, latitude: '', longitude: '' })}
                    autoComplete="off"
                    required
                  />
                  {eventLocationLoading && <small className="location-hint">Searching locations...</small>}
                  {!!eventLocationSuggestions.length && (
                    <div className="location-suggestions">
                      {eventLocationSuggestions.map((location) => (
                        <button type="button" key={`${location.latitude}-${location.longitude}-${location.locationLabel}`} onClick={() => selectEventLocation(location)}>
                          <strong>{location.locationLabel}</strong>
                          <span>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                <div className="location-fields">
                  <input type="number" placeholder="Latitude" value={eventForm.latitude} min="-90" max="90" step="any" readOnly required />
                  <input type="number" placeholder="Longitude" value={eventForm.longitude} min="-180" max="180" step="any" readOnly required />
                </div>
                <button type="button" className="location-button" onClick={useCurrentEventLocation}>Use current location</button>
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
                <div className="section-heading volunteer-heading">
                  <div>
                    <span className="eyebrow">Volunteer discovery</span>
                    <h3>Available events</h3>
                  </div>
                  <label className="sort-control">
                    Sort by
                    <select value={volunteerSort} onChange={(event) => setVolunteerSort(event.target.value)} disabled={volunteerLoading}>
                      <option value="nearest">Nearest location</option>
                      <option value="soonest">Soonest date</option>
                      <option value="newest">Recently added</option>
                      <option value="available">Most available</option>
                    </select>
                  </label>
                </div>
                <div className="event-list">
                  {volunteerEvents.map((event) => (
                    <div className="event-card" key={event.id}>
                      <h4>{event.name}</h4>
                      <p>{event.description}</p>
                      <small>{event.locationLabel || event.place} • {new Date(event.eventDate).toLocaleDateString()}</small>
                      <div className="event-meta">
                        {event.distanceKm !== null && <span>{event.distanceKm} km away</span>}
                        <span>{event.availableSlots} volunteer slots available</span>
                      </div>
                      {eventWeather[event.id] && !eventWeather[event.id].unavailable && (
                        <div className="weather-card">
                          <div>
                            <strong>{eventWeather[event.id].condition}</strong>
                            <span>{eventWeather[event.id].temperature.min}°C - {eventWeather[event.id].temperature.max}°C</span>
                          </div>
                          <div>
                            <span>Rain {eventWeather[event.id].rainProbability ?? 0}%</span>
                            <span>Wind {eventWeather[event.id].windSpeed} {eventWeather[event.id].windUnit}</span>
                          </div>
                        </div>
                      )}
                      {eventWeather[event.id]?.unavailable && <small className="weather-unavailable">Weather forecast unavailable for this event date.</small>}
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
                  {volunteerLoading && <div className="empty-state-panel">Loading events...</div>}
                  {!volunteerLoading && !volunteerEvents.length && <div className="empty-state-panel">No active events match this view.</div>}
                  {!volunteerLoading && volunteerHasNext && (
                    <button type="button" className="load-more-button" onClick={() => loadVolunteerDashboard(volunteerSort, volunteerPage + 1, true)}>
                      Load more events
                    </button>
                  )}
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

          {mode === 'register' && (
            <>
              <label>
                Location
                <input
                  type="text"
                  name="locationLabel"
                  value={form.locationLabel}
                  onChange={(event) => setForm((prev) => ({ ...prev, locationLabel: event.target.value, latitude: '', longitude: '' }))}
                  placeholder="Search city or address"
                  autoComplete="off"
                  required
                />
                {locationLoading && <small className="location-hint">Searching locations...</small>}
                {!!locationSuggestions.length && (
                  <div className="location-suggestions">
                    {locationSuggestions.map((location) => (
                      <button type="button" key={`${location.latitude}-${location.longitude}-${location.locationLabel}`} onClick={() => selectLocation(location)}>
                        <strong>{location.locationLabel}</strong>
                        <span>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <div className="location-fields">
                <input type="number" name="latitude" value={form.latitude} onChange={handleChange} placeholder="Latitude" min="-90" max="90" step="any" required />
                <input type="number" name="longitude" value={form.longitude} onChange={handleChange} placeholder="Longitude" min="-180" max="180" step="any" required />
              </div>
              <button type="button" className="location-button" onClick={useCurrentLocation}>Use my current location</button>
            </>
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
