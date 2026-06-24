import os
import zipfile
import xml.etree.ElementTree as ET

def create_mock_ufdr(zip_name: str = "sample_case.ufdr"):
    # Ensure directories
    os.makedirs("temp_mock", exist_ok=True)
    
    # 1. Write the XML content
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
<report case_id="CASE-2026-99A" investigator="Officer Alex R." date="2026-06-24" description="Seized device from target location">
    <device>
        <model>iPhone 14 Pro</model>
        <imei>358201129384756</imei>
        <os_type>iOS 17.2.1</os_type>
        <extraction_type>Full Filesystem Extraction</extraction_type>
    </device>
    <contacts>
        <contact>
            <name>Dmitry Crypto</name>
            <phone>+79119223344</phone>
            <email>dmitry@crypto-broker.ru</email>
            <details>Suspected OTC broker</details>
        </contact>
        <contact>
            <name>Sarah Cooper</name>
            <phone>+15550199222</phone>
            <email>scooper@securemail.com</email>
            <details>Business partner</details>
        </contact>
        <contact>
            <name>Local Contact</name>
            <phone>+919876543210</phone>
            <email>local@india.in</email>
            <details>Ground courier</details>
        </contact>
        <contact>
            <name>Unknown Swiss</name>
            <phone>+41225180189</phone>
            <email>swiss_vault@swissmail.ch</email>
            <details>Escrow manager</details>
        </contact>
    </contacts>
    <calls>
        <call>
            <phone>+79119223344</phone>
            <name>Dmitry Crypto</name>
            <direction>Incoming</direction>
            <duration_seconds>245</duration_seconds>
            <timestamp>2026-06-15T09:12:00Z</timestamp>
        </call>
        <call>
            <phone>+41225180189</phone>
            <name>Unknown Swiss</name>
            <direction>Outgoing</direction>
            <duration_seconds>89</duration_seconds>
            <timestamp>2026-06-16T14:30:15Z</timestamp>
        </call>
        <call>
            <phone>+919876543210</phone>
            <name>Local Contact</name>
            <direction>Incoming</direction>
            <duration_seconds>0</duration_seconds>
            <timestamp>2026-06-18T18:05:00Z</timestamp>
        </call>
    </calls>
    <messages>
        <message>
            <chat_id>chat_dmitry</chat_id>
            <sender_phone>+79119223344</sender_phone>
            <sender_name>Dmitry Crypto</sender_name>
            <receiver_phone>+919876543210</receiver_phone>
            <timestamp>2026-06-15T09:15:00Z</timestamp>
            <body>Welcome. Let me know when you are ready to receive the BTC. The price is locked.</body>
            <attachment></attachment>
        </message>
        <message>
            <chat_id>chat_dmitry</chat_id>
            <sender_phone>+919876543210</sender_phone>
            <sender_name>Local Contact</sender_name>
            <receiver_phone>+79119223344</receiver_phone>
            <timestamp>2026-06-15T09:16:30Z</timestamp>
            <body>Ready. Send the coins to BTC address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa.</body>
            <attachment></attachment>
        </message>
        <message>
            <chat_id>chat_dmitry</chat_id>
            <sender_phone>+79119223344</sender_phone>
            <sender_name>Dmitry Crypto</sender_name>
            <receiver_phone>+919876543210</receiver_phone>
            <timestamp>2026-06-15T09:20:00Z</timestamp>
            <body>Sent. Transaction hash: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F. Verify block explorer.</body>
            <attachment></attachment>
        </message>
        <message>
            <chat_id>chat_sarah</chat_id>
            <sender_phone>+15550199222</sender_phone>
            <sender_name>Sarah Cooper</sender_name>
            <receiver_phone>+919876543210</receiver_phone>
            <timestamp>2026-06-17T11:00:00Z</timestamp>
            <body>Meeting in London is set at 14:00 at the default coordinate. Bring the documents.</body>
            <attachment>documents_scan.pdf</attachment>
        </message>
        <message>
            <chat_id>chat_sarah</chat_id>
            <sender_phone>+919876543210</sender_phone>
            <sender_name>Local Contact</sender_name>
            <receiver_phone>+15550199222</receiver_phone>
            <timestamp>2026-06-17T11:05:00Z</timestamp>
            <body>Sure, got them. This message will be deleted later. Please download the attachment.</body>
            <attachment></attachment>
        </message>
        <message>
            <chat_id>chat_swiss</chat_id>
            <sender_phone>+41225180189</sender_phone>
            <sender_name>Unknown Swiss</sender_name>
            <receiver_phone>+919876543210</receiver_phone>
            <timestamp>2026-06-18T10:00:00Z</timestamp>
            <body>Your escrow account vault is active. Wire details sent. Use Monero for privacy.</body>
            <attachment></attachment>
        </message>
    </messages>
    <geolocations>
        <location>
            <timestamp>2026-06-17T14:00:00Z</timestamp>
            <latitude>51.5074</latitude>
            <longitude>-0.1278</longitude>
            <description>London Meeting Spot (Westminster)</description>
        </location>
        <location>
            <timestamp>2026-06-18T16:45:00Z</timestamp>
            <latitude>47.3769</latitude>
            <longitude>8.5417</longitude>
            <description>Zurich Financial District</description>
        </location>
    </geolocations>
</report>
"""
    xml_file_path = "temp_mock/report.xml"
    with open(xml_file_path, "w", encoding="utf-8") as f:
        f.write(xml_content)
        
    # 2. Write dummy files
    pdf_path = "temp_mock/documents_scan.pdf"
    with open(pdf_path, "w") as f:
        f.write("%PDF-1.4 mock forensic attachment data")
        
    # 3. Zip them up
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(xml_file_path, "report.xml")
        zipf.write(pdf_path, "documents_scan.pdf")
        
    # Clean up temp files
    os.remove(xml_file_path)
    os.remove(pdf_path)
    os.rmdir("temp_mock")
    
    print(f"Mock UFDR report '{zip_name}' created successfully.")

if __name__ == "__main__":
    create_mock_ufdr()
