import sqlite3
import os

DB_NAME = "forensic_cases.db"

def get_db_connection(db_path: str = DB_NAME):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path: str = DB_NAME):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # Cases Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cases (
        case_id TEXT PRIMARY KEY,
        investigator_name TEXT NOT NULL,
        case_date TEXT NOT NULL,
        description TEXT
    );
    """)

    # Device Info Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS device_info (
        case_id TEXT PRIMARY KEY,
        model TEXT,
        imei TEXT,
        os_type TEXT,
        extraction_type TEXT,
        parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    );
    """)

    # Contacts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        email TEXT,
        details TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    );
    """)

    # Call Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS calls (
        call_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        contact_id INTEGER,
        phone TEXT,
        name TEXT,
        direction TEXT, -- Incoming, Outgoing, Missed, Rejected
        duration_seconds INTEGER,
        timestamp TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL
    );
    """)

    # Messages/Chats Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        message_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        chat_id TEXT, -- Groups messages into threads
        sender_phone TEXT,
        sender_name TEXT,
        receiver_phone TEXT,
        timestamp TEXT,
        body TEXT,
        attachment_path TEXT,
        is_flagged INTEGER DEFAULT 0, -- Boolean (0/1)
        flag_reason TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    );
    """)

    # Geolocation Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS geolocations (
        geo_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        timestamp TEXT,
        latitude REAL,
        longitude REAL,
        description TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    );
    """)

    # Files metadata
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS files (
        file_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        filename TEXT,
        relative_path TEXT,
        file_size INTEGER,
        file_type TEXT,
        md5_hash TEXT,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    );
    """)

    # --- FTS5 Virtual Table for Full-Text Search ---
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        message_id UNINDEXED,
        body,
        sender_name,
        sender_phone,
        receiver_phone
    );
    """)

    # Create Triggers to sync messages to messages_fts
    cursor.execute("DROP TRIGGER IF EXISTS messages_ai;")
    cursor.execute("""
    CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(message_id, body, sender_name, sender_phone, receiver_phone)
        VALUES (new.message_id, new.body, new.sender_name, new.sender_phone, new.receiver_phone);
    END;
    """)

    cursor.execute("DROP TRIGGER IF EXISTS messages_ad;")
    cursor.execute("""
    CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE message_id = old.message_id;
    END;
    """)

    cursor.execute("DROP TRIGGER IF EXISTS messages_au;")
    cursor.execute("""
    CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
        DELETE FROM messages_fts WHERE message_id = old.message_id;
        INSERT INTO messages_fts(message_id, body, sender_name, sender_phone, receiver_phone)
        VALUES (new.message_id, new.body, new.sender_name, new.sender_phone, new.receiver_phone);
    END;
    """)

    # Create indexes for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_case_id ON messages(case_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_calls_case_id ON calls(case_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contacts_case_id ON contacts(case_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_geolocations_case_id ON geolocations(case_id);")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
