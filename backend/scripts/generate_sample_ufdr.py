"""Generate a minimal sample UFDR for local testing."""

import zipfile
from pathlib import Path

SAMPLE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<project>
  <deviceName>Samsung Galaxy S21</deviceName>
  <manufacturer>Samsung</manufacturer>
  <model>SM-G991B</model>
  <decodedData>
    <instantMessage>
      <source>WhatsApp</source>
      <from>+919876543210</from>
      <to>+447700900123</to>
      <timestamp>2025-11-15T22:30:00Z</timestamp>
      <body>Send the payment to bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh when ready</body>
    </instantMessage>
    <instantMessage>
      <source>WhatsApp</source>
      <from>+919876543210</from>
      <to>+447700900123</to>
      <timestamp>2025-11-16T01:15:00Z</timestamp>
      <body>Meeting confirmed. Check https://example.com/details</body>
    </instantMessage>
    <instantMessage>
      <source>Telegram</source>
      <from>user_alpha</from>
      <timestamp>2025-11-17T18:00:00Z</timestamp>
      <body>Transfer 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb to my wallet</body>
    </instantMessage>
    <sms>
      <from>+919111222333</from>
      <timestamp>2025-11-14T09:00:00Z</timestamp>
      <body>Your OTP is 482910. Do not share.</body>
    </sms>
    <call direction="outgoing">
      <from>+919876543210</from>
      <to>+447700900123</to>
      <duration>245</duration>
      <timestamp>2025-11-15T21:00:00Z</timestamp>
    </call>
    <call direction="incoming">
      <from>+14155552671</from>
      <to>+919876543210</to>
      <duration>32</duration>
      <timestamp>2025-11-16T14:22:00Z</timestamp>
    </call>
    <contact>
      <name>John Doe</name>
      <phone>+447700900123</phone>
      <email>john.doe@example.com</email>
    </contact>
    <location>
      <latitude>28.6139</latitude>
      <longitude>77.2090</longitude>
      <timestamp>2025-11-15T20:00:00Z</timestamp>
    </location>
  </decodedData>
  <taggedFiles>
    <file path="files/Image/image001.jpg" name="image001.jpg" type="image/jpeg" size="102400"/>
  </taggedFiles>
</project>
"""


def main():
    out = Path(__file__).resolve().parents[2] / "samples" / "sample_device.ufdr"
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("report.xml", SAMPLE_XML)
    print(f"Created {out}")


if __name__ == "__main__":
    main()
