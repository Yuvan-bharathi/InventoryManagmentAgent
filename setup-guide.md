**AI AGENT APPLICATION**

Complete Development Setup Guide

React · FastAPI · LangChain · Domo AI Services · PostgreSQL

| **Item** | **Detail** |
| --- | --- |
| Frontend | React (Vite), Montserrat, light/dark theme |
| Backend | Python 3.11+, FastAPI |
| Agent framework | LangChain (langchain-core) |
| AI model | Domo AI Services, Text Generation API |
| Database | PostgreSQL (RDBMS) via SQLAlchemy |
| Domo instance | gwcteq-partner.domo.com |
| Document date | 10 November 2026 |

# Contents

1. Overview and architecture

2. Prerequisites

3. Project structure

4. Database setup

5. Domo AI configuration

6. Backend implementation

7. Run and test the backend

8. Frontend implementation

9. Application theme

10. Extending the agent with tools

11. Hardening checklist

12. Deployment

13. Troubleshooting

Appendix A. Domo Text Generation API reference

Appendix B. Domo Text-to-BeastMode API reference

Appendix C. Domo dataset schema API (v3): sample call format

# 1. Overview and architecture

This guide walks through building a chat-style data agent end to end. The user asks a question in a React interface. The FastAPI backend runs a LangChain agent loop that calls the Domo AI Text Generation model, uses tools (such as a read-only SQL tool against PostgreSQL), and returns the answer along with the tool trace.

### Request flow

- The React app sends POST /api/chat with the conversation ID and message.

- FastAPI loads the conversation history from PostgreSQL.

- The LangChain agent builds a prompt and calls Domo POST /api/ai/v1/text/generation.

- The model replies with a JSON action: call a tool, or give the final answer.

- The backend runs the tool, appends the result to the scratchpad, and loops (maximum 5 tool calls).

- The final answer and tool steps are saved to PostgreSQL and returned to the UI.

### Components

| **Layer** | **Technology** | **Responsibility** |
| --- | --- | --- |
| UI | React + Vite | Chat interface, conversation list, theme toggle, tool-trace viewer |
| API | FastAPI | REST endpoints, validation, persistence, error handling |
| Agent | LangChain | Prompt templates, custom Domo LLM wrapper, tool definitions, action loop |
| LLM | Domo AI Services | Text generation through the Domo developer-token API |
| Data | PostgreSQL | Conversations, messages, tool traces, and business tables to query |

**Design note. **The Domo Text Generation endpoint takes a prompt and returns text. It does not expose native tool calling in that API, so tool use is implemented with a JSON-action loop (ReAct style) inside LangChain.

# 2. Prerequisites

| **Requirement** | **Version / detail** | **Where to get it** |
| --- | --- | --- |
| Python | 3.11 or newer | python.org |
| Node.js | 20 or newer (includes npm) | nodejs.org |
| PostgreSQL | 14 or newer | postgresql.org |
| Domo developer token | Sent as header X-DOMO-Developer-Token | Domo, Admin, Authentication, Access tokens |
| Domo model ID | e.g. domo.domo_ai.domogpt-small-v2.1:anthropic | Domo AI Playground (gwcteq-partner.domo.com/ai-services/playground) |

**Important. **The model you choose must be enabled for the Text Generation service by a Domo admin. If model is omitted from the request, Domo uses its default model.

# 3. Project structure

Create the folder structure below. Create an empty app/__init__.py so Python treats app as a package.

agent-app/

├── backend/

│   ├── app/

│   │   ├── __init__.py        (empty file)

│   │   ├── config.py

│   │   ├── db.py

│   │   ├── domo_llm.py

│   │   ├── tools.py

│   │   ├── agent.py

│   │   └── main.py

│   ├── requirements.txt

│   └── .env

└── ui/                        (Vite + React app)

    ├── index.html

    ├── vite.config.js

    └── src/

        ├── App.jsx

        ├── theme.css

        └── app.css

# 4. Database setup

## 4.1 Create the database and roles

Two roles are used. agent_rw is the application role used for chat history. agent_ro is a read-only role used only by the SQL tool, which is the real safeguard against the model writing or deleting data.

**db.sql**

-- Run as the postgres superuser

CREATE DATABASE agentdb;

CREATE USER agent_rw WITH PASSWORD 'change_me';      -- app read/write

CREATE USER agent_ro WITH PASSWORD 'change_me_ro';   -- used by the SQL tool only

 

\c agentdb

GRANT ALL ON SCHEMA public TO agent_rw;

GRANT USAGE ON SCHEMA public TO agent_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE agent_rw IN SCHEMA public GRANT SELECT ON TABLES TO agent_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agent_ro;

## 4.2 Optional sample data

Load this sample data to test the agent immediately. Replace it with your own business tables later.

**seed.sql**

-- Optional sample business data so the agent has something to query.

-- Run as agent_rw:  psql -U agent_rw -d agentdb -f seed.sql

CREATE TABLE customers (

  id SERIAL PRIMARY KEY,

  name TEXT NOT NULL,

  region TEXT NOT NULL

);

CREATE TABLE orders (

  id SERIAL PRIMARY KEY,

  customer_id INT REFERENCES customers(id),

  amount NUMERIC(10,2) NOT NULL,

  status TEXT NOT NULL,

  created_at DATE NOT NULL

);

INSERT INTO customers (name, region) VALUES

  ('Acme Corp','South'), ('Globex','North'), ('Initech','West');

INSERT INTO orders (customer_id, amount, status, created_at) VALUES

  (1, 1200.50, 'paid',    '2026-09-01'),

  (1,  300.00, 'pending', '2026-10-05'),

  (2,  980.00, 'paid',    '2026-10-11'),

  (3, 2100.75, 'paid',    '2026-10-20');

GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_ro;

The tables conversations and messages are created automatically by the backend on first start.

# 5. Domo AI configuration

- Open the Domo AI Playground and confirm that text generation works with your chosen model.

- Copy the model ID shown in the Playground.

- Create a developer access token in Domo (Admin, Authentication, Access tokens).

- Verify the API directly before writing any code:

