import hashlib
import importlib.util
import json
import os
import re
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import streamlit as st

APP_DIR = Path(__file__).parent
DATA_DIR = APP_DIR / "local_rag_data"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "local_rag.sqlite"
MODEL_DIR = APP_DIR / "models"
SUPPORTED_TYPES = ["pdf", "docx", "txt", "md", "html", "htm"]

OPTIONAL_DEPENDENCIES = {
    "PDF extraction": ("pymupdf4llm", "pymupdf4llm"),
    "DOCX extraction": ("docx", "python-docx"),
    "HTML extraction": ("bs4", "beautifulsoup4"),
    "Local LLM": ("llama_cpp", "llama-cpp-python"),
}


@dataclass
class User:
    id: int
    email: str
    name: str
    role: str


@dataclass
class Section:
    id: int
    document_id: int
    document_name: str
    title: str
    content: str
    page: int | None
    score: float = 0.0


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def get_setting(name: str, default: str = "") -> str:
    try:
        secret_value = st.secrets.get(name)
    except Exception:
        secret_value = None
    return str(secret_value or os.getenv(name) or default)


def dependency_status() -> list[tuple[str, bool, str]]:
    return [
        (label, importlib.util.find_spec(module_name) is not None, package_name)
        for label, (module_name, package_name) in OPTIONAL_DEPENDENCIES.items()
    ]


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, expected = stored_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000).hex()
    return secrets.compare_digest(digest, expected)


