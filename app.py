import hashlib
import os
import sqlite3
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

import chromadb
import docx
import pypdf
import streamlit as st
from bs4 import BeautifulSoup
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from openai import OpenAI
from passlib.hash import bcrypt


APP_DIR = Path(__file__).parent
DATA_DIR = APP_DIR / "streamlit_data"
DB_PATH = DATA_DIR / "rag_chatbot.sqlite"
CHROMA_DIR = DATA_DIR / "chroma"
UPLOAD_DIR = DATA_DIR / "uploads"
SUPPORTED_TYPES = ["pdf", "docx", "txt", "html", "htm", "md"]


@dataclass
class User:
    id: int
    email: str
    name: str
    role: str


@dataclass
class Citation:
    document_name: str
    chunk_id: str
    excerpt: str
    score: float


def require_secret(name: str) -> str:
    value = st.secrets.get(name) or os.getenv(name)
    if not value:
        st.error(f"Missing required secret: {name}")
        st.stop()
    return str(value)


def connect_db() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def migrate(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            chunk_count INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
        """
    )
    connection.commit()


def bootstrap_admin(connection: sqlite3.Connection) -> None:
    admin_email = st.secrets.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = st.secrets.get("ADMIN_PASSWORD", "ChangeMe123!")
    existing = connection.execute("SELECT id FROM users WHERE email = ?", (admin_email,)).fetchone()
    if existing:
        return
    connection.execute(
        "INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
        (admin_email, "Admin", bcrypt.hash(admin_password), "admin", datetime.utcnow().isoformat()),
    )
    connection.commit()


def find_user(connection: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()


def create_user(connection: sqlite3.Connection, email: str, name: str, password: str) -> User:
    connection.execute(
        "INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
        (email.lower().strip(), name.strip(), bcrypt.hash(password), "user", datetime.utcnow().isoformat()),
    )
    connection.commit()
    row = find_user(connection, email)
    if row is None:
        raise RuntimeError("Account creation failed")
    return User(id=row["id"], email=row["email"], name=row["name"], role=row["role"])


def authenticate(connection: sqlite3.Connection, email: str, password: str) -> User | None:
    row = find_user(connection, email)
    if row is None or not bcrypt.verify(password, row["password_hash"]):
        return None
    return User(id=row["id"], email=row["email"], name=row["name"], role=row["role"])


def file_hash(name: str, content: bytes) -> str:
    return hashlib.sha256(name.encode("utf-8") + content).hexdigest()[:16]


def extract_text(path: Path, suffix: str) -> str:
    suffix = suffix.lower()
    if suffix == ".pdf":
        reader = pypdf.PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if suffix == ".docx":
        document = docx.Document(str(path))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if suffix in {".html", ".htm"}:
        soup = BeautifulSoup(raw, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return soup.get_text(" ")
    return raw


def chunk_text(text: str, size: int = 900, overlap: int = 140) -> list[str]:
    words = text.replace("\r", "\n").split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        chunk = " ".join(words[start : start + size]).strip()
        if chunk:
            chunks.append(chunk)
        if start + size >= len(words):
            break
        start += size - overlap
    return chunks


@st.cache_resource
def vector_collection(api_key: str):
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    embedding_function = OpenAIEmbeddingFunction(api_key=api_key, model_name="text-embedding-3-small")
    return client.get_or_create_collection(name="rag_documents", embedding_function=embedding_function)


def ingest_file(connection: sqlite3.Connection, user: User, uploaded_file, api_key: str) -> int:
    content = uploaded_file.getvalue()
    suffix = Path(uploaded_file.name).suffix.lower()
    saved_path = UPLOAD_DIR / f"{file_hash(uploaded_file.name, content)}-{uploaded_file.name}"
    saved_path.write_bytes(content)
    text = extract_text(saved_path, suffix)
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No readable text was found in this document.")

    cursor = connection.execute(
        "INSERT INTO documents (user_id, name, path, chunk_count, created_at) VALUES (?, ?, ?, ?, ?)",
        (user.id, uploaded_file.name, str(saved_path), len(chunks), datetime.utcnow().isoformat()),
    )
    document_id = cursor.lastrowid
    connection.commit()

    ids = [f"doc-{document_id}-chunk-{index}" for index in range(len(chunks))]
    metadatas = [
        {"document_id": document_id, "document_name": uploaded_file.name, "chunk_id": chunk_id, "user_id": user.id}
        for chunk_id in ids
    ]
    vector_collection(api_key).upsert(ids=ids, documents=chunks, metadatas=metadatas)
    return len(chunks)


def retrieve(question: str, api_key: str, limit: int = 5) -> list[Citation]:
    result = vector_collection(api_key).query(query_texts=[question], n_results=limit)
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    citations: list[Citation] = []
    for text, metadata, distance in zip(documents, metadatas, distances):
        citations.append(
            Citation(
                document_name=str(metadata.get("document_name", "Document")),
                chunk_id=str(metadata.get("chunk_id", "")),
                excerpt=str(text)[:500],
                score=max(0.0, 1.0 - float(distance)),
            )
        )
    return citations


def answer_stream(question: str, history: Iterable[dict[str, str]], citations: list[Citation], api_key: str):
    client = OpenAI(api_key=api_key)
    context = "\n\n".join(f"[{index + 1}] {citation.document_name}\n{citation.excerpt}" for index, citation in enumerate(citations))
    messages = [
        {
            "role": "system",
            "content": (
                "You are an enterprise RAG assistant. Answer using the retrieved context when available. "
                "Cite sources inline as [1], [2]. If the context is insufficient, say what is missing."
            ),
        },
        {"role": "system", "content": f"Retrieved context:\n{context or 'No context retrieved.'}"},
        *list(history)[-8:],
        {"role": "user", "content": question},
    ]
    stream = client.chat.completions.create(model="gpt-4o-mini", messages=messages, temperature=0.2, stream=True)
    for event in stream:
        token = event.choices[0].delta.content
        if token:
            yield token


def get_or_create_conversation(connection: sqlite3.Connection, user: User, title: str) -> int:
    conversation_id = st.session_state.get("conversation_id")
    if conversation_id:
        return int(conversation_id)
    cursor = connection.execute(
        "INSERT INTO conversations (user_id, title, created_at) VALUES (?, ?, ?)",
        (user.id, title[:80] or "New chat", datetime.utcnow().isoformat()),
    )
    connection.commit()
    st.session_state.conversation_id = cursor.lastrowid
    return int(cursor.lastrowid)


def save_message(connection: sqlite3.Connection, conversation_id: int, role: str, content: str) -> None:
    connection.execute(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (conversation_id, role, content, datetime.utcnow().isoformat()),
    )
    connection.commit()


def load_messages(connection: sqlite3.Connection, conversation_id: int) -> list[dict[str, str]]:
    rows = connection.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    return [{"role": row["role"], "content": row["content"]} for row in rows]


def render_auth(connection: sqlite3.Connection) -> None:
    st.title("Enterprise RAG Chatbot")
    login_tab, register_tab = st.tabs(["Sign in", "Register"])
    with login_tab:
        with st.form("login"):
            email = st.text_input("Email", value="admin@example.com")
            password = st.text_input("Password", type="password", value="ChangeMe123!")
            submitted = st.form_submit_button("Sign in", use_container_width=True)
        if submitted:
            user = authenticate(connection, email, password)
            if user:
                st.session_state.user = user
                st.rerun()
            st.error("Invalid email or password")
    with register_tab:
        with st.form("register"):
            name = st.text_input("Name")
            email = st.text_input("Work email")
            password = st.text_input("Create password", type="password")
            submitted = st.form_submit_button("Create account", use_container_width=True)
        if submitted:
            if len(password) < 8:
                st.error("Password must be at least 8 characters.")
            elif find_user(connection, email):
                st.error("Email is already registered.")
            else:
                st.session_state.user = create_user(connection, email, name, password)
                st.rerun()


def render_sidebar(connection: sqlite3.Connection, user: User, api_key: str) -> None:
    with st.sidebar:
        st.subheader(user.name)
        st.caption(f"{user.email} · {user.role}")
        if st.button("New chat", use_container_width=True):
            st.session_state.pop("conversation_id", None)
            st.session_state.messages = []
            st.rerun()
        uploaded_files = st.file_uploader("Upload documents", type=SUPPORTED_TYPES, accept_multiple_files=True)
        if uploaded_files and st.button("Ingest uploaded files", use_container_width=True):
            with st.spinner("Indexing documents..."):
                total_chunks = 0
                for uploaded_file in uploaded_files:
                    total_chunks += ingest_file(connection, user, uploaded_file, api_key)
            st.success(f"Indexed {total_chunks} chunks.")
        st.divider()
        st.write("Documents")
        rows = connection.execute(
            "SELECT name, chunk_count, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
            (user.id,),
        ).fetchall()
        for row in rows:
            st.caption(f"{row['name']} · {row['chunk_count']} chunks")
        if user.role == "admin":
            st.divider()
            st.write("Admin dashboard")
            users = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
            docs = connection.execute("SELECT COUNT(*) AS count FROM documents").fetchone()["count"]
            messages = connection.execute("SELECT COUNT(*) AS count FROM messages").fetchone()["count"]
            st.metric("Users", users)
            st.metric("Documents", docs)
            st.metric("Messages", messages)
        st.divider()
        if st.button("Sign out", use_container_width=True):
            st.session_state.clear()
            st.rerun()


def render_chat(connection: sqlite3.Connection, user: User, api_key: str) -> None:
    st.title("RAG Chatbot")
    st.caption("Upload documents, ask questions, and get cited answers.")
    if "messages" not in st.session_state:
        conversation_id = st.session_state.get("conversation_id")
        st.session_state.messages = load_messages(connection, int(conversation_id)) if conversation_id else []

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    question = st.chat_input("Ask your documents")
    if not question:
        return

    conversation_id = get_or_create_conversation(connection, user, question)
    st.session_state.messages.append({"role": "user", "content": question})
    save_message(connection, conversation_id, "user", question)
    with st.chat_message("user"):
        st.markdown(question)

    citations = retrieve(question, api_key)
    history = [message for message in st.session_state.messages if message["role"] in {"user", "assistant"}]
    with st.chat_message("assistant"):
        response = st.write_stream(answer_stream(question, history, citations, api_key))
        if citations:
            with st.expander("Sources"):
                for index, citation in enumerate(citations, start=1):
                    st.markdown(f"**[{index}] {citation.document_name}**")
                    st.caption(citation.excerpt)
    st.session_state.messages.append({"role": "assistant", "content": response})
    save_message(connection, conversation_id, "assistant", response)


def main() -> None:
    st.set_page_config(page_title="Enterprise RAG Chatbot", page_icon="💬", layout="wide")
    api_key = require_secret("OPENAI_API_KEY")
    connection = connect_db()
    migrate(connection)
    bootstrap_admin(connection)
    user = st.session_state.get("user")
    if not user:
        render_auth(connection)
        return
    render_sidebar(connection, user, api_key)
    render_chat(connection, user, api_key)


if __name__ == "__main__":
    main()