curl -X POST "https://gwcteq-partner.domo.com/api/ai/v1/text/generation" \

  -H "X-DOMO-Developer-Token: $DOMO_TOKEN" \

  -H "Content-Type: application/json" \

  -d '{"input":"Why is the sky blue?"}'

A successful response is JSON containing output, modelId, and modelProviderUsage. A 403 means the token or model permission is wrong.

# 6. Backend implementation

## 6.1 Dependencies and environment

**backend/requirements.txt**

fastapi

uvicorn[standard]

langchain-core

httpx

sqlalchemy>=2

psycopg[binary]

pydantic-settings

**backend/.env**

DOMO_SUBDOMAIN=gwcteq-partner

DOMO_TOKEN=your_developer_token

DOMO_MODEL=domo.domo_ai.domogpt-small-v2.1:anthropic

DATABASE_URL=postgresql+psycopg://agent_rw:change_me@localhost:5432/agentdb

READONLY_DATABASE_URL=postgresql+psycopg://agent_ro:change_me_ro@localhost:5432/agentdb

**Security. **Never commit .env and never place the Domo token in frontend code. Add .env to .gitignore.

## 6.2 Settings

**backend/app/config.py**

from pydantic_settings import BaseSettings

 

class Settings(BaseSettings):

    domo_subdomain: str

    domo_token: str

    domo_model: str | None = None

    database_url: str

    readonly_database_url: str

 

    class Config:

        env_file = ".env"

 

settings = Settings()

## 6.3 Database models

**backend/app/db.py**

import uuid, datetime as dt

from sqlalchemy import create_engine, String, Text, ForeignKey, JSON, DateTime

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from .config import settings

 

engine = create_engine(settings.database_url, pool_pre_ping=True)

ro_engine = create_engine(settings.readonly_database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(engine, expire_on_commit=False)

 

class Base(DeclarativeBase):

    pass

 

class Conversation(Base):

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    title: Mapped[str] = mapped_column(String(200), default="New chat")

    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", order_by="Message.id")

 

class Message(Base):

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))

    role: Mapped[str] = mapped_column(String(20))          # user | assistant

    content: Mapped[str] = mapped_column(Text)

    steps: Mapped[list | None] = mapped_column(JSON, nullable=True)   # tool trace

    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")

 

def init_db():

    Base.metadata.create_all(engine)

## 6.4 Domo LLM wrapper for LangChain

This class turns the Domo Text Generation endpoint into a standard LangChain LLM, so it can be used in prompt chains (PROMPT | llm | parser).

**backend/app/domo_llm.py**

from typing import Any, List, Optional

import httpx

from langchain_core.language_models.llms import LLM

from .config import settings

 

class DomoTextLLM(LLM):

    temperature: float = 0.1

    max_tokens: int = 1500

    system: Optional[str] = None

 

    @property

    def _llm_type(self) -> str:

        return "domo-text-generation"

 

    def _call(self, prompt: str, stop: Optional[List[str]] = None,

              run_manager=None, **kwargs: Any) -> str:

        url = f"https://{settings.domo_subdomain}.domo.com/api/ai/v1/text/generation"

        payload: dict = {

            "input": prompt,

            "temperature": self.temperature,

            "maxTokens": self.max_tokens,

        }

        if settings.domo_model:

            payload["model"] = settings.domo_model

        if self.system:

            payload["system"] = self.system

        r = httpx.post(

            url, json=payload, timeout=120,

            headers={"X-DOMO-Developer-Token": settings.domo_token,

                     "Content-Type": "application/json"},

        )

        r.raise_for_status()

        out = r.json()["output"]

        for s in stop or []:

            out = out.split(s)[0]

        return out

## 6.5 Tools

get_schema lets the model discover tables. run_sql executes one read-only SELECT with a row limit and an 8-second timeout, using the read-only database role.

**backend/app/tools.py**

import re

from langchain_core.tools import tool

from sqlalchemy import text, inspect

from .db import ro_engine

 

FORBIDDEN = re.compile(

    r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do)\b", re.I)

 

@tool

def get_schema() -> str:

    """List all tables and their columns in the database."""

    insp = inspect(ro_engine)

    skip = {"conversations", "messages"}

    return "\n".join(

        f"{t}({', '.join(c['name'] + ':' + str(c['type']) for c in insp.get_columns(t))})"

        for t in insp.get_table_names() if t not in skip

    )

 

@tool

def run_sql(query: str) -> str:

    """Run ONE read-only PostgreSQL SELECT query and return up to 50 rows."""

    q = query.strip().rstrip(";")

    if ";" in q or not re.match(r"^(select|with)\b", q, re.I) or FORBIDDEN.search(q):

        return "ERROR: only a single read-only SELECT is allowed."

    try:

        with ro_engine.connect() as conn:

            conn.execute(text("SET TRANSACTION READ ONLY"))

            conn.execute(text("SET LOCAL statement_timeout = 8000"))

            res = conn.execute(text(f"SELECT * FROM ({q}) AS t LIMIT 50"))

            cols = list(res.keys())

            rows = [dict(zip(cols, r)) for r in res.fetchall()]

            return str(rows) if rows else "No rows."

    except Exception as e:

        return f"ERROR: {e}"

 

TOOLS = [get_schema, run_sql]

## 6.6 Agent loop

The prompt instructs the model to reply with a single JSON object. The loop parses it, runs the requested tool, appends the result to the scratchpad, and repeats until the model returns final or the step limit is reached.

**backend/app/agent.py**

import json, re

from langchain_core.prompts import PromptTemplate

from langchain_core.output_parsers import StrOutputParser

from .domo_llm import DomoTextLLM

from .tools import TOOLS

 

TOOL_MAP = {t.name: t for t in TOOLS}

TOOL_DOC = "\n".join(

    f"- {t.name}: {t.description} | args: {json.dumps(t.args)}" for t in TOOLS)

 

PROMPT = PromptTemplate.from_template("""You are a data assistant. Use tools when needed.

 

TOOLS:

{tools}

 

Reply with ONE JSON object only, no prose, no markdown fences:

  To call a tool: {{"action": "<tool name>", "input": {{...args}}}}

  To finish:      {{"action": "final", "answer": "<answer for the user>"}}

 

Rules: call get_schema before writing SQL. Never invent data. Max {max_steps} tool calls.

 

CONVERSATION SO FAR:

{history}

 

USER QUESTION: {question}

 

SCRATCHPAD (previous tool calls and results):

{scratchpad}

 

Your JSON reply:""")

 

