import os
import shutil
import sqlite3
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import init_db, get_db_connection, DB_NAME
from parser import parse_ufdr
from mock_generator import create_mock_ufdr
import agent

app = FastAPI(title="UFDR AI Forensic Analysis Tool API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev simplicity, allow Vite server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup_db():
    init_db(DB_NAME)
    # Generate mock case if it doesn't exist so user starts with data
    if not os.path.exists("sample_case.ufdr"):
        create_mock_ufdr("sample_case.ufdr")

# Models
class QueryRequest(BaseModel):
    query: str
    case_id: str
    categories: Optional[List[str]] = ["messages", "calls", "contacts"]

class AIChatRequest(BaseModel):
    query: str
    case_id: str

@app.post("/api/upload")
async def upload_ufdr(
    file: UploadFile = File(...),
    investigator: str = Form("Officer"),
    description: str = Form("Forensic Device Upload")
):
    case_id = f"CASE-{datetime_str()}"
    temp_zip_path = f"temp_{file.filename}"
    
    try:
        # Save zip temporarily
        with open(temp_zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Initialize case in SQLite
        conn = get_db_connection(DB_NAME)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO cases (case_id, investigator_name, case_date, description) VALUES (?, ?, date('now'), ?)",
            (case_id, investigator, description)
        )
        conn.commit()
        conn.close()
        
        # Parse UFDR
        actual_case_id = parse_ufdr(temp_zip_path, case_id, DB_NAME)
        
        return {
            "success": True,
            "case_id": actual_case_id,
            "message": "UFDR report parsed and indexed successfully."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse UFDR: {str(e)}")
    finally:
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)

@app.post("/api/cases/generate-mock")
def generate_mock():
    try:
        create_mock_ufdr("sample_case.ufdr")
        case_id = parse_ufdr("sample_case.ufdr", "CASE-2026-99A", DB_NAME)
        return {"success": True, "case_id": case_id, "message": "Mock case loaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cases")
def list_cases():
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.case_id, c.investigator_name, c.case_date, c.description,
               d.model, d.os_type,
               (SELECT COUNT(*) FROM messages m WHERE m.case_id = c.case_id) as message_count,
               (SELECT COUNT(*) FROM calls cl WHERE cl.case_id = c.case_id) as call_count,
               (SELECT COUNT(*) FROM contacts co WHERE co.case_id = c.case_id) as contact_count,
               (SELECT COUNT(*) FROM messages m WHERE m.case_id = c.case_id AND m.is_flagged = 1) as flagged_count
        FROM cases c
        LEFT JOIN device_info d ON c.case_id = d.case_id;
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/cases/{case_id}/dashboard")
def get_dashboard_stats(case_id: str):
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    
    # Device details
    cursor.execute("SELECT * FROM device_info WHERE case_id = ?", (case_id,))
    device_row = cursor.fetchone()
    device = dict(device_row) if device_row else {}
    
    # Message stats (total, flagged, timeline)
    cursor.execute("SELECT COUNT(*) as total, SUM(is_flagged) as flagged FROM messages WHERE case_id = ?", (case_id,))
    m_row = cursor.fetchone()
    total_messages = m_row['total'] or 0
    flagged_messages = m_row['flagged'] or 0
    
    # Call stats
    cursor.execute("SELECT COUNT(*) as total FROM calls WHERE case_id = ?", (case_id,))
    total_calls = cursor.fetchone()['total'] or 0
    
    # Contact stats
    cursor.execute("SELECT COUNT(*) as total FROM contacts WHERE case_id = ?", (case_id,))
    total_contacts = cursor.fetchone()['total'] or 0
    
    # Get call direction split
    cursor.execute("SELECT direction, COUNT(*) as count FROM calls WHERE case_id = ? GROUP BY direction", (case_id,))
    calls_split = {r['direction']: r['count'] for r in cursor.fetchall()}
    
    # Get geolocation count
    cursor.execute("SELECT COUNT(*) as total FROM geolocations WHERE case_id = ?", (case_id,))
    total_geos = cursor.fetchone()['total'] or 0
    
    # Get recent flagged messages
    cursor.execute("""
        SELECT sender_name, sender_phone, body, flag_reason, timestamp 
        FROM messages 
        WHERE case_id = ? AND is_flagged = 1 
        ORDER BY timestamp DESC 
        LIMIT 5
    """, (case_id,))
    recent_flagged = [dict(r) for r in cursor.fetchall()]
    
    # Get call logs stats over time (for charts)
    cursor.execute("""
        SELECT substr(timestamp, 1, 10) as date, COUNT(*) as count 
        FROM messages 
        WHERE case_id = ? AND timestamp != ''
        GROUP BY date 
        ORDER BY date ASC 
        LIMIT 15
    """, (case_id,))
    msg_chart_data = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    
    return {
        "device": device,
        "stats": {
            "messages": total_messages,
            "calls": total_calls,
            "contacts": total_contacts,
            "geolocations": total_geos,
            "flagged": flagged_messages
        },
        "calls_split": calls_split,
        "recent_flagged": recent_flagged,
        "msg_chart_data": msg_chart_data
    }

@app.post("/api/query")
def run_query(req: QueryRequest, api_key: Optional[str] = Header(None)):
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    
    results = {
        "explanation": "Standard keyword search query execution.",
        "messages": [],
        "calls": [],
        "contacts": [],
        "sql_executed": None
    }
    
    # 1. Try Gemini Text-to-SQL
    sql_data = agent.translate_nl_to_sql(req.query, req.case_id, api_key)
    sql_query = sql_data.get("sql_query")
    explanation = sql_data.get("query_explanation")
    
    if sql_query:
        try:
            # Bind the case_id to the query safely if placeholder ? is used
            # We count occurrences of ? in query to bind case_id appropriately
            # Usually, agent instructions specify filtering by case_id = ?
            placeholders_count = sql_query.count("?")
            params = [req.case_id] * placeholders_count
            
            cursor.execute(sql_query, params)
            rows = cursor.fetchall()
            
            # Map results back based on SQL query return shape
            mapped_rows = [dict(r) for r in rows]
            results["sql_executed"] = sql_query
            results["explanation"] = explanation
            
            # Heuristic to place mapped results in appropriate buckets
            if "messages" in sql_query.lower() or (mapped_rows and "body" in mapped_rows[0]):
                results["messages"] = mapped_rows
            elif "calls" in sql_query.lower() or (mapped_rows and "direction" in mapped_rows[0]):
                results["calls"] = mapped_rows
            elif "contacts" in sql_query.lower() or (mapped_rows and "email" in mapped_rows[0]):
                results["contacts"] = mapped_rows
            else:
                # Default bucket
                results["messages"] = mapped_rows
                
            conn.close()
            return results
        except Exception as db_err:
            # If generated SQL failed due to syntax/schema issues, fallback to keyword search
            results["explanation"] = f"Text-to-SQL failed (syntax: {str(db_err)}). Falling back to keyword search."
    
    # 2. Fallback / Standard Keyword Search using FTS5
    # Split query into words, find matches in body/name
    search_term = req.query.strip()
    
    if search_term:
        # Search messages
        try:
            cursor.execute("""
                SELECT * FROM messages 
                WHERE case_id = ? AND message_id IN (
                    SELECT message_id FROM messages_fts WHERE messages_fts MATCH ?
                )
                ORDER BY timestamp DESC
                LIMIT 50;
            """, (req.case_id, search_term))
            results["messages"] = [dict(r) for r in cursor.fetchall()]
        except Exception:
            # Fallback to simple LIKE
            cursor.execute("""
                SELECT * FROM messages 
                WHERE case_id = ? AND (body LIKE ? OR sender_name LIKE ?)
                ORDER BY timestamp DESC
                LIMIT 50;
            """, (req.case_id, f"%{search_term}%", f"%{search_term}%"))
            results["messages"] = [dict(r) for r in cursor.fetchall()]
            
        # Search Calls
        cursor.execute("""
            SELECT * FROM calls 
            WHERE case_id = ? AND (phone LIKE ? OR name LIKE ?) 
            ORDER BY timestamp DESC 
            LIMIT 20
        """, (req.case_id, f"%{search_term}%", f"%{search_term}%"))
        results["calls"] = [dict(r) for r in cursor.fetchall()]
        
        # Search Contacts
        cursor.execute("""
            SELECT * FROM contacts 
            WHERE case_id = ? AND (name LIKE ? OR phone LIKE ? OR details LIKE ?) 
            LIMIT 20
        """, (req.case_id, f"%{search_term}%", f"%{search_term}%", f"%{search_term}%"))
        results["contacts"] = [dict(r) for r in cursor.fetchall()]
        
    conn.close()
    return results

@app.post("/api/ai-chat")
def chat_with_data(req: AIChatRequest, api_key: Optional[str] = Header(None)):
    answer = agent.analyze_with_rag(req.query, req.case_id, DB_NAME, api_key)
    return {"response": answer}

@app.get("/api/cases/{case_id}/messages")
def get_messages(case_id: str, chat_id: Optional[str] = None):
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    if chat_id:
        cursor.execute("SELECT * FROM messages WHERE case_id = ? AND chat_id = ? ORDER BY timestamp ASC", (case_id, chat_id))
    else:
        cursor.execute("SELECT * FROM messages WHERE case_id = ? ORDER BY timestamp ASC LIMIT 200", (case_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/cases/{case_id}/chats")
def get_chat_threads(case_id: str):
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    # Returns group chat_ids with participant names and last message
    cursor.execute("""
        SELECT chat_id, 
               MAX(timestamp) as last_msg_time,
               sender_name, sender_phone,
               (SELECT body FROM messages m2 WHERE m2.case_id = messages.case_id AND m2.chat_id = messages.chat_id ORDER BY timestamp DESC LIMIT 1) as last_body
        FROM messages 
        WHERE case_id = ?
        GROUP BY chat_id
        ORDER BY last_msg_time DESC;
    """, (case_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/cases/{case_id}/network")
def get_network_graph(case_id: str):
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    
    # Find device owner number (from device_info, or most outgoing sender as fallback)
    cursor.execute("SELECT sender_phone, COUNT(*) as count FROM messages WHERE case_id = ? GROUP BY sender_phone ORDER BY count DESC LIMIT 1", (case_id,))
    owner_row = cursor.fetchone()
    owner_phone = owner_row['sender_phone'] if owner_row else "Device Owner"
    
    # Fetch all messaging nodes
    cursor.execute("""
        SELECT sender_phone as phone, sender_name as name, COUNT(*) as msg_count 
        FROM messages 
        WHERE case_id = ? AND sender_phone != '' 
        GROUP BY sender_phone
    """, (case_id,))
    senders = {r['phone']: r['name'] or r['phone'] for r in cursor.fetchall()}
    
    cursor.execute("""
        SELECT receiver_phone as phone, COUNT(*) as msg_count 
        FROM messages 
        WHERE case_id = ? AND receiver_phone != '' 
        GROUP BY receiver_phone
    """, (case_id,))
    receivers = {r['phone']: r['phone'] for r in cursor.fetchall()}
    
    # Merge contacts mapping names
    cursor.execute("SELECT name, phone FROM contacts WHERE case_id = ?", (case_id,))
    contacts_map = {r['phone']: r['name'] for r in cursor.fetchall()}
    
    all_phones = set(list(senders.keys()) + list(receivers.keys()))
    
    nodes = []
    # Add owner
    nodes.append({"id": owner_phone, "label": "Device Owner", "type": "owner", "size": 25})
    
    for phone in all_phones:
        if phone == owner_phone or not phone:
            continue
        label = contacts_map.get(phone) or senders.get(phone) or phone
        # Check if flagged
        cursor.execute("SELECT COUNT(*) as flagged_count FROM messages WHERE case_id = ? AND (sender_phone = ? OR receiver_phone = ?) AND is_flagged = 1", (case_id, phone, phone))
        flagged_count = cursor.fetchone()['flagged_count']
        
        nodes.append({
            "id": phone,
            "label": label,
            "phone": phone,
            "type": "suspect" if flagged_count > 0 else "standard",
            "size": 15
        })
        
    # Build links based on message exchanges
    cursor.execute("""
        SELECT sender_phone, receiver_phone, COUNT(*) as weight 
        FROM messages 
        WHERE case_id = ? AND sender_phone != '' AND receiver_phone != '' 
        GROUP BY sender_phone, receiver_phone
    """, (case_id,))
    raw_links = cursor.fetchall()
    
    links = []
    seen_links = set()
    for l in raw_links:
        p1, p2, w = l['sender_phone'], l['receiver_phone'], l['weight']
        pair = tuple(sorted([p1, p2]))
        if pair in seen_links:
            # find index and add weight
            for link in links:
                if link['source'] == pair[0] and link['target'] == pair[1]:
                    link['weight'] += w
                    break
        else:
            seen_links.add(pair)
            links.append({
                "source": pair[0],
                "target": pair[1],
                "weight": w
            })
            
    conn.close()
    return {"nodes": nodes, "links": links}

@app.get("/api/cases/{case_id}/geolocations")
def get_geolocations(case_id: str):
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM geolocations WHERE case_id = ? ORDER BY timestamp ASC", (case_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/cases/{case_id}/report/pdf")
def generate_pdf_report(case_id: str):
    from fpdf import FPDF
    
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    
    # Fetch case details
    cursor.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,))
    case = cursor.fetchone()
    
    # Fetch device details
    cursor.execute("SELECT * FROM device_info WHERE case_id = ?", (case_id,))
    device = cursor.fetchone()
    
    # Fetch flagged messages
    cursor.execute("SELECT sender_name, sender_phone, receiver_phone, timestamp, body, flag_reason FROM messages WHERE case_id = ? AND is_flagged = 1 ORDER BY timestamp ASC", (case_id,))
    flagged_msgs = cursor.fetchall()
    
    # Fetch calls summary
    cursor.execute("SELECT name, phone, direction, COUNT(*) as count, SUM(duration_seconds) as total_duration FROM calls WHERE case_id = ? GROUP BY phone, direction ORDER BY count DESC LIMIT 10", (case_id,))
    calls_summary = cursor.fetchall()
    
    conn.close()
    
    class PDFReport(FPDF):
        def header(self):
            self.set_font("Helvetica", "B", 12)
            self.cell(0, 10, "OFFICIAL DIGITAL FORENSIC EXTRACTION REPORT", border=False, new_x="LMARGIN", new_y="NEXT", align="C")
            self.set_draw_color(0, 0, 0)
            self.line(10, 20, 200, 20)
            self.ln(10)
            
        def footer(self):
            self.set_y(-15)
            self.set_font("Helvetica", "I", 8)
            self.cell(0, 10, f"Page {self.page_no()} | Restricted Forensic Document", align="C")

    pdf = PDFReport()
    pdf.add_page()
    pdf.set_font("Helvetica", size=10)
    
    # Header block
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, f"Case ID: {case['case_id'] if case else case_id}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    pdf.cell(0, 6, f"Investigator: {case['investigator_name'] if case else 'Unknown'}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Date Compiled: {case['case_date'] if case else 'Unknown'}", new_x="LMARGIN", new_y="NEXT")
    if case and case['description']:
        pdf.multi_cell(0, 6, f"Description: {case['description']}")
    pdf.ln(5)
    
    # Device details
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Target Device Hardware Profile", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    if device:
        pdf.cell(0, 6, f"Model: {device['model']}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"OS: {device['os_type']}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"IMEI: {device['imei']}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Extraction Source: {device['extraction_type']}", new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.cell(0, 6, "No device profile found.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Flagged Communications
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Suspicious Communications Auto-Flagged by AI Agent", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    
    if flagged_msgs:
        for m in flagged_msgs:
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 5, f"[{m['timestamp']}] From: {m['sender_name']} ({m['sender_phone']}) -> To: {m['receiver_phone']}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "I", 9)
            pdf.cell(0, 5, f"AI Flag Reason: {m['flag_reason']}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", size=9)
            pdf.multi_cell(0, 5, f"Body: {m['body']}")
            pdf.ln(3)
    else:
        pdf.cell(0, 6, "No high-priority suspicious flagged activities identified.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Call Summary list
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Call Frequency Analytics (Top Contacts)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    
    if calls_summary:
        for c in calls_summary:
            pdf.cell(0, 6, f"Contact: {c['name']} ({c['phone']}) - Direction: {c['direction']} | Count: {c['count']} calls (Total {c['total_duration']} seconds)", new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.cell(0, 6, "No calls logged in this extraction.", new_x="LMARGIN", new_y="NEXT")
        
    pdf_filename = f"report_{case_id}.pdf"
    pdf.output(pdf_filename)
    
    return FileResponse(pdf_filename, media_type="application/pdf", filename=pdf_filename)

def datetime_str():
    from datetime import datetime
    return datetime.now().strftime("%Y%m%d_%H%M%S")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
