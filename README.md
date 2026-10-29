# MindMapAI — PDF to Interactive AI Mind Map

> A full-stack web application that transforms uploaded PDF documents into interactive, AI-generated mind maps.

---

## Architecture Overview

- **Frontend**: Clean, minimalist UI built with HTML5, CSS3, Vanilla JS, Bootstrap 5, and D3.js v7 for tree visualization and interaction. Configured for zero-config deployment to **Vercel**.
- **Backend**: Spring Boot 3 (Java 17) REST API with Apache PDFBox for extraction and Groq Cloud SDK (Llama 3.3 70B / 8B) for structured mind map generation. Includes multi-stage **Dockerfile** for **Render** deployment.
- **Database**: **Supabase PostgreSQL** storing projects, document text, JSON mind map trees, and individual node hierarchies.

---

## Project Structure

```text
project/
├── backend/
│   ├── Dockerfile                   # Multi-stage Docker build for Render
│   ├── pom.xml                      # Maven dependencies
│   ├── schema.sql                   # Supabase PostgreSQL DDL
│   ├── system.properties            # Java 17 runtime specification
│   └── src/main/
│       ├── java/com/mindmap/
│       │   ├── config/              # CORS & Web config
│       │   ├── controller/          # REST Controllers (/api/projects, /api/mindmap, /api/health)
│       │   ├── model/               # JPA Entities (Project, Document, MindMap, MindMapNode)
│       │   ├── repository/          # Spring Data JPA Repositories
│       │   └── service/             # MindMapService, GroqService, PdfService
│       └── resources/
│           └── application.properties # Environment-driven configuration
└── frontend/
    ├── index.html                   # Dashboard & PDF upload
    ├── workspace.html               # Interactive D3.js mind map canvas & editor
    ├── vercel.json                  # Vercel routing configuration
    ├── css/
    │   └── style.css                # Premium minimal design system
    └── js/
        ├── config.js                # API base URL switch (Local vs Render)
        ├── api.js                   # REST client for backend endpoints
        ├── dashboard.js             # Drag-and-drop, PDF upload & project listing
        ├── mindmap.js               # D3.js collapsible tree visualization class
        └── workspace.js             # Workspace state, node editor & export controls
```

---

## 1. Supabase Database Setup

1. Open your project on [Supabase](https://supabase.com/).
2. Navigate to the **SQL Editor**.
3. Paste and run the contents of [`backend/schema.sql`](file:///c:/Users/Admin/OneDrive/Desktop/project/backend/schema.sql).
4. Get your connection details from **Project Settings > Database**:
   - Host: `db.<project-ref>.supabase.co`
   - Database name: `postgres`
   - Port: `5432`
   - User: `postgres`
   - Password: `<your-database-password>`

---

## 2. Running Locally

### Backend (Spring Boot)

1. Open a terminal in `backend/`:
   ```bash
   cd backend
   ```
2. Set your environment variables:
   - **PowerShell (Windows)**:
     ```powershell
     $env:DATABASE_URL="jdbc:postgresql://db.mckohstfgyeuqaspxwfg.supabase.co:5432/postgres"
     $env:DATABASE_USERNAME="postgres"
     $env:DATABASE_PASSWORD="your-supabase-db-password"
     $env:GROQ_API_KEY="<your-groq-api-key>"
     mvn spring-boot:run
     ```
   - **Bash (Linux / macOS)**:
     ```bash
     export DATABASE_URL="jdbc:postgresql://db.mckohstfgyeuqaspxwfg.supabase.co:5432/postgres"
     export DATABASE_USERNAME="postgres"
     export DATABASE_PASSWORD="your-supabase-db-password"
     export GROQ_API_KEY="<your-groq-api-key>"
     mvn spring-boot:run
     ```
3. The server starts on `http://localhost:8080`.
4. Verify backend health by visiting: `http://localhost:8080/api/health`.

### Frontend

1. Open `frontend/index.html` in your browser (or use VS Code Live Server, or Python `python -m http.server 5500` inside `frontend/`).
2. When running on `localhost` or `127.0.0.1`, `frontend/js/config.js` automatically routes API requests to `http://localhost:8080`.

---

## 3. Deploying the Backend to Render

1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/), click **New +** > **Web Service**.
3. Connect your repository and configure:
   - **Root Directory**: `backend`
   - **Runtime**: `Docker` (Render will detect [`backend/Dockerfile`](file:///c:/Users/Admin/OneDrive/Desktop/project/backend/Dockerfile))
   - **Instance Type**: Free or Starter
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `jdbc:postgresql://db.mckohstfgyeuqaspxwfg.supabase.co:5432/postgres` |
   | `DATABASE_USERNAME` | `postgres` |
   | `DATABASE_PASSWORD` | `<your-supabase-db-password>` |
   | `GROQ_API_KEY` | `<your-groq-api-key>` |
   | `ALLOWED_ORIGINS` | `https://your-app.vercel.app,http://localhost:5500` |
5. Click **Create Web Service**. Note the deployed Render URL (e.g., `https://mindmap-backend.onrender.com`).

---

## 4. Deploying the Frontend to Vercel

1. Update `frontend/js/config.js` with your deployed Render URL:
   ```javascript
   const CONFIG = {
       API_BASE_URL:
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1'
               ? 'http://localhost:8080'
               : 'https://your-backend.onrender.com'
   };
   ```
2. Deploy to Vercel:
   - Option A: In the [Vercel Dashboard](https://vercel.com/), import your Git repo, and set the **Root Directory** to `frontend`.
   - Option B: Using Vercel CLI from `frontend/`:
     ```bash
     cd frontend
     vercel
     ```
3. Add your Vercel URL to `ALLOWED_ORIGINS` on Render.

---

## Features

- **Document Ingestion**: Upload any PDF up to 20MB with drag-and-drop.
- **AI Mind Map Extraction**: Powered by Groq's high-throughput LLM to extract main themes, secondary concepts, and details with source page numbers.
- **Interactive D3.js Canvas**:
  - Pan & zoom with smooth controls and "Fit to Screen".
  - Expand and collapse branches.
  - Click any node to inspect details in the side panel.
  - Re-run AI on individual branches ("Regenerate Branch").
  - Add manual child nodes or delete nodes.
  - Save all edits back to Supabase.
  - High-resolution PNG export.
