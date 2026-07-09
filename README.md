# SciMind — AI-Powered Scientific Research Agent

> **Powered by IBM Watsonx.ai + IBM Granite**  
> A full-stack research assistant with Flask backend, responsive dark-mode UI, and 9 specialized research tools.

---

## Features

| Tool | Description |
|---|---|
| **Research Chat** | Multi-turn scientific Q&A with domain selection |
| **Paper Summarizer** | Brief / Detailed / Technical summaries of abstracts or full text |
| **Citation Generator** | APA, IEEE, Nature, Science, MLA citation formatting |
| **Literature Review Builder** | Structured 7-section literature reviews |
| **Hypothesis Generator** | Testable hypotheses with variables, methods, feasibility ratings |
| **Research Report Drafter** | Full paper outlines or individual sections |
| **Topic Explorer** | Deep-dives with key concepts, frontiers, open questions |
| **Concept Explainer** | Beginner / Intermediate / Expert explanations |
| **Theory Comparator** | Side-by-side analysis of competing theories or models |

---

## Quick Start

### 1. Prerequisites

- Python 3.10 or higher
- An [IBM Cloud](https://cloud.ibm.com/) account
- A [Watsonx.ai](https://www.ibm.com/watsonx) project with the **IBM Granite** model enabled

### 2. Clone / Copy the Project

```bash
# If using git
git clone <repo-url>
cd SciResearchAgent

# Or just navigate into the SciResearchAgent directory
```

### 3. Create a Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env   # macOS/Linux
copy .env.example .env # Windows

# Then open .env in any text editor and fill in your credentials:
```

Edit `.env`:

```dotenv
IBM_API_KEY=<your IBM Cloud API key>
WATSONX_PROJECT_ID=<your Watsonx.ai project ID>
WATSONX_URL=https://us-south.ml.cloud.ibm.com   # change region if needed
FLASK_SECRET_KEY=<any long random string>
GRANITE_MODEL_ID=ibm/granite-3-3-8b-instruct
```

#### How to get your credentials

| Credential | Where to find it |
|---|---|
| `IBM_API_KEY` | IBM Cloud → **Manage → Access (IAM)** → **API keys** → Create |
| `WATSONX_PROJECT_ID` | Watsonx.ai → Your project → **Manage** tab → copy **Project ID** |
| `WATSONX_URL` | Use `https://us-south.ml.cloud.ibm.com` for Dallas (default) |

Available Watsonx URLs by region:
- Dallas (US South): `https://us-south.ml.cloud.ibm.com`
- Frankfurt (EU): `https://eu-de.ml.cloud.ibm.com`
- London (UK): `https://eu-gb.ml.cloud.ibm.com`
- Tokyo (JP): `https://jp-tok.ml.cloud.ibm.com`
- Sydney (AU): `https://au-syd.ml.cloud.ibm.com`

### 6. Run the Application

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## Customizing Agent Behavior

All agent behavior is controlled by the `AGENT_INSTRUCTIONS` block near the top of [`app.py`](app.py).

```python
AGENT_INSTRUCTIONS = """
You are SciMind — ...
"""
```

You can modify:

| Section | What to change |
|---|---|
| **PERSONA & TONE** | Formality, verbosity, communication style |
| **SCIENTIFIC SPECIALIZATIONS** | Add/remove domains, change emphasis |
| **CORE CAPABILITIES** | Enable/disable specific research tasks |
| **RESPONSE FORMAT RULES** | Output structure, Markdown rules, length |
| **SAFETY & ETHICS RULES** | Citation behavior, uncertainty handling |
| **TOPIC PREFERENCES** | Emphasize specific research areas |

---

## API Reference

All endpoints accept and return JSON. Use `POST` for all research tools.

### `POST /api/chat`
```json
{
  "message": "Explain CRISPR-Cas9 mechanism",
  "history": [{"role":"user","content":"…"}, {"role":"assistant","content":"…"}],
  "domain": "Biology"
}
```

### `POST /api/summarize`
```json
{
  "text": "<abstract or full paper text>",
  "style": "brief | detailed | technical"
}
```

### `POST /api/citation`
```json
{
  "info": "Author: Smith J.\nTitle: …\nJournal: Nature\nYear: 2023",
  "style": "APA | IEEE | NATURE | SCIENCE | MLA"
}
```

### `POST /api/literature-review`
```json
{
  "topic": "Quantum computing in drug discovery",
  "papers": "Optional list of paper titles/summaries",
  "scope": "comprehensive | brief | focused"
}
```

### `POST /api/hypothesis`
```json
{
  "topic": "Gut microbiome and depression",
  "context": "Optional additional context",
  "count": 3
}
```

### `POST /api/draft-report`
```json
{
  "topic": "The role of dark matter in galaxy formation",
  "section": "full | abstract | introduction | methodology | results | conclusion",
  "context": "Optional notes"
}
```

### `POST /api/explore-topic`
```json
{
  "topic": "Quantum entanglement",
  "domain": "Physics"
}
```

### `POST /api/explain`
```json
{
  "concept": "Wave-particle duality",
  "level": "beginner | intermediate | expert"
}
```

### `POST /api/compare-theories`
```json
{
  "theory1": "General Relativity",
  "theory2": "Quantum Field Theory",
  "domain": "Physics"
}
```

### `GET /api/health`
Returns agent status and model info.

---

## Production Deployment

### Option A — Gunicorn (Linux/macOS)

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option B — Gunicorn with a systemd Service

Create `/etc/systemd/system/scimind.service`:
```ini
[Unit]
Description=SciMind Scientific Research Agent
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/scimind
EnvironmentFile=/opt/scimind/.env
ExecStart=/opt/scimind/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable scimind
sudo systemctl start scimind
```

### Option C — Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t scimind .
docker run -p 5000:5000 --env-file .env scimind
```

### Option D — IBM Code Engine (Cloud)

```bash
# Install IBM Cloud CLI + Code Engine plugin
ibmcloud login
ibmcloud ce project create --name scimind-project
ibmcloud ce project select --name scimind-project

# Create secrets from .env
ibmcloud ce secret create --name scimind-secrets \
  --from-env-file .env

# Deploy
ibmcloud ce application create \
  --name scimind \
  --image <your-registry>/scimind:latest \
  --env-from-secret scimind-secrets \
  --port 5000
```

---

## Project Structure

```
SciResearchAgent/
├── app.py                  # Flask backend + AGENT_INSTRUCTIONS + all API routes
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your credentials (DO NOT commit)
├── README.md               # This file
├── templates/
│   └── index.html          # Full responsive UI (Bootstrap 5 + dark mode)
└── static/
    ├── css/
    │   └── style.css       # Custom styles, dark/light theme, animations
    └── js/
        └── main.js         # All frontend logic, API calls, Markdown rendering
```

---

## Security Notes

- `.env` is gitignored by default — **never commit API keys**
- Set `FLASK_DEBUG=False` in production
- Change `FLASK_SECRET_KEY` to a long random string in production
- Use HTTPS with a reverse proxy (nginx/Caddy) in production
- Rate-limit the API endpoints with Flask-Limiter for public deployments

---

## Requirements

```
flask>=3.0.0
flask-cors>=4.0.0
python-dotenv>=1.0.0
ibm-watsonx-ai>=1.1.2
requests>=2.31.0
gunicorn>=21.2.0
```

---

## License

MIT License — free to use, modify, and deploy.