chain = PROMPT | DomoTextLLM() | StrOutputParser()

 

def _extract_json(s: str) -> dict:

    m = re.search(r"\{.*\}", s, re.S)

    if not m:

        return {"action": "final", "answer": s.strip()}

    try:

        return json.loads(m.group(0))

    except json.JSONDecodeError:

        return {"action": "final", "answer": s.strip()}

 

def run_agent(question: str, history: list[dict], max_steps: int = 5):

    hist = "\n".join(f"{m['role']}: {m['content']}" for m in history[-10:]) or "(none)"

    scratch, steps = "", []

    for _ in range(max_steps + 1):

        raw = chain.invoke({"tools": TOOL_DOC, "history": hist, "question": question,

                            "scratchpad": scratch or "(empty)", "max_steps": max_steps})

        act = _extract_json(raw)

        if act.get("action") == "final":

            return act.get("answer", ""), steps

        tool = TOOL_MAP.get(act.get("action"))

        if not tool:

            scratch += f"\nERROR: unknown tool {act.get('action')}"

            continue

        try:

            obs = tool.invoke(act.get("input", {}))

        except Exception as e:

            obs = f"ERROR: {e}"

        steps.append({"tool": tool.name, "input": act.get("input", {}),

                      "output": str(obs)[:2000]})

        scratch += (f"\nCALL {tool.name}({json.dumps(act.get('input', {}))})"

                    f"\nRESULT: {str(obs)[:2000]}")

    return "I couldn't finish within the step limit. Try narrowing the question.", steps

## 6.7 API

**backend/app/main.py**

from fastapi import FastAPI, HTTPException

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from .db import SessionLocal, Conversation, Message, init_db

from .agent import run_agent

 

app = FastAPI(title="Agent API")

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],

                   allow_methods=["*"], allow_headers=["*"])

 

@app.on_event("startup")

def _startup():

    init_db()

 

class ChatIn(BaseModel):

    conversation_id: str | None = None

    message: str

 

@app.get("/api/conversations")

def list_convs():

    with SessionLocal() as s:

        rows = s.query(Conversation).order_by(Conversation.created_at.desc()).all()

        return [{"id": c.id, "title": c.title} for c in rows]

 

@app.get("/api/conversations/{cid}/messages")

def get_msgs(cid: str):

    with SessionLocal() as s:

        q = s.query(Message).filter_by(conversation_id=cid).order_by(Message.id)

        return [{"role": m.role, "content": m.content, "steps": m.steps} for m in q]

 

@app.post("/api/chat")

def chat(body: ChatIn):

    with SessionLocal() as s:

        conv = s.get(Conversation, body.conversation_id) if body.conversation_id else None

        if not conv:

            conv = Conversation(title=body.message[:60])

            s.add(conv)

            s.flush()

        history = [{"role": m.role, "content": m.content} for m in conv.messages]

        s.add(Message(conversation_id=conv.id, role="user", content=body.message))

        try:

            answer, steps = run_agent(body.message, history)

        except Exception as e:

            raise HTTPException(502, f"Agent error: {e}")

        s.add(Message(conversation_id=conv.id, role="assistant", content=answer, steps=steps))

        s.commit()

        return {"conversation_id": conv.id, "answer": answer, "steps": steps}

| **Endpoint** | **Method** | **Purpose** |
| --- | --- | --- |
| /api/conversations | GET | List conversations, newest first |
| /api/conversations/{cid}/messages | GET | Messages and tool steps for one conversation |
| /api/chat | POST | Send a message, run the agent, return answer and steps |

# 7. Run and test the backend

**Terminal 1 (from agent-app/)**

cd backend

python -m venv .venv

source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt

touch app/__init__.py

uvicorn app.main:app --reload --port 8000

Open http://localhost:8000/docs for the interactive API page. Then test the agent:

curl -X POST localhost:8000/api/chat \

  -H "Content-Type: application/json" \

  -d '{"message":"What tables do we have, and what is total paid revenue?"}'

Expected behavior: the response contains an answer and a steps array showing get_schema followed by run_sql.

# 8. Frontend implementation

## 8.1 Create the Vite app

# Terminal 2 (from agent-app/)

npm create vite@latest ui -- --template react

cd ui

npm install

## 8.2 Vite proxy

The proxy forwards /api calls to FastAPI during development, so no CORS or URL configuration is needed in React code.

**ui/vite.config.js**

import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

 

export default defineConfig({

  plugins: [react()],

  server: { proxy: { "/api": "http://localhost:8000" } },

});

## 8.3 Load the Montserrat font

Add these lines inside the <head> of ui/index.html:

**ui/index.html (head)**

<link rel="preconnect" href="https://fonts.googleapis.com" />

<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />

## 8.4 Entry point

Replace the contents of ui/src/main.jsx. You can delete the default App.css and index.css files.

**ui/src/main.jsx**

import React from "react";

import ReactDOM from "react-dom/client";

import App from "./App.jsx";

 

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

## 8.5 Main component

**ui/src/App.jsx**

import { useEffect, useRef, useState } from "react";

import "./theme.css";

import "./app.css";

 

const api = {

  convs: () => fetch("/api/conversations").then(r => r.json()),

  msgs: id => fetch(`/api/conversations/${id}/messages`).then(r => r.json()),

  chat: (conversation_id, message) =>

    fetch("/api/chat", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ conversation_id, message }),

    }).then(r => {

      if (!r.ok) throw new Error("Request failed");

      return r.json();

    }),

};

 

