#!/bin/bash
set -e
TID=$(curl -s --max-time 30 "http://localhost:3000/api/transmittals?limit=1" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.items[0].id)})")
echo "TID: $TID"

# Create a real PNG using Python
/home/z/.venv/bin/python3 -c "
import struct, zlib
def make_png():
    w, h = 4, 4
    raw = b''
    for _ in range(h):
        raw += b'\x00' + b'\xff\x00\x00' * w
    png = b'\x89PNG\r\n\x1a\n'
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw))
    png += chunk(b'IEND', b'')
    return png
with open('/tmp/red.png', 'wb') as f:
    f.write(make_png())
print('PNG created')
"

echo "--- Upload ---"
UPLOAD_RES=$(curl -s --max-time 30 -X POST "http://localhost:3000/api/transmittals/$TID/upload" -F "file=@/tmp/red.png;type=image/png")
echo "$UPLOAD_RES"

FPATH=$(echo "$UPLOAD_RES" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.attachment.filePath)})")
echo "filePath: $FPATH"

echo "--- Fetch via /api/files/ ---"
curl -s -i --max-time 10 "http://localhost:3000$FPATH" | head -10

echo ""
echo "--- Storage on disk ---"
ls -la /home/z/my-project/storage/uploads/$TID/ 2>&1

echo ""
echo "--- List attachments ---"
curl -s --max-time 10 "http://localhost:3000/api/transmittals/$TID/attachments" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);j.items.forEach(i=>console.log(JSON.stringify(i)))})"