def connect_db() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)
    MODEL_DIR.mkdir(exist_ok=True)
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def require_lastrowid(cursor: sqlite3.Cursor) -> int:
    if cursor.lastrowid is None:
        raise RuntimeError("SQLite insert did not return a row id")
    return cursor.lastrowid


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
            section_count INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            page INTEGER,
            ordinal INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
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
            citations TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_sections_document ON sections(document_id, ordinal);
        CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
        """
    )
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(documents)").fetchall()}
    if "section_count" not in columns:
        connection.execute("ALTER TABLE documents ADD COLUMN section_count INTEGER NOT NULL DEFAULT 0")
    message_columns = {row["name"] for row in connection.execute("PRAGMA table_info(messages)").fetchall()}
    if "citations" not in message_columns:
        connection.execute("ALTER TABLE messages ADD COLUMN citations TEXT NOT NULL DEFAULT '[]'")
    connection.commit()


def bootstrap_local_user(connection: sqlite3.Connection) -> User:
    local_email = "local@rag-chatbot"
    existing = connection.execute("SELECT * FROM users WHERE email = ?", (local_email,)).fetchone()
    if existing:
        return User(id=existing["id"], email=existing["email"], name=existing["name"], role=existing["role"])
    connection.execute(
        "INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
        (local_email, "Local Workspace", hash_password(secrets.token_urlsafe(32)), "user", utc_now()),
    )
    connection.commit()
    row = find_user(connection, local_email)
    if row is None:
        raise RuntimeError("Local workspace user was not initialized")
    return User(id=row["id"], email=row["email"], name=row["name"], role=row["role"])


def find_user(connection: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()


def create_user(connection: sqlite3.Connection, email: str, name: str, password: str) -> User:
    connection.execute(
        "INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
        (email.lower().strip(), name.strip(), hash_password(password), "user", utc_now()),
    )
    connection.commit()
    row = find_user(connection, email)
    if row is None:
        raise RuntimeError("Account creation failed")
    return User(id=row["id"], email=row["email"], name=row["name"], role=row["role"])


def authenticate(connection: sqlite3.Connection, email: str, password: str) -> User | None:
    row = find_user(connection, email)
    if row is None or not verify_password(password, row["password_hash"]):
        return None
    return User(id=row["id"], email=row["email"], name=row["name"], role=row["role"])


def stable_file_name(original_name: str, content: bytes) -> str:
    digest = hashlib.sha256(original_name.encode() + content).hexdigest()[:16]
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", original_name)
    return f"{digest}-{safe_name}"


def extract_markdown(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        try:
            import pymupdf4llm
        except ModuleNotFoundError as exc:
            raise RuntimeError("Install PyMuPDF4LLM with: pip install pymupdf4llm") from exc

        return pymupdf4llm.to_markdown(str(path), page_chunks=False)
    if suffix == ".docx":
        try:
            import docx
        except ModuleNotFoundError as exc:
            raise RuntimeError("Install python-docx with: pip install python-docx") from exc

        document = docx.Document(str(path))
        lines = []
        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            style = paragraph.style.name.lower()
            if "heading" in style:
                lines.append(f"\n## {text}\n")
            else:
                lines.append(text)
        return "\n\n".join(lines)
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if suffix in {".html", ".htm"}:
        try:
            from bs4 import BeautifulSoup
        except ModuleNotFoundError as exc:
            raise RuntimeError("Install BeautifulSoup with: pip install beautifulsoup4") from exc

        soup = BeautifulSoup(raw, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        headings = []
        for element in soup.find_all(["h1", "h2", "h3", "p", "li"]):
            text = element.get_text(" ", strip=True)
            if not text:
                continue
            if element.name in {"h1", "h2", "h3"}:
                headings.append(f"\n## {text}\n")
            else:
                headings.append(text)
        return "\n\n".join(headings)
    return raw


def normalize_text(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", text.replace("\r", "\n"))).strip()


def split_markdown_sections(markdown: str, max_words: int = 850) -> list[dict[str, str | int | None]]:
    markdown = normalize_text(markdown)
    if not markdown:
        return []
    heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
    matches = list(heading_pattern.finditer(markdown))
    raw_sections: list[dict[str, str | int | None]] = []
    if not matches:
        raw_sections.append({"title": "Document", "content": markdown, "page": None})
    else:
        preface = markdown[: matches[0].start()].strip()
        if preface:
            raw_sections.append({"title": "Document overview", "content": preface, "page": None})
        for index, match in enumerate(matches):
            title = match.group(2).strip()
            start = match.end()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
            content = markdown[start:end].strip()
            if content:
                raw_sections.append({"title": title, "content": content, "page": None})

    sections: list[dict[str, str | int | None]] = []
    for section in raw_sections:
        words = str(section["content"]).split()
        if len(words) <= max_words:
            sections.append(section)
            continue
        for part_index, start in enumerate(range(0, len(words), max_words)):
            part = " ".join(words[start : start + max_words])
            sections.append(
                {"title": f"{section['title']} part {part_index + 1}", "content": part, "page": section["page"]}
            )
    return sections


def ingest_upload(connection: sqlite3.Connection, user: User, uploaded_file) -> int:
    content = uploaded_file.getvalue()
    saved_path = UPLOAD_DIR / stable_file_name(uploaded_file.name, content)
    saved_path.write_bytes(content)
    markdown = extract_markdown(saved_path)
    sections = split_markdown_sections(markdown)
    if not sections:
        raise ValueError("No readable text was found in the uploaded document.")

    cursor = connection.execute(
        "INSERT INTO documents (user_id, name, path, section_count, created_at) VALUES (?, ?, ?, ?, ?)",
        (user.id, uploaded_file.name, str(saved_path), len(sections), utc_now()),
    )
    document_id = require_lastrowid(cursor)
    connection.executemany(
        "INSERT INTO sections (document_id, title, content, page, ordinal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (document_id, str(section["title"]), str(section["content"]), section["page"], index, utc_now())
            for index, section in enumerate(sections)
        ],
    )
    connection.commit()
    return len(sections)


def tokenize(text: str) -> list[str]:
    return [term for term in re.findall(r"[a-zA-Z0-9]+", text.lower()) if len(term) > 2]


def retrieve_sections(connection: sqlite3.Connection, user: User, question: str, limit: int = 5) -> list[Section]:
    query_terms = tokenize(question)
    if not query_terms:
        return []
    rows = connection.execute(
        """
        SELECT s.id, s.document_id, d.name AS document_name, s.title, s.content, s.page
        FROM sections s
        JOIN documents d ON d.id = s.document_id
        WHERE d.user_id = ?
        ORDER BY d.created_at DESC, s.ordinal ASC
        """,
        (user.id,),
    ).fetchall()
    scored: list[Section] = []
    for row in rows:
        title = row["title"]
        content = row["content"]
        searchable = f"{title} {content}".lower()
        score = 0.0
        for term in query_terms:
            score += searchable.count(term)
            if term in title.lower():
                score += 2.5
        if score > 0:
            scored.append(
                Section(
                    id=row["id"],
                    document_id=row["document_id"],
                    document_name=row["document_name"],
                    title=title,
                    content=content,
                    page=row["page"],
                    score=score / max(1, len(tokenize(content))),
                )
            )
    return sorted(scored, key=lambda item: item.score, reverse=True)[:limit]


@st.cache_resource(show_spinner=False)
def load_llama(model_path: str, n_ctx: int, n_threads: int):
    try:
        from llama_cpp import Llama
    except ModuleNotFoundError as exc:
        raise RuntimeError("Install llama.cpp Python bindings with: pip install llama-cpp-python") from exc

    return Llama(
        model_path=model_path,
        n_ctx=n_ctx,
        n_threads=n_threads,
        n_gpu_layers=int(get_setting("LLAMA_N_GPU_LAYERS", "0")),
        verbose=False,
    )


def build_prompt(question: str, sections: list[Section]) -> str:
    context = "\n\n".join(
        f"[{index + 1}] {section.document_name} / {section.title}\n{section.content[:2200]}"
        for index, section in enumerate(sections)
    )
    system_instruction = (
        "You are a local document Q&A assistant. Answer only from the provided document sections. "
        "If the answer is not in the sections, say that the document does not provide enough information. "
        "Cite sources inline as [1], [2]."
    )
    return f"""<|im_start|>system
{system_instruction}
<|im_end|>
<|im_start|>user
Document sections:
{context or "No relevant sections were found."}