export default function App() {

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const [convs, setConvs] = useState([]);

  const [cid, setCid] = useState(null);

  const [msgs, setMsgs] = useState([]);

  const [text, setText] = useState("");

  const [busy, setBusy] = useState(false);

  const endRef = useRef();

 

  useEffect(() => {

    document.documentElement.dataset.theme = theme;

    localStorage.setItem("theme", theme);

  }, [theme]);

 

  const loadConvs = () => api.convs().then(setConvs);

  useEffect(() => { loadConvs(); }, []);

  useEffect(() => { cid ? api.msgs(cid).then(setMsgs) : setMsgs([]); }, [cid]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

 

  async function send() {

    const message = text.trim();

    if (!message || busy) return;

    setText("");

    setBusy(true);

    setMsgs(m => [...m, { role: "user", content: message }]);

    try {

      const res = await api.chat(cid, message);

      setMsgs(m => [...m, { role: "assistant", content: res.answer, steps: res.steps }]);

      if (!cid) { setCid(res.conversation_id); loadConvs(); }

    } catch (e) {

      setMsgs(m => [...m, { role: "assistant", content: "Something went wrong. Please try again." }]);

    } finally {

      setBusy(false);

    }

  }

 

  return (

    <div className="app">

      <aside className="side">

        <h1>Agent</h1>

        <button className="primary" style={{ width: "100%", marginBottom: 12 }}

                onClick={() => setCid(null)}>+ New chat</button>

        {convs.map(c => (

          <div key={c.id} className={"conv" + (c.id === cid ? " active" : "")}

               onClick={() => setCid(c.id)}>{c.title}</div>

        ))}

      </aside>

      <section className="main">

        <div className="top">

          <strong>Data Assistant</strong>

          <button className="ghost"

                  onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}>

            {theme === "light" ? "Dark" : "Light"} mode

          </button>

        </div>

        <div className="msgs">

          {msgs.map((m, i) => (

            <div key={i} className={"bubble " + (m.role === "user" ? "user" : "bot")}>

              {m.content}

              {m.steps?.length > 0 && (

                <details className="steps">

                  <summary>{m.steps.length} tool call(s)</summary>

                  {m.steps.map((s, j) => (

                    <pre key={j}>{s.tool}({JSON.stringify(s.input)}){"\n"}→ {s.output}</pre>

                  ))}

                </details>

              )}

            </div>

          ))}

          {busy && <div className="typing">Thinking…</div>}

          <div ref={endRef} />

        </div>

        <div className="composer">

          <input value={text} placeholder="Ask about your data…"

                 onChange={e => setText(e.target.value)}

                 onKeyDown={e => e.key === "Enter" && send()} />

          <button className="primary" disabled={busy || !text.trim()} onClick={send}>Send</button>

        </div>

      </section>

    </div>

  );

}

## 8.6 Run the frontend

npm run dev

# open http://localhost:5173

# 9. Application theme

Light is the default theme. Dark mode applies through :root[data-theme="dark"], which the React app sets on the <html> element when the user toggles the theme. The choice is remembered in the browser. The font is Montserrat throughout.

**Core identity. **Purple #6F3DBA + Blue #4D8EEB + Orange #F58A3A on Navy #1F2F59, over near-white surfaces in light mode and navy-black surfaces in dark mode.

## 9.1 Brand palette

| **Token** | **Light** |  | **Dark** |  |
| --- | --- | --- | --- | --- |
| --brand-purple (primary accent) | #6f3dba |  | #a684ee |  |
| --brand-blue | #4d8eeb |  | #78acf5 |  |
| --brand-orange | #f58a3a |  | #ffab63 |  |
| --brand-navy (anchor / ink) | #1f2f59 |  | #e7edfa |  |
| --brand-white | #ffffff |  | #e9eefa |  |
| --brand-bg | #fcfcfe |  | #0b1220 |  |
| --brand-blue-soft | #eaf4ff |  | #142339 |  |
| --brand-purple-soft | #f3eeff |  | #1e1836 |  |
| --brand-peach-soft | #fff2eb |  | #2b1d17 |  |
| --sky | #7fb0f2 |  | #9cc4f8 |  |
| --cyan | #31b7c3 |  | #4fd3de |  |

## 9.2 Text

| **Token** | **Light** |  | **Dark** |  |
| --- | --- | --- | --- | --- |
| --text-primary | #1f2f59 |  | #f1f5fd |  |
| --text-secondary | #54627e |  | #b3c0d8 |  |
| --text-muted | #98a2b3 |  | #7d8ba6 |  |
| --on-accent (on filled buttons) | #ffffff |  | #0a1020 |  |
| --muted-ink (dimmed state) | #64748b |  | #8494ae |  |

## 9.3 Surfaces

| **Token** | **Light** |  | **Dark** |  |
| --- | --- | --- | --- | --- |
| --page-bg | #f5f7fa |  | #090e1a |  |
| --surface-hi | #ffffff |  | #26334d |  |
| --white (solid fill) | #ffffff |  | #1b2540 |  |
| --kg-bg-2 | #f8fafd |  | #111a2b |  |
| --kg-bg-3 / --light | #f3f6fb |  | #162034 |  |
| --muted-fill | #eef1f6 |  | #151e30 |  |

--surface-rgb is 255,255,255 (light) and 25,34,53 (dark). --shadow-rgb is 31,47,89 and 0,0,0. --line-rgb is 31,47,89 and 214,224,244. --paper-rgb is 252,252,254 and 9,14,26. The RGB tokens are used as rgba(var(--line-rgb), .12).

## 9.4 Graph depth ramp (node color = tree depth)

| **Token** | **Light** |  | **Dark** |  |
| --- | --- | --- | --- | --- |
| Depth 0 (root) | #e45c72 |  | #ff7d90 |  |
| Depth 1 | #6f3dba |  | #a684ee |  |
| Depth 2 | #4d8eeb |  | #78acf5 |  |
| Depth 3 | #f58a3a |  | #ffab63 |  |
| Depth 4 | #31b7c3 |  | #4fd3de |  |
| Depth 5 | #b88943 |  | #ddab5f |  |
| Depth 6 | #8a63d2 |  | #b192ec |  |
| Depth 7 | #3e7bc4 |  | #6ba2e0 |  |

## 9.5 Charts

