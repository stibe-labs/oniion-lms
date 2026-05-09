#!/usr/bin/env python3
"""Convert Buji GIFs to optimized APNGs with full alpha transparency"""

from PIL import Image, ImageSequence
import os

buji_dir = '/Users/pydart/Projects/stibe/stibe-portal/public/buji'

gifs = {
    '8 second reading.gif': ('8 second reading.png', 200),
    '3 second resting.gif': ('3 second resting.png', 200),
    '4 second thinking.gif': ('4 second thinking.png', 150),
    '1 second loading celebration.gif': ('1 second loading celebration.png', 150),
}

for gif_name, (png_name, target_size) in gifs.items():
    gif_path = os.path.join(buji_dir, gif_name)
    png_path = os.path.join(buji_dir, png_name)
    
    print(f'\n=== {gif_name} -> {png_name} ({target_size}px) ===')
    
    with Image.open(gif_path) as img:
        frames = []
        durations = []
        
        for i, frame in enumerate(ImageSequence.Iterator(img)):
            print(f'  Frame {i+1}/{img.n_frames}', end='\r')
            rgba = frame.convert('RGBA')
            rgba.thumbnail((target_size, target_size), Image.LANCZOS)
            frames.append(rgba)
            durations.append(frame.info.get('duration', 100))
        
        print(f'\n  Saving {len(frames)} frames as APNG ({frames[0].size})...')
        frames[0].save(
            png_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            disposal=2
        )
        
        size_kb = os.path.getsize(png_path) / 1024
        print(f'  Done: {size_kb:.0f} KB')

# Remove any leftover large APNG
large_png = os.path.join(buji_dir, '8 second reading.png')
if os.path.exists(large_png) and os.path.getsize(large_png) > 10_000_000:
    os.remove(large_png)
    print('\nRemoved oversized APNG, will be regenerated.')

print('\nAll APNG conversions complete!')
