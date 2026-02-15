<div align="center">

# Team Dashboard

### Manage your team, invoices, and schedules in one place.

[About](#about) · [Features](#features) · [Tech Stack](#tech-stack) · [Getting Started](#getting-started)

---

</div>

## About

**Team Dashboard** is a Flask-based web application for managing teams, tracking invoices, organizing tasks, and coordinating schedules. It includes role-based access control, a calendar with availability tracking, PDF invoice generation, and a real-time notification system — all accessible through a clean, custom-built UI.

## Features

| Feature | Description |
|---|---|
| **Authentication** | Login system with bcrypt-hashed passwords and role-based access (admin, founder, manager, user) |
| **Team Management** | View and organize team members by role, add/edit users, assign custom roles with icons and colors |
| **Invoices** | Create, filter, and manage invoices with line items — export any invoice as a styled PDF |
| **Task Manager** | Todo list with deadlines, status tracking, and color coding |
| **Calendar** | FullCalendar-powered schedule with event creation and user availability tracking |
| **Notifications** | In-app notification system with redirect support |
| **Profile** | User profiles with avatar uploads and bio editing |
| **Admin Panel** | Centralized dashboard for user, role, and invoice management |

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Flask 3.x, Python 3.11 |
| Database | SQLite + SQLAlchemy 2.x |
| Auth | Flask-Login, Flask-Bcrypt |
| Frontend | Jinja2 templates, vanilla JS, custom CSS |
| PDF Export | ReportLab |
| Calendar | FullCalendar |

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd team-dashboard

# Create a virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the application
python main.py
```

The app will be available at `http://localhost:5050`.


## Project Structure

```
├── main.py              # Application entry point & routes
├── utils.py             # Utility functions
├── database/
│   ├── db.py            # SQLAlchemy setup
│   └── models/          # ORM models (User, Invoice, Todo, Event, etc.)
├── instance/
│   └── config.py        # App configuration (SECRET_KEY, upload settings)
└── app/
    ├── templates/       # Jinja2 HTML templates
    └── static/
        ├── css/         # Stylesheets
        ├── images/      # Icons & uploads
        ├── main.js      # Calendar & frontend logic
        └── ajax.js      # AJAX form handlers
```

---