| **Token** | **Light** |  | **Dark** |  |
| --- | --- | --- | --- | --- |
| Categorical 1 | #4D8EEB |  | #6BA5F5 |  |
| Categorical 2 | #D9701F |  | #F0913E |  |
| Categorical 3 | #6F3DBA |  | #A684EE |  |
| Categorical 4 | #0E9C86 |  | #2BC0A6 |  |
| Ordinal 1 | #8FB8F2 |  | #2E5C98 |  |
| Ordinal 2 | #5F97E4 |  | #4A7EC2 |  |
| Ordinal 3 | #3670BB |  | #71A3E4 |  |
| Ordinal 4 | #17477F |  | #A6CAFA |  |
| Chart surface | #ffffff |  | #192235 |  |

Axis color is #7C839B (light) and #8D97AE (dark). Label color is #2C2C2C (light) and #DFE6F4 (dark).

## 9.6 Drawer / workspace panel (--dr-*)

| **Token** | **Light** |  | **Dark** |  |
| --- | --- | --- | --- | --- |
| --dr-bg | #f7f7fc |  | #10121b |  |
| --dr-surface | #ffffff |  | #171a27 |  |
| --dr-ink | #172554 |  | #f1f5ff |  |
| --dr-ink-2 | #64748b |  | #98a2b8 |  |
| --dr-ink-3 | #8b95ad |  | #78829a |  |
| --dr-purple | #6d3ccb |  | #9b7cf6 |  |
| --dr-purple-soft | #a78bfa |  | #b9a4fb |  |
| --dr-blue | #4f8ef7 |  | #4f8ef7 |  |
| --dr-border | #e2e4f0 |  | #292d40 |  |
| --dr-active | #f1edff |  | #211b38 |  |
| --dr-hover | #f5f2ff |  | #1b1f30 |  |

--dr-card is rgba(255,255,255,.72) in light and rgba(23,26,39,.82) in dark.

## 9.7 Backdrop washes

| **Token** | **Light** |  | **Dark** |  |
| --- | --- | --- | --- | --- |
| --bx-wash-1 | #e2eeff |  | #13233d |  |
| --bx-wash-2 | #ece3ff |  | #1b1938 |  |
| --bx-wash-3 | #ffe9d9 |  | #2c2019 |  |
| --bx-wash-4 | #ffe1ec |  | #2a1a28 |  |
| --bx-wash-5 | #e4d7ff |  | #1d1a3c |  |
| --bx-wash-6 | #d8e8ff |  | #101f36 |  |
| --signal-flash | #ffffff |  | #dce8ff |  |

--ghost-ink (watermark) is rgba(103,104,106,.14) in light and rgba(190,205,235,.10) in dark. --node-glass is rgba(255,255,255,.94) and rgba(30,41,64,.94).

## 9.8 theme.css (full token file)

**ui/src/theme.css**

:root {

  --brand-purple:#6f3dba; --brand-blue:#4d8eeb; --brand-orange:#f58a3a; --brand-navy:#1f2f59;

  --brand-white:#ffffff; --brand-bg:#fcfcfe; --brand-blue-soft:#eaf4ff; --brand-purple-soft:#f3eeff;

  --brand-peach-soft:#fff2eb; --sky:#7fb0f2; --cyan:#31b7c3;

 

  --text-primary:#1f2f59; --text-secondary:#54627e; --text-muted:#98a2b3;

  --on-accent:#ffffff; --muted-ink:#64748b;

 

  --page-bg:#f5f7fa; --surface-rgb:255,255,255; --surface-hi:#ffffff; --white:#ffffff;

  --kg-bg-2:#f8fafd; --kg-bg-3:#f3f6fb; --light:#f4f7fc; --muted-fill:#eef1f6;

  --node-glass:rgba(255,255,255,.94); --shadow-rgb:31,47,89; --line-rgb:31,47,89; --paper-rgb:252,252,254;

 

  --depth-0:#e45c72; --depth-1:#6f3dba; --depth-2:#4d8eeb; --depth-3:#f58a3a;

  --depth-4:#31b7c3; --depth-5:#b88943; --depth-6:#8a63d2; --depth-7:#3e7bc4;

 

  --bx-wash-1:#e2eeff; --bx-wash-2:#ece3ff; --bx-wash-3:#ffe9d9;

  --bx-wash-4:#ffe1ec; --bx-wash-5:#e4d7ff; --bx-wash-6:#d8e8ff;

  --ghost-ink:rgba(103,104,106,.14); --signal-flash:#ffffff;

 

  --chart-c1:#4D8EEB; --chart-c2:#D9701F; --chart-c3:#6F3DBA; --chart-c4:#0E9C86;

  --chart-o1:#8FB8F2; --chart-o2:#5F97E4; --chart-o3:#3670BB; --chart-o4:#17477F;

  --chart-axis:#7c839b; --chart-label:#2c2c2c; --chart-surface:#ffffff;

 

  --dr-bg:#f7f7fc; --dr-surface:#ffffff; --dr-card:rgba(255,255,255,.72); --dr-ink:#172554;

  --dr-ink-2:#64748b; --dr-ink-3:#8b95ad; --dr-purple:#6d3ccb; --dr-purple-soft:#a78bfa;

  --dr-blue:#4f8ef7; --dr-border:#e2e4f0; --dr-active:#f1edff; --dr-hover:#f5f2ff;

}

 

