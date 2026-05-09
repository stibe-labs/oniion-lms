#!/usr/bin/env python3
from PIL import Image, ImageSequence
import os

buji_dir = '/Users/pydart/Projects/stibe/stibe-portal/public/buji'
extra_gifs = {
    '1 second running wink.gif': ('1 second running wink.png', 200),
    '2 second running.gif': ('2 second running.png', 200),
    '5 second fly.gif': ('5 second fly.png', 200),
    '5 second upside doown animation.gif': ('5 second upside doown animation.png', 200),
    '6 second reading and running.gif': ('6 second reading and running.png', 200),
}

for gif_name, (png_name, target_size) in extra_gifs.items():
    gif_path = os.path.join(buji_dir, gif_name)
    png_path = os.path.join(buji_dir, png_name)
    if os.path.exists(png_path):
        print(f'Skipping {png_name} (exists)')
        continue
    print(f'{gif_name} -> {png_name}...')
    with Image.open(gif_path) as img:
        frames = []
        durations = []
        for i, frame in enumerate(ImageSequence.Iterator(img)):
            rgba = frame.convert('RGBA')
            rgba.thumbnail((target_size, target_size), Image.LANCZOS)
            frames.append(rgba)
            durations.append(frame.info.get('duration', 100))
        frames[0].save(png_path, save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=2)
        size_kb = os.path.getsize(png_path) / 1024
        print(f'  {len(frames)} frames, {size_kb:.0f} KB')

print('Done!')
