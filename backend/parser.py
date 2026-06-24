import os
import zipfile
import xml.sax
from datetime import datetime
from database import get_db_connection, DB_NAME

class ForensicReportHandler(xml.sax.ContentHandler):
    def __init__(self, case_id: str, db_path: str):
        super().__init__()
        self.case_id = case_id
        self.db_path = db_path
        self.current_tag = ""
        self.current_data = {}
        self.device_info = {}
        
        # Batch insert accumulators
        self.contacts = []
        self.calls = []
        self.messages = []
        self.geolocations = []
        
        self.conn = get_db_connection(self.db_path)
        self.cursor = self.conn.cursor()

        # Track parser state
        self.in_device = False
        self.in_contact = False
        self.in_call = False
        self.in_message = False
        self.in_location = False
        
        self.chars_accumulator = []

    def startElement(self, tag, attrs):
        self.current_tag = tag
        self.chars_accumulator = []
        
        if tag == "report":
            # Extract case details from root attributes if available
            case_id_attr = attrs.get("case_id", self.case_id)
            inv_name = attrs.get("investigator", "Unknown Officer")
            case_date = attrs.get("date", datetime.now().strftime("%Y-%m-%d"))
            description = attrs.get("description", "Imported UFDR Case")
            
            # Use SELECT and UPDATE/INSERT to prevent ON DELETE CASCADE trigger in REPLACE
            self.cursor.execute("SELECT 1 FROM cases WHERE case_id = ?", (case_id_attr,))
            if self.cursor.fetchone():
                self.cursor.execute(
                    "UPDATE cases SET investigator_name = ?, case_date = ?, description = ? WHERE case_id = ?",
                    (inv_name, case_date, description, case_id_attr)
                )
            else:
                self.cursor.execute(
                    "INSERT INTO cases (case_id, investigator_name, case_date, description) VALUES (?, ?, ?, ?)",
                    (case_id_attr, inv_name, case_date, description)
                )
            self.case_id = case_id_attr
            
        elif tag == "device":
            self.in_device = True
            self.current_data = {}
        elif tag == "contact":
            self.in_contact = True
            self.current_data = {}
        elif tag == "call":
            self.in_call = True
            self.current_data = {}
        elif tag == "message":
            self.in_message = True
            self.current_data = {}
        elif tag == "location":
            self.in_location = True
            self.current_data = {}

    def characters(self, content):
        self.chars_accumulator.append(content)

    def endElement(self, tag):
        content = "".join(self.chars_accumulator).strip()
        
        if self.in_device:
            if tag == "device":
                self.in_device = False
                # Insert device info
                self.cursor.execute(
                    "INSERT OR REPLACE INTO device_info (case_id, model, imei, os_type, extraction_type) VALUES (?, ?, ?, ?, ?)",
                    (
                        self.case_id,
                        self.device_info.get("model", "Unknown"),
                        self.device_info.get("imei", "Unknown"),
                        self.device_info.get("os_type", "Unknown"),
                        self.device_info.get("extraction_type", "Unknown")
                    )
                )
            else:
                self.device_info[tag] = content
                
        elif self.in_contact:
            if tag == "contact":
                self.in_contact = False
                self.contacts.append((
                    self.case_id,
                    self.current_data.get("name", "Unknown"),
                    self.current_data.get("phone", ""),
                    self.current_data.get("email", ""),
                    self.current_data.get("details", "")
                ))
            else:
                self.current_data[tag] = content
                
        elif self.in_call:
            if tag == "call":
                self.in_call = False
                # Look up contact ID based on phone or name if needed, else None
                # We'll link contacts in post-processing or keep contact_id NULL initially
                self.calls.append((
                    self.case_id,
                    None, # contact_id will be mapped later
                    self.current_data.get("phone", ""),
                    self.current_data.get("name", "Unknown"),
                    self.current_data.get("direction", "Unknown"),
                    int(self.current_data.get("duration_seconds", 0)),
                    self.current_data.get("timestamp", "")
                ))
            else:
                self.current_data[tag] = content
                
        elif self.in_message:
            if tag == "message":
                self.in_message = False
                
                # Check for indicators to auto-flag
                body = self.current_data.get("body", "")
                is_flagged = 0
                flag_reason = ""
                
                # Cryto address flagging (simple heuristic)
                import re
                btc_pattern = r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b|\bbc1[ac-hj-np-z0-9]{11,71}\b'
                eth_pattern = r'\b0x[a-fA-F0-9]{40}\b'
                
                if re.search(btc_pattern, body):
                    is_flagged = 1
                    flag_reason = "Contains Bitcoin address"
                elif re.search(eth_pattern, body):
                    is_flagged = 1
                    flag_reason = "Contains Ethereum address"
                elif any(word in body.lower() for word in ["crypto", "wallet", "seed phrase", "monero", "usdt"]):
                    is_flagged = 1
                    flag_reason = "Contains cryptocurrency keyword"
                elif any(word in body.lower() for word in ["payment", "transfer", "bank", "wired", "western union"]):
                    is_flagged = 1
                    flag_reason = "Contains financial transaction keyword"
                elif "+44" not in self.current_data.get("sender_phone", "") and not self.current_data.get("sender_phone", "").startswith("0") and len(self.current_data.get("sender_phone", "")) > 5:
                    # Simple heuristic: foreign number if not starting with domestic +44 or 0 (assuming UK local context or let it be foreign)
                    # Let's check for specific foreign codes if not starting with +91 (India) or +1 (US) depending on case context
                    # Let's tag any phone starting with other country codes (e.g. +7, +86, +971) as foreign
                    phone = self.current_data.get("sender_phone", "")
                    if phone.startswith("+") and not phone.startswith("+1") and not phone.startswith("+91"):
                        is_flagged = 1
                        flag_reason = f"Communication with foreign number ({phone[:4]})"

                self.messages.append((
                    self.case_id,
                    self.current_data.get("chat_id", "default_chat"),
                    self.current_data.get("sender_phone", ""),
                    self.current_data.get("sender_name", ""),
                    self.current_data.get("receiver_phone", ""),
                    self.current_data.get("timestamp", ""),
                    body,
                    self.current_data.get("attachment", ""),
                    is_flagged,
                    flag_reason
                ))
            else:
                self.current_data[tag] = content
                
        elif self.in_location:
            if tag == "location":
                self.in_location = False
                lat = float(self.current_data.get("latitude", 0.0))
                lng = float(self.current_data.get("longitude", 0.0))
                self.geolocations.append((
                    self.case_id,
                    self.current_data.get("timestamp", ""),
                    lat,
                    lng,
                    self.current_data.get("description", "")
                ))
            else:
                self.current_data[tag] = content

    def endDocument(self):
        # Insert contacts
        if self.contacts:
            self.cursor.executemany(
                "INSERT INTO contacts (case_id, name, phone, email, details) VALUES (?, ?, ?, ?, ?)",
                self.contacts
            )
        # Insert calls
        if self.calls:
            self.cursor.executemany(
                "INSERT INTO calls (case_id, contact_id, phone, name, direction, duration_seconds, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                self.calls
            )
        # Insert messages
        if self.messages:
            self.cursor.executemany(
                "INSERT INTO messages (case_id, chat_id, sender_phone, sender_name, receiver_phone, timestamp, body, attachment_path, is_flagged, flag_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                self.messages
            )
        # Insert geolocations
        if self.geolocations:
            self.cursor.executemany(
                "INSERT INTO geolocations (case_id, timestamp, latitude, longitude, description) VALUES (?, ?, ?, ?, ?)",
                self.geolocations
            )
            
        # Post-processing: Map contacts in calls and messages
        self.cursor.execute("""
            UPDATE calls
            SET contact_id = (
                SELECT contact_id 
                FROM contacts 
                WHERE contacts.case_id = calls.case_id 
                  AND (contacts.phone = calls.phone OR contacts.name = calls.name)
                LIMIT 1
            )
            WHERE contact_id IS NULL;
        """)
        
        self.conn.commit()
        self.conn.close()

