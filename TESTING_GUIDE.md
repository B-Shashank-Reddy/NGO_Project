# NGO Platform - Testing Guide with Thunder Client

## Server Status

- **URL**: http://localhost:5001
- **Status**: Running ✅
- **Database**: ngo_platform (PostgreSQL)

---

## Test Workflow Overview

This guide walks through:

1. **Registration** - Create new users (admin, organizer, volunteer)
2. **Login** - Get JWT tokens for each role
3. **Protected Routes** - Use tokens to access role-specific endpoints
4. **Data Verification** - Check created data in pgAdmin

---

## Part 1: Admin Flow

### Step 1.1: Create an Admin

```
POST http://localhost:5001/admin/create-admin

Headers:
Content-Type: application/json

Body:
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "admin123"
}

Expected Response:
{
  "message": "Admin created",
  "admin": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com"
  }
}
```

### Step 1.2: Admin Login (Get Token)

```
POST http://localhost:5001/admin/login

Headers:
Content-Type: application/json

Body:
{
  "email": "admin@example.com",
  "password": "admin123"
}

Expected Response:
{
  "message": "Admin login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

✅ Save this token as: {{ADMIN_TOKEN}}
```

### Step 1.3: Access Admin Dashboard (Protected)

```
GET http://localhost:5001/admin/dashboard

Headers:
Content-Type: application/json
Authorization: Bearer {{ADMIN_TOKEN}}

Expected Response:
{
  "organizerCount": 0,
  "volunteerCount": 0,
  "eventCount": 0,
  "taskCount": 0
}
```

### Step 1.4: View All Organizers (Protected)

```
GET http://localhost:5001/admin/organizers

Headers:
Content-Type: application/json
Authorization: Bearer {{ADMIN_TOKEN}}

Expected Response:
[]
(Empty array initially)
```

---

## Part 2: Organizer Flow

### Step 2.1: Create an Organizer

```
POST http://localhost:5001/organizer/create-organizer

Headers:
Content-Type: application/json

Body:
{
  "username": "organizer_john",
  "email": "organizer@example.com",
  "password": "organizer123"
}

Expected Response:
{
  "message": "Organizer created",
  "organizer": {
    "id": 1,
    "username": "organizer_john",
    "email": "organizer@example.com"
  }
}
```

### Step 2.2: Organizer Login (Get Token)

```
POST http://localhost:5001/organizer/login

Headers:
Content-Type: application/json

Body:
{
  "email": "organizer@example.com",
  "password": "organizer123"
}

Expected Response:
{
  "message": "Organizer login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

✅ Save this token as: {{ORGANIZER_TOKEN}}
```

### Step 2.3: Create an Event (Protected)

```
POST http://localhost:5001/organizer/events/create

Headers:
Content-Type: application/json
Authorization: Bearer {{ORGANIZER_TOKEN}}

Body:
{
  "organizerId": 1,
  "name": "Community Cleanup Drive",
  "description": "Help us clean up the local park and community areas",
  "place": "Central Park, Downtown",
  "eventDate": "2026-09-15",
  "startTime": "09:00",
  "endTime": "12:00"
}

Expected Response:
{
  "message": "Event created",
  "event": {
    "id": 1,
    "organizerId": 1,
    "name": "Community Cleanup Drive",
    "description": "Help us clean up the local park and community areas",
    "place": "Central Park, Downtown",
    "eventDate": "2026-09-15",
    "startTime": "09:00",
    "endTime": "12:00",
    "createdAt": "2026-08-13T...",
    "updatedAt": "2026-08-13T..."
  }
}
```

### Step 2.4: Create a Task for Event (Protected)

```
POST http://localhost:5001/organizer/events/1/tasks

Headers:
Content-Type: application/json
Authorization: Bearer {{ORGANIZER_TOKEN}}

Body:
{
  "title": "Trash Collection",
  "description": "Collect and sort trash from designated areas",
  "requiredVolunteers": 5
}

Expected Response:
{
  "message": "Task created",
  "task": {
    "id": 1,
    "eventId": 1,
    "title": "Trash Collection",
    "description": "Collect and sort trash from designated areas",
    "requiredVolunteers": 5,
    "filledVolunteers": 0,
    "createdAt": "2026-08-13T...",
    "updatedAt": "2026-08-13T..."
  }
}
```

