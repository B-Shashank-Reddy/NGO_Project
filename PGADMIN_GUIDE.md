# How to View Data in pgAdmin

## What is pgAdmin?

pgAdmin is a **web-based management tool for PostgreSQL**. It lets you:

- View all databases and tables
- See the data stored in each table
- Run queries
- Manage users and permissions

---

## Step 1: Open pgAdmin

1. Open your browser
2. Go to: **http://localhost:5050**
3. Login with credentials (you set during pgAdmin installation):
   - **Email/Username**: `postgres` (or whatever you set)
   - **Password**: (password you set during installation)

---

## Step 2: Navigate to the Database

1. Left panel → Expand **Servers**
2. Click on your server (usually `PostgreSQL 15` or similar)
3. Expand **Databases**
4. Click on **ngo_platform** (our database)

You'll see:

- Tables
- Views
- Functions
- Schemas

---

## Step 3: View Individual Tables

### View Admins Table

1. Expand **ngo_platform** → **Schemas** → **public** → **Tables**
2. Right-click on **Admins**
3. Select **View/Edit Data** → **All Rows**

You'll see:

```
id | name        | email              | password                    | createdAt | updatedAt
---|-------------|--------------------|-----------------------------|-----------|----------
1  | Admin User  | admin@example.com  | $2a$10$hash...             | ...       | ...
```

### View Organizers Table

1. Right-click on **Organizers**
2. Select **View/Edit Data** → **All Rows**

You'll see:

```
id | username       | email                  | password                    | createdAt | updatedAt
---|----------------|------------------------|-----------------------------|-----------|-----------
1  | organizer_john | organizer@example.com  | $2a$10$hash...             | ...       | ...
```

### View Events Table

1. Right-click on **Events**
2. Select **View/Edit Data** → **All Rows**

You'll see:

```
id | organizerId | name                    | description              | place              | eventDate  | startTime | endTime
---|-------------|-------------------------|--------------------------|--------------------|-----------|---------|---------
1  | 1           | Community Cleanup Drive | Help us clean up... | Central Park, Downtown | 2026-09-15 | 09:00   | 12:00
```

### View Tasks Table

1. Right-click on **Tasks**
2. Select **View/Edit Data** → **All Rows**

You'll see:

```
id | eventId | title              | description                 | requiredVolunteers | filledVolunteers | createdAt | updatedAt
---|---------|--------------------|-----------------------------|--------------------|--------------------|-----------|----------
1  | 1       | Trash Collection   | Collect and sort trash... | 5                  | 1                  | ...       | ...
```

### View Volunteers Table

1. Right-click on **Volunteers**
2. Select **View/Edit Data** → **All Rows**

You'll see:

```
id | username         | email                 | password                    | createdAt | updatedAt
---|------------------|-----------------------|-----------------------------|-----------|-----------
1  | volunteer_sarah  | volunteer@example.com | $2a$10$hash...             | ...       | ...
```

### View VolunteerTaskRegistrations Table

1. Right-click on **VolunteerTaskRegistrations**
2. Select **View/Edit Data** → **All Rows**

You'll see:

```
id | volunteerId | taskId | status       | createdAt | updatedAt
---|-------------|--------|--------------|-----------|----------
1  | 1           | 1      | registered   | ...       | ...
```

---

## Step 4: Understanding the Data

### Password Hash

- Passwords are **hashed** with bcryptjs
- They look like: `$2a$10$6tH2KYZJxH...`
- They are **never stored in plain text**
- Only password comparison works during login

### Timestamps

- `createdAt`: When the record was created
- `updatedAt`: When the record was last modified
- Format: `2026-08-13 10:30:45.123+00`

### Foreign Keys

- `organizerId` in Events links to `id` in Organizers
- `eventId` in Tasks links to `id` in Events
- `volunteerId` and `taskId` in VolunteerTaskRegistrations link to Volunteers and Tasks

---

## Step 5: Run a Query (Advanced)

You can also run SQL queries directly:

1. In pgAdmin, go to: **Tools** → **Query Tool**
2. Write a query like:

```sql
-- Get all events with their organizers
SELECT
  e.id,
  e.name AS event_name,
  o.username AS organizer_name,
  e.eventDate,
  e.place
FROM "Events" e
JOIN "Organizers" o ON e."organizerId" = o.id;
```

3. Click **Execute** (or press F5)

Result:

```
id | event_name              | organizer_name    | eventDate  | place
---|-------------------------|-------------------|-----------|-----------
1  | Community Cleanup Drive | organizer_john    | 2026-09-15 | Central Park, Downtown
```

---

## Step 6: Understanding Relationships

### Event → Organizer

- Each Event has ONE organizer
- Query: `SELECT * FROM "Events" WHERE "organizerId" = 1;`

### Event → Task

- Each Event has MANY tasks
- Query: `SELECT * FROM "Tasks" WHERE "eventId" = 1;`

### Task → Volunteer (via VolunteerTaskRegistration)

- Each Task can have MANY volunteers registered
- Query: `SELECT * FROM "VolunteerTaskRegistrations" WHERE "taskId" = 1;`

### Volunteer → Task (via VolunteerTaskRegistration)

- Each Volunteer can be registered for MANY tasks
- Query: `SELECT * FROM "VolunteerTaskRegistrations" WHERE "volunteerId" = 1;`

---

## Useful Queries

### Get all events and their task counts

```sql
SELECT
  e.id,
  e.name,
  o.username,
  COUNT(t.id) AS task_count
FROM "Events" e
JOIN "Organizers" o ON e."organizerId" = o.id
LEFT JOIN "Tasks" t ON e.id = t."eventId"
GROUP BY e.id, e.name, o.username;
```

### Get all volunteers registered for a specific event

```sql
SELECT DISTINCT
  v.id,
  v.username,
  v.email,
  t.title AS task_name
FROM "Volunteers" v
JOIN "VolunteerTaskRegistrations" vtr ON v.id = vtr."volunteerId"
JOIN "Tasks" t ON vtr."taskId" = t.id
JOIN "Events" e ON t."eventId" = e.id
WHERE e.id = 1;
```

### Get task occupancy (filled vs required volunteers)

```sql
SELECT
  t.id,
  t.title,
  t."requiredVolunteers",
  t."filledVolunteers",
  ROUND(100.0 * t."filledVolunteers" / t."requiredVolunteers", 2) AS occupancy_percent
FROM "Tasks" t
ORDER BY occupancy_percent DESC;
```

---

## Tips

- **Refresh**: Press F5 or click the refresh button to see latest data
- **Export**: Right-click a table → **Backup** to export as SQL
- **Filter**: In "View/Edit Data", use filters to find specific records
- **Sort**: Click column headers to sort by ascending/descending
- **Dark Mode**: File → Preferences → Theme (if supported)

---

## Troubleshooting

**Can't connect to pgAdmin?**

- Ensure pgAdmin service is running
- Default port is 5050
- Check Windows Services for pgAdmin

**Can't see ngo_platform database?**

- Make sure you created it in pgAdmin (see project setup)
- Refresh the database list (F5)

**Tables are empty?**

- Run the Thunder Client tests first (see TESTING_GUIDE.md)
- The API creates the data

---

## Next Steps

After verifying the data:

1. You can now add more features (notifications, dashboard filters, etc.)
2. Set up automated tests
3. Deploy to production (if ready)