Question: {question}
<|im_end|>
<|im_start|>assistant
"""


def generate_extractive_answer(question: str, sections: list[Section]) -> str:
    if not sections:
        return (
            "I could not find relevant sections in your uploaded documents. "
            "Upload a document or ask about content that appears in it."
        )

    lines = [
        "I found relevant document sections for your question. "
        "A local GGUF model is not connected, so this is an extractive answer from the retrieved text.",
        "",
    ]
    for index, section in enumerate(sections, start=1):
        excerpt = " ".join(section.content.split())[:700]
        lines.append(f"[{index}] {section.document_name} / {section.title}")
        lines.append(excerpt)
        lines.append("")
    lines.append("To generate a rewritten natural-language answer, add a GGUF model path in the sidebar.")
    return "\n".join(lines).strip()


def generate_answer(
    model_path: str, question: str, sections: list[Section], n_ctx: int, n_threads: int, max_tokens: int
) -> str:
    llm = load_llama(model_path, n_ctx, n_threads)
    prompt = build_prompt(question, sections)
    result = llm(prompt, max_tokens=max_tokens, temperature=0.2, top_p=0.9, stop=["<|im_end|>", "<|im_start|>"])
    return str(result["choices"][0]["text"]).strip()


def get_or_create_conversation(connection: sqlite3.Connection, user: User, title: str) -> int:
    conversation_id = st.session_state.get("conversation_id")
    if conversation_id:
        return int(conversation_id)
    cursor = connection.execute(
        "INSERT INTO conversations (user_id, title, created_at) VALUES (?, ?, ?)",
        (user.id, title[:80] or "New chat", utc_now()),
    )
    connection.commit()
    conversation_id = require_lastrowid(cursor)
    st.session_state.conversation_id = conversation_id
    return conversation_id


def save_message(
    connection: sqlite3.Connection,
    conversation_id: int,
    role: str,
    content: str,
    citations: list[Section] | None = None,
) -> None:
    payload = [
        {
            "document": section.document_name,
            "title": section.title,
            "section_id": section.id,
            "score": section.score,
        }
        for section in (citations or [])
    ]
    connection.execute(
        "INSERT INTO messages (conversation_id, role, content, citations, created_at) VALUES (?, ?, ?, ?, ?)",
        (conversation_id, role, content, json.dumps(payload), utc_now()),
    )
    connection.commit()


def load_messages(connection: sqlite3.Connection, conversation_id: int) -> list[dict[str, str]]:
    rows = connection.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    return [{"role": row["role"], "content": row["content"]} for row in rows]


def render_sidebar(connection: sqlite3.Connection, user: User) -> dict[str, int | str]:
    with st.sidebar:
        st.subheader("Local Workspace")
        st.caption("No login required")
        if st.button("New chat", use_container_width=True):
            st.session_state.pop("conversation_id", None)
            st.session_state.messages = []
            st.rerun()

        st.divider()
        st.write("Local model")
        discovered_models = sorted(str(path) for path in MODEL_DIR.glob("*.gguf"))
        default_model = get_setting(
            "LLAMA_MODEL_PATH", discovered_models[0] if discovered_models else str(MODEL_DIR / "model.gguf")
        )
        model_path = st.text_input("GGUF model path", value=default_model)
        n_ctx = st.slider("Context tokens", 2048, 16384, int(get_setting("LLAMA_N_CTX", "8192")), step=1024)
        n_threads = st.slider(
            "CPU threads",
            1,
            max(1, os.cpu_count() or 4),
            int(get_setting("LLAMA_N_THREADS", str(max(1, min(8, os.cpu_count() or 4))))),
        )
        max_tokens = st.slider("Answer tokens", 128, 2048, 700, step=64)

        st.divider()
        with st.expander("Setup status"):
            for label, installed, package_name in dependency_status():
                if installed:
                    st.success(f"{label}: installed")
                else:
                    st.warning(f"{label}: install with `pip install {package_name}`")

        st.divider()
        uploaded_files = st.file_uploader("Upload documents", type=SUPPORTED_TYPES, accept_multiple_files=True)
        if uploaded_files and st.button("Extract and index", use_container_width=True):
            with st.spinner("Extracting structured sections..."):
                total = 0
                try:
                    for uploaded_file in uploaded_files:
                        total += ingest_upload(connection, user, uploaded_file)
                except Exception as exc:
                    st.error(str(exc))
                else:
                    st.success(f"Indexed {total} sections.")

        st.divider()
        st.write("Documents")
        rows = connection.execute(
            "SELECT name, section_count, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
            (user.id,),
        ).fetchall()
        for row in rows:
            st.caption(f"{row['name']} - {row['section_count']} sections")

        st.divider()
        st.write("Stats")
        st.metric("Documents", connection.execute("SELECT COUNT(*) AS count FROM documents").fetchone()["count"])
        st.metric("Sections", connection.execute("SELECT COUNT(*) AS count FROM sections").fetchone()["count"])
    return {"model_path": model_path, "n_ctx": n_ctx, "n_threads": n_threads, "max_tokens": max_tokens}


def render_chat(connection: sqlite3.Connection, user: User, settings: dict[str, int | str]) -> None:
    st.title("Local-first Document Q&A")
    st.caption("Upload documents, retrieve relevant sections, and optionally answer with a local llama.cpp model.")

    model_path = Path(str(settings["model_path"])).expanduser()
    if not model_path.exists():
        st.info("No GGUF model connected. The app will still answer using retrieved document excerpts.")

    if "messages" not in st.session_state:
        conversation_id = st.session_state.get("conversation_id")
        st.session_state.messages = load_messages(connection, int(conversation_id)) if conversation_id else []

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    question = st.chat_input("Ask a question about your uploaded documents")
    if not question:
        return

    conversation_id = get_or_create_conversation(connection, user, question)
    st.session_state.messages.append({"role": "user", "content": question})
    save_message(connection, conversation_id, "user", question)
    with st.chat_message("user"):
        st.markdown(question)

    sections = retrieve_sections(connection, user, question)
    if not sections:
        answer = (
            "I could not find relevant sections in your uploaded documents. "
            "Upload a document or ask about content that appears in it."
        )
    elif not model_path.exists():
        answer = generate_extractive_answer(question, sections)
    else:
        with st.spinner("Running local llama.cpp inference..."):
            try:
                answer = generate_answer(
                    str(model_path),
                    question,
                    sections,
                    int(settings["n_ctx"]),
                    int(settings["n_threads"]),
                    int(settings["max_tokens"]),
                )
            except Exception as exc:
                answer = f"Could not run the local model: {exc}"

    with st.chat_message("assistant"):
        st.markdown(answer)
        if sections:
            with st.expander("Retrieved sections"):
                for index, section in enumerate(sections, start=1):
                    st.markdown(f"**[{index}] {section.document_name} / {section.title}**")
                    st.caption(section.content[:700])

    st.session_state.messages.append({"role": "assistant", "content": answer})
    save_message(connection, conversation_id, "assistant", answer, sections)


def main() -> None:
    st.set_page_config(page_title="Local Document Q&A", page_icon="Doc", layout="wide")
    connection = connect_db()
    migrate(connection)
    user = bootstrap_local_user(connection)
    settings = render_sidebar(connection, user)
    render_chat(connection, user, settings)


if __name__ == "__main__":
    main()
