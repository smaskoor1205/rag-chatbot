import sqlite3
from textwrap import dedent

import app


def test_password_hash_round_trip() -> None:
    stored_hash = app.hash_password("CorrectHorse123!")

    assert stored_hash.startswith("pbkdf2_sha256$")
    assert app.verify_password("CorrectHorse123!", stored_hash)
    assert not app.verify_password("wrong-password", stored_hash)
    assert not app.verify_password("CorrectHorse123!", "not-a-valid-hash")


def test_stable_file_name_is_deterministic_and_safe() -> None:
    first = app.stable_file_name("Quarterly Report.pdf", b"same-content")
    second = app.stable_file_name("Quarterly Report.pdf", b"same-content")

    assert first == second
    assert first.endswith("-Quarterly_Report.pdf")
    assert " " not in first


def test_split_markdown_sections_uses_headings() -> None:
    sections = app.split_markdown_sections(
        dedent(
            """
        Intro paragraph

        ## Policy
        Employees must keep records.

        ## Exceptions
        Exceptions require approval.
        """
        )
    )

    assert [section["title"] for section in sections] == ["Document overview", "Policy", "Exceptions"]
    assert "Employees must keep records" in str(sections[1]["content"])


def test_retrieve_sections_scores_matching_titles() -> None:
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    app.migrate(connection)
    user = app.create_user(connection, "user@example.com", "User", "Password123!")
    cursor = connection.execute(
        "INSERT INTO documents (user_id, name, path, section_count, created_at) VALUES (?, ?, ?, ?, ?)",
        (user.id, "handbook.md", "/tmp/handbook.md", 2, app.utc_now()),
    )
    document_id = cursor.lastrowid
    connection.executemany(
        "INSERT INTO sections (document_id, title, content, page, ordinal, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (document_id, "Leave Policy", "Annual leave requires manager approval.", None, 0, app.utc_now()),
            (document_id, "Security", "Passwords must be rotated.", None, 1, app.utc_now()),
        ],
    )
    connection.commit()

    matches = app.retrieve_sections(connection, user, "How does leave approval work?")

    assert matches
    assert matches[0].title == "Leave Policy"
    assert matches[0].document_name == "handbook.md"
