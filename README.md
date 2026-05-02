# FDE Hackathon — Symptom Triage Assistant

Hackathon project (May 2026): symptom intake (chat or form), OpenRouter LLM triage using [`SystemPrompt.md`](./SystemPrompt.md), optional clinic search from a dedicated address field (not sent to the LLM). See [`plan.md`](./plan.md) for architecture and implementation status.

## Prerequisites

- Node.js 18+ (frontend)
- Python 3.11+ (backend)
- OpenRouter API key for production-style runs (without it the API returns a safe fallback message)

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
copy .env.example .env        # then set OPENROUTER_API_KEY
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check: `GET http://127.0.0.1:8000/api/health`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. Open the printed local URL (usually `http://localhost:5173`).

## Clinic search (optional)

Configure either **Google Custom Search** (`GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_CX`) or an HTTP MCP bridge (`CLINIC_SEARCH_MCP_HTTP_URL`) in `backend/.env`. The UI **street address** field triggers search only; it is not included in the OpenRouter prompt.

## Build frontend for production

```bash
cd frontend
npm run build
npm run preview
```