### Step 2.5: Get All Events (Protected)

```
GET http://localhost:5001/organizer/events/1

Headers:
Content-Type: application/json
Authorization: Bearer {{ORGANIZER_TOKEN}}

Expected Response:
[
  {
    "id": 1,
    "organizerId": 1,
    "name": "Community Cleanup Drive",
    "description": "Help us clean up the local park and community areas",
    "place": "Central Park, Downtown",
    "eventDate": "2026-09-15",
    "startTime": "09:00",
    "endTime": "12:00",
    "tasks": [
      {
        "id": 1,
        "eventId": 1,
        "title": "Trash Collection",
        "description": "Collect and sort trash from designated areas",
        "requiredVolunteers": 5,
        "filledVolunteers": 0
      }
    ]
  }
]
```

---

## Part 3: Volunteer Flow

### Step 3.1: Create a Volunteer

```
POST http://localhost:5001/volunteer/create-volunteer

Headers:
Content-Type: application/json

Body:
{
  "username": "volunteer_sarah",
  "email": "volunteer@example.com",
  "password": "volunteer123"
}

Expected Response:
{
  "message": "Volunteer created",
  "volunteer": {
    "id": 1,
    "username": "volunteer_sarah",
    "email": "volunteer@example.com"
  }
}
```

### Step 3.2: Volunteer Login (Get Token)

```
POST http://localhost:5001/volunteer/login

Headers:
Content-Type: application/json

Body:
{
  "email": "volunteer@example.com",
  "password": "volunteer123"
}

Expected Response:
{
  "message": "Volunteer login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

✅ Save this token as: {{VOLUNTEER_TOKEN}}
```

### Step 3.3: View All Events (Protected)

```
GET http://localhost:5001/volunteer/events

Headers:
Content-Type: application/json
Authorization: Bearer {{VOLUNTEER_TOKEN}}

Expected Response:
[
  {
    "id": 1,
    "organizerId": 1,
    "name": "Community Cleanup Drive",
    "description": "Help us clean up the local park and community areas",
    "place": "Central Park, Downtown",
    "eventDate": "2026-09-15",
    "startTime": "09:00",
    "endTime": "12:00",
    "tasks": [
      {
        "id": 1,
        "eventId": 1,
        "title": "Trash Collection",
        "description": "Collect and sort trash from designated areas",
        "requiredVolunteers": 5,
        "filledVolunteers": 0
      }
    ]
  }
]
```

### Step 3.4: Get Event Details (Protected)

```
GET http://localhost:5001/volunteer/events/1

Headers:
Content-Type: application/json
Authorization: Bearer {{VOLUNTEER_TOKEN}}

Expected Response:
{
  "id": 1,
  "organizerId": 1,
  "name": "Community Cleanup Drive",
  "description": "Help us clean up the local park and community areas",
  "place": "Central Park, Downtown",
  "eventDate": "2026-09-15",
  "startTime": "09:00",
  "endTime": "12:00",
  "tasks": [
    {
      "id": 1,
      "eventId": 1,
      "title": "Trash Collection",
      "description": "Collect and sort trash from designated areas",
      "requiredVolunteers": 5,
      "filledVolunteers": 0
    }
  ]
}
```

### Step 3.5: Register for a Task (Protected)

```
POST http://localhost:5001/volunteer/events/register-task

Headers:
Content-Type: application/json
Authorization: Bearer {{VOLUNTEER_TOKEN}}

Body:
{
  "volunteerId": 1,
  "taskId": 1
}

Expected Response:
{
  "message": "Volunteer registered for task",
  "registration": {
    "id": 1,
    "volunteerId": 1,
    "taskId": 1,
    "status": "registered",
    "createdAt": "2026-08-13T...",
    "updatedAt": "2026-08-13T..."
  }
}
```

### Step 3.6: Get Volunteer Registrations (Protected)

```
GET http://localhost:5001/volunteer/registrations/1

Headers:
Content-Type: application/json
Authorization: Bearer {{VOLUNTEER_TOKEN}}

Expected Response:
[
  {
    "id": 1,
    "volunteerId": 1,
    "taskId": 1,
    "status": "registered",
    "task": {
      "id": 1,
      "eventId": 1,
      "title": "Trash Collection",
      "description": "Collect and sort trash from designated areas",
      "requiredVolunteers": 5,
      "filledVolunteers": 1
    }
  }
]
```