:root[data-theme="dark"] {

  --brand-purple:#a684ee; --brand-blue:#78acf5; --brand-orange:#ffab63; --brand-navy:#e7edfa;

  --brand-white:#e9eefa; --brand-bg:#0b1220; --brand-blue-soft:#142339; --brand-purple-soft:#1e1836;

  --brand-peach-soft:#2b1d17; --sky:#9cc4f8; --cyan:#4fd3de;

 

  --text-primary:#f1f5fd; --text-secondary:#b3c0d8; --text-muted:#7d8ba6;

  --on-accent:#0a1020; --muted-ink:#8494ae;

 

  --page-bg:#090e1a; --surface-rgb:25,34,53; --surface-hi:#26334d; --white:#1b2540;

  --kg-bg-2:#111a2b; --kg-bg-3:#162034; --light:#162034; --muted-fill:#151e30;

  --node-glass:rgba(30,41,64,.94); --shadow-rgb:0,0,0; --line-rgb:214,224,244; --paper-rgb:9,14,26;

 

  --depth-0:#ff7d90; --depth-1:#a684ee; --depth-2:#78acf5; --depth-3:#ffab63;

  --depth-4:#4fd3de; --depth-5:#ddab5f; --depth-6:#b192ec; --depth-7:#6ba2e0;

 

  --bx-wash-1:#13233d; --bx-wash-2:#1b1938; --bx-wash-3:#2c2019;

  --bx-wash-4:#2a1a28; --bx-wash-5:#1d1a3c; --bx-wash-6:#101f36;

  --ghost-ink:rgba(190,205,235,.10); --signal-flash:#dce8ff;

 

  --chart-c1:#6BA5F5; --chart-c2:#F0913E; --chart-c3:#A684EE; --chart-c4:#2BC0A6;

  --chart-o1:#2E5C98; --chart-o2:#4A7EC2; --chart-o3:#71A3E4; --chart-o4:#A6CAFA;

  --chart-axis:#8d97ae; --chart-label:#dfe6f4; --chart-surface:#192235;

 

  --dr-bg:#10121b; --dr-surface:#171a27; --dr-card:rgba(23,26,39,.82); --dr-ink:#f1f5ff;

  --dr-ink-2:#98a2b8; --dr-ink-3:#78829a; --dr-purple:#9b7cf6; --dr-purple-soft:#b9a4fb;

  --dr-blue:#4f8ef7; --dr-border:#292d40; --dr-active:#211b38; --dr-hover:#1b1f30;

}

 

* { box-sizing: border-box; }

body {

  margin: 0;

  font-family: "Montserrat", system-ui, sans-serif;

  background: var(--page-bg);

  color: var(--text-primary);

}

## 9.9 app.css (component styles)

**ui/src/app.css**

.app { display:grid; grid-template-columns:280px 1fr; height:100vh; }

.side { background:var(--dr-bg); border-right:1px solid var(--dr-border); padding:16px; overflow:auto; }

.side h1 { font-size:16px; margin:0 0 14px; color:var(--brand-purple); }

.conv { padding:10px 12px; border-radius:10px; cursor:pointer; font-size:13px; color:var(--dr-ink-2); }

.conv:hover { background:var(--dr-hover); }

.conv.active { background:var(--dr-active); color:var(--dr-purple); font-weight:600; }

.main { display:flex; flex-direction:column; min-width:0; }

.top { display:flex; justify-content:space-between; align-items:center; padding:14px 24px;

       border-bottom:1px solid rgba(var(--line-rgb),.1); background:rgb(var(--surface-rgb)); }

.msgs { flex:1; overflow:auto; padding:24px; display:flex; flex-direction:column; gap:14px; }

.bubble { max-width:760px; padding:12px 16px; border-radius:16px; font-size:14px;

          line-height:1.6; white-space:pre-wrap; }

.user { align-self:flex-end; background:var(--brand-purple); color:var(--on-accent); }

.bot { align-self:flex-start; background:rgb(var(--surface-rgb));

       border:1px solid rgba(var(--line-rgb),.12);

       box-shadow:0 2px 10px rgba(var(--shadow-rgb),.06); }

.steps { margin-top:8px; font-size:12px; color:var(--text-secondary); }

.steps summary { cursor:pointer; color:var(--brand-blue); }

.steps pre { background:var(--muted-fill); padding:8px; border-radius:8px; overflow:auto; }

.composer { display:flex; gap:10px; padding:16px 24px;

            border-top:1px solid rgba(var(--line-rgb),.1); background:rgb(var(--surface-rgb)); }

.composer input { flex:1; padding:12px 16px; border-radius:12px;

                  border:1px solid rgba(var(--line-rgb),.2);

                  background:var(--kg-bg-2); color:var(--text-primary); font:inherit; }

.composer input:focus { outline:2px solid var(--brand-purple); }

button { font:inherit; cursor:pointer; border:0; border-radius:12px; padding:10px 18px; font-weight:600; }

.primary { background:var(--brand-purple); color:var(--on-accent); }

.primary:hover { background:var(--brand-blue); }

.primary:disabled { background:var(--muted-fill); color:var(--muted-ink); cursor:default; }

.ghost { background:var(--muted-fill); color:var(--text-primary); }

.typing { color:var(--text-muted); font-size:13px; }

**Rule. **Components must use tokens (for example var(--brand-purple)), never hard-coded hex values. That keeps dark mode working automatically.

# 10. Extending the agent with tools

Any Python function decorated with @tool becomes available to the agent. The docstring is shown to the model as the tool description, so write it clearly. Register the tool in the TOOLS list.

**backend/app/tools.py (addition)**

from langchain_core.tools import tool

 

@tool

def get_order_status(order_id: int) -> str:

    """Look up the status of an order by its ID."""

    # query the read-only engine, or call an internal API

    ...

 

# register it in tools.py

TOOLS = [get_schema, run_sql, get_order_status]

### Example: a Text-to-BeastMode tool

This tool calls the Domo Text-to-BeastMode service (see Appendix B) so the agent can turn a plain-English request into a Beast Mode calculation.

**backend/app/tools.py (addition)**

import httpx

from langchain_core.tools import tool

from .config import settings

 

@tool

def generate_beastmode(request: str, data_source_name: str, columns: list[dict]) -> str:

    """Generate a Domo Beast Mode calculation from plain English.

    columns example: [{"name": "amount", "type": "LONG"}, {"name": "region", "type": "STRING"}]"""

    url = f"https://{settings.domo_subdomain}.domo.com/api/ai/v1/text/beastmode"

    payload = {

        "input": request,

        "dataSourceSchema": {"dataSourceName": data_source_name, "columns": columns},

    }

    # Do not reuse DOMO_MODEL here: the model must be enabled for the

    # Text-to-BeastMode service. Add "model": "<id>" only if you need a non-default one.

    r = httpx.post(

        url, json=payload, timeout=120,

        headers={"X-DOMO-Developer-Token": settings.domo_token,

                 "Content-Type": "application/json"},

    )

    r.raise_for_status()

    return r.json()["output"]

 

# register it in tools.py

TOOLS = [get_schema, run_sql, generate_beastmode]

Ideas for further tools: call an internal REST API, search a document table, create a Domo dataset query, send a notification, or trigger a workflow.

# 11. Hardening checklist

