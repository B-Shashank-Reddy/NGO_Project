const test = require("node:test");
const assert = require("node:assert/strict");

const API_BASE = process.env.API_BASE || "http://localhost:5001";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const credentials = {
  admin: {
    name: "Integration Admin",
    email: `integration-admin-${suffix}@example.com`,
    password: "admin123",
  },
  organizer: {
    username: `integration-organizer-${suffix}`,
    email: `integration-organizer-${suffix}@example.com`,
    password: "organizer123",
  },
  volunteer: {
    username: `integration-volunteer-${suffix}`,
    email: `integration-volunteer-${suffix}@example.com`,
    password: "volunteer123",
  },
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const responseText = await response.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Expected JSON from ${options.method || "GET"} ${path}, received ${response.status}: ${responseText.slice(0, 160)}`);
  }

  return { response, data };
};

const register = async (role) => {
  const endpoint = role === "admin" ? "/admin/create-admin" : `/${role}/create-${role}`;
  const { response, data } = await request(endpoint, {
    method: "POST",
    body: credentials[role],
  });

  assert.equal(response.status, 201, `${role} registration should succeed: ${JSON.stringify(data)}`);
  assert.ok(data[role], `${role} registration should return the created user`);
  assert.equal(data[role].email, credentials[role].email);
  return data[role];
};

const login = async (role) => {
  const { response, data } = await request(`/${role}/login`, {
    method: "POST",
    body: {
      email: credentials[role].email,
      password: credentials[role].password,
    },
  });

  assert.equal(response.status, 200, `${role} login should succeed: ${JSON.stringify(data)}`);
  assert.equal(typeof data.token, "string");
  assert.ok(data.token.length > 20);
  return data.token;
};

test("authentication and protected role workflows", async () => {
  const health = await request("/health");
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.data, { status: "ok", database: "connected" });

  await register("admin");
  const organizer = await register("organizer");
  const volunteer = await register("volunteer");

  const duplicateOrganizer = await request("/organizer/create-organizer", {
    method: "POST",
    body: credentials.organizer,
  });
  assert.equal(duplicateOrganizer.response.status, 409);
  assert.match(duplicateOrganizer.data.message, /already exists/i);

  const adminToken = await login("admin");
  const organizerToken = await login("organizer");
  const volunteerToken = await login("volunteer");

  const currentAccount = await request("/account/me", { token: adminToken });
  assert.equal(currentAccount.response.status, 200);
  assert.equal(currentAccount.data.account.email, credentials.admin.email);
  assert.equal(currentAccount.data.account.password, undefined);

  const updatedAccount = await request("/account/profile", {
    method: "PATCH",
    token: adminToken,
    body: { name: "Updated Integration Admin" },
  });
  assert.equal(updatedAccount.response.status, 200);
  assert.equal(updatedAccount.data.account.name, "Updated Integration Admin");

  const deletedAccountCredentials = {
    username: `delete-me-${suffix}`,
    email: `delete-me-${suffix}@example.com`,
    password: "delete123",
  };
  const deletedAccount = await request("/volunteer/create-volunteer", {
    method: "POST",
    body: deletedAccountCredentials,
  });
  assert.equal(deletedAccount.response.status, 201);
  const deletedAccountLoginBeforeDelete = await request("/volunteer/login", {
    method: "POST",
    body: { email: deletedAccountCredentials.email, password: deletedAccountCredentials.password },
  });
  assert.equal(deletedAccountLoginBeforeDelete.response.status, 200);
  const deletedAccountToken = deletedAccountLoginBeforeDelete.data.token;

  const deletedAccountResult = await request("/account/me", {
    method: "DELETE",
    token: deletedAccountToken,
  });
  assert.equal(deletedAccountResult.response.status, 200);

  const deletedAccountLogin = await request("/volunteer/login", {
    method: "POST",
    body: { email: deletedAccountCredentials.email, password: deletedAccountCredentials.password },
  });
  assert.equal(deletedAccountLogin.response.status, 401);

  const deactivateOrganizer = await request(`/admin/organizers/${organizer.id}/status`, {
    method: "PATCH",
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(deactivateOrganizer.response.status, 200);
  assert.equal(deactivateOrganizer.data.organizer.isActive, false);

  const inactiveOrganizerLogin = await request("/organizer/login", {
    method: "POST",
    body: { email: credentials.organizer.email, password: credentials.organizer.password },
  });
  assert.equal(inactiveOrganizerLogin.response.status, 403);

  const reactivateOrganizer = await request(`/admin/organizers/${organizer.id}/status`, {
    method: "PATCH",
    token: adminToken,
    body: { isActive: true },
  });
  assert.equal(reactivateOrganizer.response.status, 200);

  const deactivateVolunteer = await request(`/admin/volunteers/${volunteer.id}/status`, {
    method: "PATCH",
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(deactivateVolunteer.response.status, 200);
  assert.equal(deactivateVolunteer.data.volunteer.isActive, false);

  const inactiveVolunteerLogin = await request("/volunteer/login", {
    method: "POST",
    body: { email: credentials.volunteer.email, password: credentials.volunteer.password },
  });
  assert.equal(inactiveVolunteerLogin.response.status, 403);

  const reactivateVolunteer = await request(`/admin/volunteers/${volunteer.id}/status`, {
    method: "PATCH",
    token: adminToken,
    body: { isActive: true },
  });
  assert.equal(reactivateVolunteer.response.status, 200);

  const missingToken = await request("/admin/dashboard");
  assert.equal(missingToken.response.status, 401);

  const invalidPassword = await request("/admin/login", {
    method: "POST",
    body: { email: credentials.admin.email, password: "wrong-password" },
  });
  assert.equal(invalidPassword.response.status, 401);

  const adminDashboard = await request("/admin/dashboard", { token: adminToken });
  assert.equal(adminDashboard.response.status, 200);
  assert.equal(typeof adminDashboard.data.organizerCount, "number");
  assert.equal(typeof adminDashboard.data.volunteerCount, "number");

  const wrongRole = await request("/admin/dashboard", { token: volunteerToken });
  assert.equal(wrongRole.response.status, 403);

  const event = await request("/organizer/events/create", {
    method: "POST",
    token: organizerToken,
    body: {
      name: `Integration Event ${suffix}`,
      description: "Event created by automated integration testing",
      place: "Integration Hall",
      eventDate: "2026-10-01",
      startTime: "09:00",
      endTime: "12:00",
    },
  });
  assert.equal(event.response.status, 201, JSON.stringify(event.data));
  const eventId = event.data.event.id;

  const task = await request(`/organizer/events/${eventId}/tasks`, {
    method: "POST",
    token: organizerToken,
    body: {
      title: "Integration Task",
      description: "Task created by automated integration testing",
      requiredVolunteers: 1,
    },
  });
  assert.equal(task.response.status, 201, JSON.stringify(task.data));
  const taskId = task.data.task.id;

  const volunteerEvents = await request("/volunteer/events", { token: volunteerToken });
  assert.equal(volunteerEvents.response.status, 200);
  assert.ok(volunteerEvents.data.some((listedEvent) => listedEvent.id === eventId));

  const registration = await request("/volunteer/events/register-task", {
    method: "POST",
    token: volunteerToken,
    body: { taskId },
  });
  assert.equal(registration.response.status, 201, JSON.stringify(registration.data));
  const volunteerId = registration.data.registration.volunteerId;

  const duplicateRegistration = await request("/volunteer/events/register-task", {
    method: "POST",
    token: volunteerToken,
    body: { taskId },
  });
  assert.equal(duplicateRegistration.response.status, 400);
  assert.match(duplicateRegistration.data.message, /already registered/i);

  const registrations = await request(`/volunteer/registrations/${volunteerId}`, {
    token: volunteerToken,
  });
  assert.equal(registrations.response.status, 200);
  assert.ok(registrations.data.some((item) => item.taskId === taskId));

  const unregistration = await request(`/volunteer/events/tasks/${taskId}/registration`, {
    method: "DELETE",
    token: volunteerToken,
  });
  assert.equal(unregistration.response.status, 200, JSON.stringify(unregistration.data));

  const registrationsAfterUnregister = await request(`/volunteer/registrations/${volunteerId}`, {
    token: volunteerToken,
  });
  assert.equal(registrationsAfterUnregister.response.status, 200);
  assert.ok(!registrationsAfterUnregister.data.some((item) => item.taskId === taskId));

  const registrationAfterUnregister = await request("/volunteer/events/register-task", {
    method: "POST",
    token: volunteerToken,
    body: { taskId },
  });
  assert.equal(registrationAfterUnregister.response.status, 201, JSON.stringify(registrationAfterUnregister.data));
});