# Backend

This folder contains all backend-related code, such as APIs, server logic, and database scripts.

## Structure
- `api/`      → REST API endpoints
- `models/`   → Database models or schemas
- `routes/`   → Route definitions
- `config/`   → Configuration files (database, environment)
- `utils/`    → Helper functions

## Guidelines
- Follow consistent naming conventions for files and folders
- Write clear comments for all functions
- Keep business logic in service files, not directly in routes
- Include tests for all critical functions (see `tests/` folder)

## Running Backend
1. Install dependencies:
```bash
cd backend
npm install
```
2. Start server:
```bash
npm start
```
