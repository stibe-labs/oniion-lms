#!/usr/bin/env python3
"""
Ultra-aggressive background removal for specific file
"""

import os
from PIL import Image, ImageSequence
import numpy as np

def ultra_aggressive_transparency(gif_path):
    """
    Ultra-aggressive - make EVERYTHING except Buji character transparent
    """
    print(f"Ultra-aggressive processing: {gif_path}")
    
    try:
        with Image.open(gif_path) as img:
            frames = []
            durations = []
            
            for i, frame in enumerate(ImageSequence.Iterator(img)):
                print(f"  Frame {i+1}/{img.n_frames}", end='\r')
                
                if frame.mode != 'RGBA':
                    frame = frame.convert('RGBA')
                
                data = np.array(frame)
                
                # Define Buji character colors (typically skin tones, bright colors)
                # Keep pixels that are:
                # - Bright/colorful (likely Buji character)
                # - Have significant color saturation
                # - Are not dark/black/gray
                
                r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
                
                # Calculate brightness and saturation
                brightness = (r.astype(np.float32) + g + b) / 3
                max_rgb = np.maximum(np.maximum(r, g), b)
                min_rgb = np.minimum(np.minimum(r, g), b)
                saturation = np.where(max_rgb > 0, (max_rgb - min_rgb) / max_rgb * 255, 0)
                
                # Keep pixels that are:
                keep_mask = (
                    (brightness > 80) |  # Bright pixels
                    (saturation > 30) |  # Colorful pixels  
                    (
                        (r > 120) | (g > 120) | (b > 120)  # Any bright color channel
                    )
                ) & (a > 0)  # Already opaque pixels
                
                # Make everything else transparent
                data[:,:,3] = np.where(keep_mask, 255, 0)
                
                new_frame = Image.fromarray(data.astype(np.uint8), 'RGBA')
                frames.append(new_frame)
                durations.append(frame.info.get('duration', 100))
            
            print(f"\n  Saving with ultra transparency...")
            
            temp_path = gif_path.replace('.gif', '_ultra.gif')
            frames[0].save(
                temp_path,
                save_all=True,
                append_images=frames[1:],
                duration=durations,
                loop=0,
                transparency=0,
                disposal=2
            )
            
            os.replace(temp_path, gif_path)
            print(f"✓ Ultra-processed: {gif_path}")
            return True
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == '__main__':
    gif_path = "/Users/pydart/Projects/stibe/stibe-portal/public/buji/8 second reading.gif"
    ultra_aggressive_transparency(gif_path)
    print("\n🎯 Ultra-transparency complete!")