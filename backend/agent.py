import os
import json
import sqlite3
from google import genai
from google.genai import types
from database import get_db_connection

def get_client(api_key: str = None):
    # Try parameter first, then environment variable
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    try:
        return genai.Client(api_key=key)
    except Exception:
        return None

# Database Schema context for Text-to-SQL
DB_SCHEMA = """
Table: cases
Columns: case_id (TEXT PRIMARY KEY), investigator_name (TEXT), case_date (TEXT), description (TEXT)

Table: device_info
Columns: case_id (TEXT PRIMARY KEY, foreign key to cases), model (TEXT), imei (TEXT), os_type (TEXT), extraction_type (TEXT)

Table: contacts
Columns: contact_id (INTEGER PRIMARY KEY), case_id (TEXT), name (TEXT), phone (TEXT), email (TEXT), details (TEXT)

Table: calls
Columns: call_id (INTEGER PRIMARY KEY), case_id (TEXT), contact_id (INTEGER), phone (TEXT), name (TEXT), direction (TEXT), duration_seconds (INTEGER), timestamp (TEXT)

Table: messages
Columns: message_id (INTEGER PRIMARY KEY), case_id (TEXT), chat_id (TEXT), sender_phone (TEXT), sender_name (TEXT), receiver_phone (TEXT), timestamp (TEXT), body (TEXT), attachment_path (TEXT), is_flagged (INTEGER), flag_reason (TEXT)

Table: geolocations
Columns: geo_id (INTEGER PRIMARY KEY), case_id (TEXT), timestamp (TEXT), latitude (REAL), longitude (REAL), description (TEXT)

Table: files
Columns: file_id (INTEGER PRIMARY KEY), case_id (TEXT), filename (TEXT), relative_path (TEXT), file_size (INTEGER), file_type (TEXT)

Full-Text Search Table: messages_fts
Columns: message_id (UNINDEXED), body, sender_name, sender_phone, receiver_phone
Use messages_fts for keyword matching on message body.
Example: SELECT * FROM messages WHERE message_id IN (SELECT message_id FROM messages_fts WHERE messages_fts MATCH 'keyword')
"""

SQL_SYSTEM_INSTRUCTION = f"""
You are a Digital Forensic Assistant. Your job is to translate a natural language query from an Investigating Officer into a valid SQLite SQL query.
Use the following SQLite Schema:
{DB_SCHEMA}

RULES:
1. ONLY return a JSON object with two fields:
   - "query_explanation": A short, clear description of what details you are searching for.
   - "sql_query": The executable SQLite query.
2. The SQLite database uses CASE-SENSITIVE checks sometimes, so use LIKE '%term%' or FTS5 MATCH for robust searches on body text.
3. Ensure the query filters by `case_id = ?` (use a placeholder `?` so we can bind the current case ID programmatically in python).
4. NEVER return markdown blocks, backticks, or any text other than the JSON object.
5. If the query cannot be answered by SQL, set "sql_query" to null.
"""

def translate_nl_to_sql(nl_query: str, case_id: str, api_key: str = None) -> dict:
    client = get_client(api_key)
    if not client:
        return {
            "query_explanation": "Gemini API Client not configured. Running standard keyword search fallback.",
            "sql_query": None
        }

    prompt = f"Investigator Query: \"{nl_query}\" for case_id: \"{case_id}\". Generate the JSON."
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SQL_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        return {
            "query_explanation": f"Error communicating with Gemini: {str(e)}",
            "sql_query": None
        }

def analyze_with_rag(query: str, case_id: str, db_path: str, api_key: str = None) -> str:
    client = get_client(api_key)
    if not client:
        return "AI analysis unavailable. Please check your Gemini API key in Settings."

    # 1. Fetch some context from DB to inject
    # We will search for messages, calls and geolocations that match keyword subsets of the query
    # E.g. Split query into words, filter out stopwords, look them up
    keywords = [w.strip("?,.!") for w in query.split() if len(w) > 3]
    context_items = []
    
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    # Try keywords FTS search
    if keywords:
        fts_query = " OR ".join(keywords)
        try:
            cursor.execute(f"""
                SELECT sender_name, sender_phone, receiver_phone, timestamp, body 
                FROM messages 
                WHERE case_id = ? AND message_id IN (
                    SELECT message_id FROM messages_fts WHERE messages_fts MATCH ?
                )
                ORDER BY timestamp DESC
                LIMIT 30;
            """, (case_id, fts_query))
            rows = cursor.fetchall()
            for r in rows:
                context_items.append(f"Message from {r['sender_name']} ({r['sender_phone']}) to {r['receiver_phone']} at {r['timestamp']}: {r['body']}")
        except Exception:
            pass
            
        # Get matching calls
        try:
            call_conditions = " OR ".join(["name LIKE ?" or "phone LIKE ?" for _ in keywords])
            params = []
            for kw in keywords:
                params.extend([f"%{kw}%", f"%{kw}%"])
            cursor.execute(f"""
                SELECT name, phone, direction, timestamp, duration_seconds 
                FROM calls 
                WHERE case_id = ? AND ({' OR '.join(['name LIKE ? OR phone LIKE ?' for _ in keywords])})
                LIMIT 10
            """, [case_id] + params)
            rows = cursor.fetchall()
            for r in rows:
                context_items.append(f"Call with {r['name']} ({r['phone']}) - Direction: {r['direction']} at {r['timestamp']}, Duration: {r['duration_seconds']}s")
        except Exception:
            pass
            
    # Default fallback: fetch latest 30 messages if context is empty
    if not context_items:
        cursor.execute("SELECT sender_name, body, timestamp FROM messages WHERE case_id = ? ORDER BY timestamp DESC LIMIT 30", (case_id,))
        rows = cursor.fetchall()
        for r in rows:
            context_items.append(f"[{r['timestamp']}] {r['sender_name']}: {r['body']}")
            
    conn.close()
    
    context_str = "\n".join(context_items)
    
    system_instruction = """
    You are an expert Digital Forensics Analyst. Analyze the provided extraction snippets and answer the investigator's query.
    Rules:
    1. Base your answer strictly on the provided context. If the context doesn't contain the answer, state that.
    2. Format the response with markdown (bullet points, bold text).
    3. Call out flagged activities, security issues, timeline details, or contradictions if you spot them.
    4. Maintain an objective, professional forensic tone.
    """
    
    prompt = f"""
    Investigator Query: {query}
    
    Forensic Context Snippets:
    {context_str}
    
    Please provide your analysis.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2
            )
        )
        return response.text
    except Exception as e:
        return f"Error executing AI analysis: {str(e)}"