| **Area** | **Action** |
| --- | --- |
| Secrets | Keep the Domo token only in backend .env or a secret manager. Rotate it periodically. |
| SQL safety | The agent_ro role is the primary protection. The regex check is a second layer. Grant it SELECT only on tables the agent may see. |
| Reliability | Use temperature 0 and enable responseFormat (JSON schema) in the Domo payload so the model returns valid JSON actions. |
| Sessions | Domo accepts an optional sessionId (UUID). Pass the conversation ID to group calls in Domo AI session logs. |
| Latency | Each agent step is one Domo call. Keep max_steps at 3 to 5. Add streaming (SSE) later for a better UX. |
| Migrations | Replace create_all with Alembic once the schema changes. |
| Authentication | Add JWT or SSO before exposing the API. Associate conversations with a user ID. |
| Rate limits | Add per-user rate limiting to protect Domo AI usage quotas. |
| Logging | Log tool calls and Domo token usage (modelProviderUsage) for cost tracking. |

### Optional: structured JSON output

**backend/app/domo_llm.py (optional)**

# In DomoTextLLM._call, add structured output to the Domo payload:

payload["responseFormat"] = {

    "type": "json",

    "schema": {

        "type": "object",

        "properties": {

            "action": {"type": "string", "description": "tool name or 'final'"},

            "input":  {"type": "object", "description": "tool arguments",

                       "properties": {}},

            "answer": {"type": "string", "description": "final answer"},

        },

        "required": ["action"],

    },

}

# Confirm the exact "type" value for your Domo version in the Playground / API docs.

# 12. Deployment

- Set production values for .env (database URLs, Domo token, model ID).

- Run the backend with Gunicorn and Uvicorn workers behind Nginx or a load balancer with HTTPS.

- Build the frontend and serve the static files from Nginx, a CDN, or any static host.

- Update the CORS allow_origins list to the production domain.

- Route /api to the backend and everything else to the static build.

# Backend

pip install gunicorn

gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8000 app.main:app

 

# Frontend

cd ui && npm run build        # outputs ui/dist, serve with Nginx or any static host

# 13. Troubleshooting

| **Symptom** | **Likely cause** | **Fix** |
| --- | --- | --- |
| 403 from Domo | Wrong token, or model not enabled for Text Generation | Re-test with curl; confirm the model ID in the Playground; ask an admin to enable it |
| 409 from Domo | Conflict with the model or session configuration | Remove sessionId and retry; verify the model configuration |
| Agent returns raw text, no tool calls | Model did not return valid JSON | Lower temperature; add responseFormat; shorten the prompt |
| ERROR: only a single read-only SELECT | Model generated multiple statements or a write | Expected safety behavior; refine the question or prompt |
| permission denied for table | agent_ro lacks SELECT | Run GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_ro; |
| CORS error in browser | Origin not allowed | Use the Vite proxy, or add the origin to allow_origins |
| ModuleNotFoundError: app | Missing __init__.py or wrong directory | Run uvicorn from backend/ and create app/__init__.py |
| Dark mode does not switch | Hard-coded colors in CSS | Replace with var(--token) values |
| Slow responses | Many agent steps | Reduce max_steps; use a faster Domo model |

# Appendix A. Domo Text Generation API reference

**Endpoint:** POST https://{subdomain}.domo.com/api/ai/v1/text/generation

**Authentication:** header X-DOMO-Developer-Token: <token>

### Request fields

| **Field** | **Type** | **Description** |
| --- | --- | --- |
| input (required) | string | The input text or prompt. |
| model | string | Model ID. Must be enabled for Text Generation by an admin. |
| system | string | System message. Overrides the default system message. |
| temperature | number | Randomness. Lower is more deterministic. |
| maxTokens | integer | Maximum tokens to generate. |
| sessionId | uuid | Associates the request with an AI session. |
| promptTemplate | object | Custom template, e.g. {"template": "Respond in ${language}: ${input}"}. |
| parameters | object | Key-value pairs injected into the prompt template. |
| modelConfiguration | object | Additional model-specific settings. |
| responseFormat | object | JSON schema for structured output. |
| reasoningConfig | object | reasoningEffort: NONE, LOW, MEDIUM, HIGH, XHIGH, MAX. |

### Response fields

| **Field** | **Description** |
| --- | --- |
| output | The generated text. |
| prompt | The formatted prompt sent to the model. |
| modelId | The model that produced the response. |
| sessionId | The associated AI session. |
| modelProviderUsage | Token usage: inputTokens, outputTokens, totalTokens, reasoningTokens. |

Source: Domo developer documentation, AI Services, Text Generation (domo.com/docs/api-reference/ai-services--text/text-generation).

# Appendix B. Domo Text-to-BeastMode API reference

Generates a Beast Mode calculation from a plain-English request and a data source schema.

**Endpoint:** POST https://{subdomain}.domo.com/api/ai/v1/text/beastmode

**Authentication:** header X-DOMO-Developer-Token: <token> (same token as Text Generation)

### Request fields

| **Field** | **Type** | **Description** |
| --- | --- | --- |
| input (required) | string | The plain-English request, e.g. "Count distinct products". |
| dataSourceSchema | object | Data source name, optional ID and description, and the list of columns or calculations. |
| model | string | Model ID. Must be enabled for the Text-to-BeastMode service by an admin. |
| system | string | System message override. |
| temperature | number | Randomness. Lower is more deterministic. |
| maxTokens | integer | Maximum tokens to generate. |
| sessionId | uuid | Associates the request with an AI session. |
| promptTemplate | object | Custom template. Auto-injected placeholders: ${input}, ${system}, ${dataSourceSchema}. |
| parameters | object | Key-value pairs injected into the prompt template. |
| modelConfiguration | object | Additional model-specific settings. |
| disableValidation | boolean | Skip validation of the generated Beast Mode calculation. |
| reasoningConfig | object | reasoningEffort: NONE, LOW, MEDIUM, HIGH, XHIGH, MAX. |

### dataSourceSchema

| **Field** | **Type** | **Description** |
| --- | --- | --- |
| dataSourceId | string | Unique identifier of the data source. |
| dataSourceName | string | Name of the data source. |
| description | string | Description of the data source. |
| columns | array | Columns (AISchemaColumn) or calculations (AISchemaCalculation). |