def parse_ufdr(zip_path: str, case_id: str, db_path: str = DB_NAME, extract_dir: str = "extracted_files"):
    """
    Unzips UFDR, finds report.xml, stream-parses it, and commits content to SQLite.
    """
    os.makedirs(extract_dir, exist_ok=True)
    xml_path = None
    
    # Pre-create case stub to satisfy Foreign Key constraints for extracted files
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR IGNORE INTO cases (case_id, investigator_name, case_date, description) VALUES (?, ?, date('now'), ?)",
        (case_id, "Unknown Officer", "Imported UFDR Case")
    )
    conn.commit()
    conn.close()
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # Check all files in ZIP
        file_list = zip_ref.namelist()
        
        # Look for report.xml or any XML file in root
        xml_files = [f for f in file_list if f.endswith('.xml')]
        
        # Prefer report.xml if present
        report_xml = [f for f in xml_files if os.path.basename(f).lower() == 'report.xml']
        
        if report_xml:
            target_xml = report_xml[0]
        elif xml_files:
            target_xml = xml_files[0]
        else:
            raise FileNotFoundError("No XML report file found inside the UFDR archive.")
            
        # Extract target XML and media attachments
        zip_ref.extract(target_xml, extract_dir)
        xml_path = os.path.join(extract_dir, target_xml)
        
        # Extract other files like files/ or images/ if present
        media_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.pdf', '.txt')
        for f in file_list:
            if f.endswith(media_extensions):
                zip_ref.extract(f, extract_dir)
                
                # Write file metadata into files table
                # Get file size
                info = zip_ref.getinfo(f)
                filename = os.path.basename(f)
                conn = get_db_connection(db_path)
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO files (case_id, filename, relative_path, file_size, file_type) VALUES (?, ?, ?, ?, ?)",
                    (case_id, filename, os.path.join(extract_dir, f), info.file_size, filename.split('.')[-1].upper())
                )
                conn.commit()
                conn.close()
                
    # Run SAX Parser
    parser = xml.sax.make_parser()
    handler = ForensicReportHandler(case_id, db_path)
    parser.setContentHandler(handler)
    parser.parse(xml_path)
    
    # Clean up XML file if desired, keeping extraction assets
    return handler.case_id
