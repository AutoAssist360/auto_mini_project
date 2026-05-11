# AutoAssist 

### **Live Link:** https://auto-assist-360.vercel.app/

## MAIN Branch
- for production use only.
## Team Members
- Shivanand Gupta (as Svont) (Developer)
- Soham Dhakate (Developer)
- Shobhit Choradia (Developer)
- Tejas Devane (Developer)
-  Tirtha Pande (Developer)

## Branching & Workflow Rules
1. **Never push directly** to `main` or `dev`.
2.  `main` branch will be utillise for production ready code.
2. Create a `feature/*` branch for every new change.
3. Create a `bug/*` branch for every bug related changes.
4. Open a **Pull Request (PR)** to `dev`.
5. PR **must be reviewed** by at least two team member before merging.
6. Use meaningful commit messages, e.g., `feat: add login page`.

## Folder Structure
- `backend/`  → backend code, APIs, database scripts
- `frontend/` → frontend code, UI, static files
- `docs/`     → documentation, diagrams, guides
- `tests/`    → unit and integration tests
- `README.md` → project overview and rules
- `.gitignore` → ignored files

## Coding Guidelines
- Follow consistent code style (e.g., Prettier / ESLint)
- Write comments for complex logic
- Add tests for any new feature

## Getting Started
1. Clone the repo:
```bash
git clone https://github.com/AutoAssist360/mini_project.git

```
2. Create a feature branch:
```bash
git checkout -b feature/your-feature

```
3. Push your changes:
```bash

git add .
git commit -m "message"
git push origin feature/your-feature

```
4. Open a Pull Request to dev and request review.
