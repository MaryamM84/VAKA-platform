# VAKA — Backend Setup Guide

## 1. Overview

This document describes how to set up, configure, run, and test the VAKA backend locally.

**Technology Stack:**

- Python 3.13
- Django 6.1.2
- PostgreSQL 17.11
- psycopg 3
- python-dotenv

The instructions below are intended for Windows development environments.

## 2. Prerequisites

Make sure Python 3.13, PostgreSQL 17, and Git are installed.

PostgreSQL must be running before starting the backend.

## 3. Installation

Clone the repository and navigate to the `backend` directory.

Create and activate a virtual environment:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

For Command Prompt (CMD), activate using:

```cmd
.venv\Scripts\activate.bat
```

Install the required dependencies:

```powershell
python -m pip install -r requirements.txt
```

## 4. Database Configuration

The backend uses PostgreSQL as its relational database.

### 4.1. Create Database and User

Open PostgreSQL **SQL Shell (psql)** and connect as the `postgres` administrator.

Create the application database user:

```sql
CREATE USER vaka_user;
```

Set a password for the user:

```sql
\password vaka_user
```

Create the database:

```sql
CREATE DATABASE vaka_db
OWNER vaka_user
ENCODING 'UTF8';
```

Verify database creation:

```sql
\l
```

The database `vaka_db` should exist with `vaka_user` as its owner.

These steps are required only during the initial local database setup.

### 4.2. Environment Variables

Database credentials are managed through environment variables.

Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Configure the following variables in `backend/.env`:

```dotenv
DB_NAME=vaka_db
DB_USER=vaka_user
DB_PASSWORD=YOUR_DATABASE_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=5432
```

Replace the placeholder password with your local PostgreSQL user password.

Django's PostgreSQL connection is already configured in `settings.py`.


## 5. Run the Backend

Apply database migrations:

```powershell
python manage.py migrate
```

Start the development server:

```powershell
python manage.py runserver
```

The backend runs locally at:

http://127.0.0.1:8000/

## 6. Health Check

A basic health-check endpoint is available at:

```http
GET /api/health/
```

Expected response:

```json
{
  "status": "ok"
}
```

HTTP status: `200 OK`

This endpoint verifies application responsiveness, not database connectivity.

## 7. Testing

Check Django configuration:

```powershell
python manage.py check
```

Run health-check tests:

```powershell
python manage.py test tests.test_health
```

Run all backend tests:

```powershell
python manage.py test
```

All relevant tests should pass before submitting a Pull Request.

## 8. Development Notes

- Use Python 3.13 and install dependencies from `requirements.txt`.
- Keep environment-specific credentials in `.env`.
- Commit Django model migrations when models change.
- Follow the team's Git workflow and code review process.
- This guide covers local development only, not production deployment.
- Verify setup instructions before marking the setup task as complete.

For contribution rules, see [Development Strategy](../strategy.md).