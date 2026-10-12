# CHARUSAT ITUE301 — Practical 13: AI API Integration into a Web Application

**Course:** Advanced Web Development Frameworks (ITUE301)  
**Student Name:** Param Shah  
**Student ID:** 24CS093  
**Email:** 24cs093@charusat.edu.in  
**Department:** Computer Science & Engineering, CSPIT, CHARUSAT  
**Repository:** [https://github.com/shahparam15/24CS093_AWDF_Practical-13](https://github.com/shahparam15/24CS093_AWDF_Practical-13)

---

## 1. Overview & Objectives

Practical 13 extends the full-stack Task Management application by integrating an automated **Generative AI Assistant** that dynamically synthesizes professional, structured task descriptions based on the task title, priority, and category.

### Core Architecture & Compliance Rules
1. **Strict Server-Side Credential Protection:** All AI API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) reside exclusively within the Node.js backend environment. The client frontend never receives, stores, or handles secret credentials.
2. **High Resilience & Zero-Downtime Fallback:** The core Task Management application remains fully operational if the external AI service fails, times out, or if no API key is configured. In such cases, an intelligent heuristic generator crafts a structured task action plan locally.
3. **Draft-Scoped Rate Limiting:** A sliding-window rate limiter prevents abuse by restricting requests to 10 generations per minute per authenticated user, returning HTTP 429 with retry duration.
4. **Interactive Human-in-the-Loop Workflow:** The AI output directly populates the standard task description form textarea, allowing users to review, edit, or append details before persisting the task to MongoDB.

---

## 2. Technical Implementation

### A. Backend AI Service (`backend/src/services/aiService.js`)
- Supports **Google Gemini** (`gemini-1.5-flash`) and **OpenAI** (`gpt-4o-mini`).
- Implements `AbortController` timeouts (6000ms) to prevent slow external network calls from stalling the Express event loop.
- Features a domain-aware heuristic synthesis engine that analyzes task titles (identifying bug fixes, deployments, UI tasks, or API endpoints) to construct relevant objectives, action items, and acceptance criteria when external APIs are unreachable.

### B. Backend Controller & Route (`backend/src/controllers/aiController.js`)
- **Route:** `POST /api/ai/generate-description` (and `POST /ai/generate-description`).
- **Middleware:** Protected by `authMiddleware` (validates JWT Bearer token).
- **Validation:** Enforces mandatory non-empty task `title`.
- **Response Format:**
  ```json
  {
    "success": true,
    "description": "### Objective\nExecute and deliver deliverables...\n### Action Plan\n1. ...",
    "source": "gemini | openai | fallback",
    "disclaimer": "AI-generated draft. Review and adjust before saving."
  }
  ```

### C. Frontend Task Creation Form (`frontend/src/pages/TaskManager.jsx`)
- Integrated a `✨ Generate description` action button adjacent to the Description label.
- Displays an animated loading spinner during asynchronous AI generation.
- Validates that a task title is entered prior to triggering the API call.
- Renders an AI disclaimer notice below the textarea reminding users that the content was automatically synthesized and should be reviewed before saving.

---

## 3. Running and Testing Locally

### 1. Configure Environment Variables
In `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/task_manager_24cs093_auth
JWT_SECRET=super_secret_jwt_key_charusat_itue301_24cs093_change_in_production
CLIENT_ORIGIN=http://localhost:5173

# Optional: Set your real Gemini or OpenAI API key (leave empty to test resilient fallback)
GEMINI_API_KEY=
OPENAI_API_KEY=
```

### 2. Run Automated Integration Tests
```bash
npm test
```
The automated test suite verifies:
- `POST /ai/generate-description` returns `401 Unauthorized` without a JWT token.
- `POST /ai/generate-description` returns `400 Bad Request` if `title` is missing.
- `POST /ai/generate-description` returns `200 OK` with valid structured description, disclaimer, and source.

### 3. Build Frontend for Production
```bash
npm run build:frontend
```

---

## 4. File Structure

```text
24CS093_AWDF_Practical-13/
├── backend/
│   ├── src/
│   │   ├── config/cache.js          # In-memory TTL cache (Practical 9)
│   │   ├── events/                  # Event-driven processing (Practical 10)
│   │   ├── services/
│   │   │   └── aiService.js         # Practical 13 AI integration & fallback
│   │   ├── controllers/
│   │   │   ├── aiController.js      # AI rate limiter & request handler
│   │   │   ├── authController.js
│   │   │   └── taskController.js
│   │   ├── routes/
│   │   │   └── aiRoutes.js          # AI description route definition
│   │   └── server.js                # Express entry point
│   └── test/
│       └── api.test.js              # Integration tests including AI validation
├── frontend/
│   ├── src/
│   │   ├── api.js                   # API client including generateAiDescription
│   │   └── pages/
│   │       └── TaskManager.jsx      # AI button, loading state & disclaimer
├── docker-compose.yml               # Containerization manifest (Practical 11)
├── .github/workflows/ci.yml         # CI/CD pipeline (Practical 12)
├── package.json
└── README.md
```
