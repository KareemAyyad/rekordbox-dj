import requests
import time
import os
import json

BASE_URL = "https://dropcrate-web-cx2h.onrender.com"

# 1. Create a 5s test audio file
os.system('ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -y /tmp/seg_test.wav 2>/dev/null')

# 2. Upload it
print("Uploading...")
with open('/tmp/seg_test.wav', 'rb') as f:
    resp = requests.post(f"{BASE_URL}/api/segment/upload", files={'file': f})
    
upload_data = resp.json()
print("Upload response:", upload_data)
session_id = upload_data.get('session_id')

if not session_id:
    print("Failed to get session ID")
    exit(1)

# 3. Trigger auto
print("Triggering auto-segment...")
auto_resp = requests.post(
    f"{BASE_URL}/api/segment/auto",
    json={"session_id": session_id, "categories": ["Vocals", "Drums", "Bass", "Other"]}
)
auto_data = auto_resp.json()
print("Auto response:", auto_data)
job_id = auto_data.get('job_id')

if not job_id:
    print("Failed to get job ID")
    exit(1)

# 4. Read SSE stream
print(f"Monitoring SSE for job {job_id}...")
with requests.get(f"{BASE_URL}/api/segment/events?job_id={job_id}", stream=True) as r:
    for line in r.iter_lines():
        if line:
            print(line.decode('utf-8'))

print("Done!")