### Column fields (AISchemaColumn)

| **Field** | **Type** | **Description** |
| --- | --- | --- |
| name (required) | string | Column name. |
| type (required) | string | Data type, e.g. STRING, LONG, DATETIME. |
| displayName | string | Column display name. |
| description | string | Column description. |
| synonyms | string[] | Alternative names for the column. |
| classification | string | Classification of the data in the column. |
| defaultAggregation | string | Default aggregation for the column. |
| defaultValue | any | Default value for the column. |

A calculation (AISchemaCalculation) adds templateId, formula, aggregatable, and legacyId.

### Response fields

| **Field** | **Description** |
| --- | --- |
| output | The generated Beast Mode calculation, e.g. COUNT(DISTINCT product). |
| prompt | The formatted prompt sent to the model. |
| modelId | The model that produced the response. |
| sessionId | The associated AI session. |
| modelProviderUsage | Token usage: inputTokens, outputTokens, totalTokens, reasoningTokens. |
| recoveryDetail | What was wrong with a first attempt that had to be regenerated. Null when none was. |

### Status codes

| **Code** | **Meaning** |
| --- | --- |
| 200 | Calculation generated successfully. |
| 403 | Forbidden: check the token and that the model is enabled for this service. |
| 409 | Conflict. |

### Test with curl

curl -X POST "https://gwcteq-partner.domo.com/api/ai/v1/text/beastmode" \

  -H "X-DOMO-Developer-Token: $DOMO_TOKEN" \

  -H "Content-Type: application/json" \

  -d '{

    "input": "Count distinct products",

    "dataSourceSchema": {

      "dataSourceName": "Store Sales",

      "columns": [

        {"type": "STRING",   "name": "product"},

        {"type": "LONG",     "name": "store"},

        {"type": "LONG",     "name": "amount"},

        {"type": "DATETIME", "name": "timestamp"},

        {"type": "STRING",   "name": "region"}

      ]

    }

  }'

# Example output field:  COUNT(DISTINCT `product`)

Source: Domo developer documentation, AI Services, Text-to-BeastMode (domo.com/docs/api-reference/ai-services--text/text-to-beastmode).

# Appendix C. Domo dataset schema API (v3): sample call format

Use this call to read a dataset's columns before calling Text-to-BeastMode, which needs the data source schema. The sample below is the call format used in the project's existing Node.js code.

**Endpoint:** GET https://{domain}/api/data/v3/datasources/{datasetId}

**Authentication:** header X-DOMO-DEVELOPER-TOKEN: <token> (header names are case-insensitive, so this is the same token header used in the other appendices).

**Note. **This endpoint is taken from the project's sample code. It is not part of the AI Services pages in Appendices A and B, so confirm the response shape on your Domo instance. The code reads columns from schema.columns first and falls back to columns, and takes each name from name or columnName.

### C.1 Node.js sample (axios)

**Node.js**

// Helper: auth headers for every Domo call

function getAuthHeaders(token) {

  return {

    'Content-Type': 'application/json',

    'X-DOMO-DEVELOPER-TOKEN': token,

  };

}

 

// Fetch column names of a dataset (v3 datasources API)

async function fetchDatasetColumns(domain, datasetId, token) {

  const headers = getAuthHeaders(token);

  const v3Url = `https://${domain}/api/data/v3/datasources/${datasetId}`;

  console.log(`[SCHEMA] Fetching v3 schema: ${v3Url}`);

  const v3Response = await axios.get(v3Url, { headers, timeout: 15000 });

  const cols = v3Response.data?.schema?.columns || v3Response.data?.columns;

  if (cols && cols.length > 0) {

    return cols.map(c => c.name || c.columnName);

  }

  return [];

}

### C.2 Python equivalent for this project

The same call in the FastAPI backend, wrapped as a LangChain tool. It returns the name and type of each column, which maps directly onto the columns list expected by Text-to-BeastMode (name and type are required there).

**backend/app/tools.py (addition)**

import httpx

from langchain_core.tools import tool

from .config import settings

 

def domo_headers() -> dict:

    return {

        "Content-Type": "application/json",

        "X-DOMO-DEVELOPER-TOKEN": settings.domo_token,

    }

 

def fetch_dataset_columns(dataset_id: str) -> list[dict]:

    url = f"https://{settings.domo_subdomain}.domo.com/api/data/v3/datasources/{dataset_id}"

    r = httpx.get(url, headers=domo_headers(), timeout=15)

    r.raise_for_status()

    data = r.json()

    cols = (data.get("schema") or {}).get("columns") or data.get("columns") or []

    return [{"name": c.get("name") or c.get("columnName"), "type": c.get("type")}

            for c in cols]

 

@tool

def get_dataset_schema(dataset_id: str) -> str:

    """Return the column names and types of a Domo dataset by its dataset ID."""

    try:

        return str(fetch_dataset_columns(dataset_id))

    except Exception as e:

        return f"ERROR: {e}"

 

# register in tools.py:  TOOLS = [get_schema, run_sql, get_dataset_schema, generate_beastmode]

### C.3 Test with curl

curl -X GET "https://gwcteq-partner.domo.com/api/data/v3/datasources/<DATASET_ID>" \

  -H "Content-Type: application/json" \

  -H "X-DOMO-DEVELOPER-TOKEN: $DOMO_TOKEN"

### C.4 Typical workflow

- The user gives a dataset ID and a request, for example "count distinct products".

- The agent calls get_dataset_schema to read the columns and types (this appendix).

- The agent calls generate_beastmode with those columns as dataSourceSchema (Appendix B).

- The agent returns the generated calculation, for example COUNT(DISTINCT product).

### C.5 Request and response summary

| **Item** | **Detail** |
| --- | --- |
| Method | GET |
| Path parameter | datasetId: the Domo dataset (data source) ID |
| Headers | Content-Type: application/json, X-DOMO-DEVELOPER-TOKEN |
| Timeout (sample) | 15 seconds |
| Columns location | schema.columns or columns in the response body |
| Column name field | name or columnName |
| Empty result | Return an empty list when no columns are found |

	AI Agent Development Setup Guide	Page