---

## Part 4: Admin Verification Routes

### Step 4.1: View All Volunteers (Protected - Admin Only)

```
GET http://localhost:5001/admin/volunteers

Headers:
Content-Type: application/json
Authorization: Bearer {{ADMIN_TOKEN}}

Expected Response:
[
  {
    "id": 1,
    "username": "volunteer_sarah",
    "email": "volunteer@example.com"
  }
]
```

### Step 4.2: View All Events (Protected - Admin Only)

```
GET http://localhost:5001/admin/events

Headers:
Content-Type: application/json
Authorization: Bearer {{ADMIN_TOKEN}}

Expected Response:
[
  {
    "id": 1,
    "organizerId": 1,
    "name": "Community Cleanup Drive",
    "description": "Help us clean up the local park and community areas",
    "place": "Central Park, Downtown",
    "eventDate": "2026-09-15",
    "startTime": "09:00",
    "endTime": "12:00",
    "tasks": [
      {
        "id": 1,
        "eventId": 1,
        "title": "Trash Collection",
        "description": "Collect and sort trash from designated areas",
        "requiredVolunteers": 5,
        "filledVolunteers": 1
      }
    ]
  }
]
```

### Step 4.3: View All Registrations (Protected - Admin Only)

```
GET http://localhost:5001/admin/registrations

Headers:
Content-Type: application/json
Authorization: Bearer {{ADMIN_TOKEN}}

Expected Response:
[
  {
    "id": 1,
    "volunteerId": 1,
    "taskId": 1,
    "status": "registered",
    "volunteer": {
      "id": 1,
      "username": "volunteer_sarah",
      "email": "volunteer@example.com"
    },
    "task": {
      "id": 1,
      "eventId": 1,
      "title": "Trash Collection",
      "description": "Collect and sort trash from designated areas",
      "requiredVolunteers": 5,
      "filledVolunteers": 1
    }
  }
]
```

---

## Part 5: Error Testing (To Verify Auth Works)

### Test 5.1: Missing Token

```
GET http://localhost:5001/admin/dashboard

Headers:
Content-Type: application/json
(No Authorization header)

Expected Response (401):
{
  "message": "Authorization token missing"
}
```

### Test 5.2: Invalid Token

```
GET http://localhost:5001/admin/dashboard

Headers:
Content-Type: application/json
Authorization: Bearer invalid_token_here

Expected Response (401):
{
  "message": "Invalid or expired token"
}
```

### Test 5.3: Wrong Role (Volunteer Accessing Admin Route)

```
GET http://localhost:5001/admin/dashboard

Headers:
Content-Type: application/json
Authorization: Bearer {{VOLUNTEER_TOKEN}}

Expected Response (403):
{
  "message": "Forbidden: insufficient permissions"
}
```

---

## Testing Checklist

- [ ] Step 1.1: Create Admin
- [ ] Step 1.2: Admin Login (Save token)
- [ ] Step 1.3: Admin Dashboard Access
- [ ] Step 1.4: View Organizers (should be empty)
- [ ] Step 2.1: Create Organizer
- [ ] Step 2.2: Organizer Login (Save token)
- [ ] Step 2.3: Create Event
- [ ] Step 2.4: Create Task
- [ ] Step 2.5: Get Events
- [ ] Step 3.1: Create Volunteer
- [ ] Step 3.2: Volunteer Login (Save token)
- [ ] Step 3.3: View All Events
- [ ] Step 3.4: Get Event Details
- [ ] Step 3.5: Register for Task
- [ ] Step 3.6: Get Registrations
- [ ] Step 4.1: Admin View Volunteers
- [ ] Step 4.2: Admin View Events
- [ ] Step 4.3: Admin View Registrations
- [ ] Test 5.1: Missing Token Error
- [ ] Test 5.2: Invalid Token Error
- [ ] Test 5.3: Role Permission Error

---

## Next: View Data in pgAdmin

After running tests, follow [PGADMIN_GUIDE.md](PGADMIN_GUIDE.md) to view the data.
