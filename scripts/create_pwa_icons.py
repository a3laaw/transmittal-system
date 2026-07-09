"""
Generate PWA icons (192x192 and 512x512) for the Transmittal Management System.
Creates a simple icon with a document emoji on emerald background.
"""
from PIL import Image, ImageDraw, ImageFont
import os

ICON_DIR = '/home/z/my-project/public/icons'
os.makedirs(ICON_DIR, exist_ok=True)

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background: emerald gradient effect (solid for simplicity)
    margin = int(size * 0.05)
    radius = int(size * 0.22)
    
    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=(5, 150, 105, 255)  # emerald-600
    )
    
    # Draw a document icon (white)
    doc_w = int(size * 0.35)
    doc_h = int(size * 0.45)
    doc_x = (size - doc_w) // 2
    doc_y = (size - doc_h) // 2
    
    # Document body
    draw.rounded_rectangle(
        [doc_x, doc_y, doc_x + doc_w, doc_y + doc_h],
        radius=int(size * 0.03),
        fill=(255, 255, 255, 255)
    )
    
    # Document fold (top-right corner)
    fold_size = int(size * 0.08)
    draw.polygon(
        [(doc_x + doc_w - fold_size, doc_y),
         (doc_x + doc_w, doc_y),
         (doc_x + doc_w, doc_y + fold_size)],
        fill=(200, 200, 200, 255)
    )
    
    # Lines on document (representing text)
    line_color = (100, 100, 100, 255)
    line_margin = int(size * 0.04)
    line_height = int(size * 0.025)
    line_spacing = int(size * 0.06)
    
    for i in range(3):
        y = doc_y + int(size * 0.1) + i * line_spacing
        x1 = doc_x + line_margin
        x2 = doc_x + doc_w - line_margin - (fold_size if i == 0 else 0)
        draw.rounded_rectangle(
            [x1, y, x2, y + line_height],
            radius=line_height // 2,
            fill=line_color
        )
    
    img.save(os.path.join(ICON_DIR, filename))
    print(f'✅ Created {filename} ({size}x{size})')

create_icon(192, 'icon-192.png')
create_icon(512, 'icon-512.png')

# Also create a favicon
create_icon(32, 'favicon-32.png')
create_icon(16, 'favicon-16.png')

print('\nAll icons created in /public/icons/')
