import os
from database import init_db, get_db_connection, DB_NAME
from mock_generator import create_mock_ufdr
from parser import parse_ufdr

def run_test():
    print("=== STARTING BACKEND INTEGRATION TEST ===")
    
    # 1. Clear existing database for clean test
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
        print("Cleared existing SQLite database file.")
        
    if os.path.exists("extracted_files"):
        import shutil
        shutil.rmtree("extracted_files")
        print("Cleared extracted files directory.")
        
    # 2. Init DB
    init_db(DB_NAME)
    print("Initialized schema.")
    
    # 3. Create mock UFDR
    mock_zip = "sample_case.ufdr"
    create_mock_ufdr(mock_zip)
    
    # 4. Parse UFDR
    case_id = "CASE-2026-99A"
    parsed_case_id = parse_ufdr(mock_zip, case_id, DB_NAME)
    print(f"Finished parsing UFDR. Parsed case ID: {parsed_case_id}")
    
    # 5. Verify database records
    conn = get_db_connection(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM cases")
    cases_cnt = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM device_info")
    device_cnt = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM contacts")
    contacts_cnt = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM calls")
    calls_cnt = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages")
    messages_cnt = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM geolocations")
    geolocations_cnt = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM files")
    files_cnt = cursor.fetchone()[0]
    
    # Check FTS index
    cursor.execute("SELECT COUNT(*) FROM messages_fts")
    fts_cnt = cursor.fetchone()[0]
    
    # Check flagged count
    cursor.execute("SELECT COUNT(*) FROM messages WHERE is_flagged = 1")
    flagged_cnt = cursor.fetchone()[0]
    
    print("\n--- DATABASE COUNTS ---")
    print(f"Cases: {cases_cnt} (Expected: 1)")
    print(f"Device Profiles: {device_cnt} (Expected: 1)")
    print(f"Contacts: {contacts_cnt} (Expected: 4)")
    print(f"Calls Logged: {calls_cnt} (Expected: 3)")
    print(f"Messages Logged: {messages_cnt} (Expected: 6)")
    print(f"Geolocations Logged: {geolocations_cnt} (Expected: 2)")
    print(f"Attachments Handled: {files_cnt} (Expected: 1)")
    print(f"FTS Search Index Entries: {fts_cnt} (Expected: 6)")
    print(f"Auto-Flagged Suspect Messages: {flagged_cnt} (Expected: > 0)")
    
    # Assertions
    assert cases_cnt == 1, "Failed case creation test"
    assert device_cnt == 1, "Failed device profile extraction test"
    assert contacts_cnt == 4, "Failed contacts parsing test"
    assert calls_cnt == 3, "Failed calls parsing test"
    assert messages_cnt == 6, "Failed messages parsing test"
    assert geolocations_cnt == 2, "Failed geolocations parsing test"
    assert files_cnt == 1, "Failed attachment file metadata indexing test"
    assert fts_cnt == 6, "Failed FTS trigger synchronization test"
    assert flagged_cnt > 0, "Failed auto-flagging pipeline test"
    
    # Check specific flagged content
    cursor.execute("SELECT body, flag_reason FROM messages WHERE is_flagged = 1 LIMIT 1")
    flagged_msg = cursor.fetchone()
    print(f"Sample flagged message body: \"{flagged_msg['body']}\"")
    print(f"Reason for flag: \"{flagged_msg['flag_reason']}\"")
    
    conn.close()
    print("\n=== INTEGRATION TEST PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_test()
