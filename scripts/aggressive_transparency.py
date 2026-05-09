#!/usr/bin/env python3
"""
Aggressive background removal - makes ALL dark pixels transparent
"""

import os
from PIL import Image, ImageSequence
import numpy as np

def aggressive_background_removal(gif_path, threshold=50):
    """
    Very aggressive background removal - makes any dark pixel transparent
    """
    print(f"Processing with aggressive transparency: {gif_path}")
    
    try:
        with Image.open(gif_path) as img:
            frames = []
            durations = []
            
            for i, frame in enumerate(ImageSequence.Iterator(img)):
                print(f"  Frame {i+1}/{img.n_frames}", end='\r')
                
                # Convert to RGBA
                if frame.mode != 'RGBA':
                    frame = frame.convert('RGBA')
                
                # Convert to numpy for faster processing
                data = np.array(frame)
                
                # Create mask for dark pixels (more aggressive)
                dark_mask = (
                    (data[:,:,0] <= threshold) & 
                    (data[:,:,1] <= threshold) & 
                    (data[:,:,2] <= threshold)
                )
                
                # Also catch pixels close to black/gray
                gray_mask = (
                    (np.abs(data[:,:,0] - data[:,:,1]) < 20) & 
                    (np.abs(data[:,:,1] - data[:,:,2]) < 20) & 
                    (data[:,:,0] < threshold + 20)
                )
                
                # Combine masks
                transparent_mask = dark_mask | gray_mask
                
                # Make selected pixels transparent
                data[:,:,3][transparent_mask] = 0
                
                # Convert back to PIL
                new_frame = Image.fromarray(data, 'RGBA')
                frames.append(new_frame)
                
                # Get duration
                duration = frame.info.get('duration', 100)
                durations.append(duration)
            
            print(f"\n  Saving {len(frames)} frames with aggressive transparency...")
            
            # Save processed GIF
            temp_path = gif_path.replace('.gif', '_temp.gif')
            frames[0].save(
                temp_path,
                save_all=True,
                append_images=frames[1:],
                duration=durations,
                loop=0,
                transparency=0,
                disposal=2,
                optimize=False  # Preserve quality
            )
            
            # Replace original
            os.replace(temp_path, gif_path)
            print(f"✓ Aggressively processed: {gif_path}")
            return True
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def process_all_buji_gifs():
    """Process all Buji GIFs with aggressive transparency"""
    buji_dir = "/Users/pydart/Projects/stibe/stibe-portal/public/buji"
    
    gif_files = [
        "8 second reading.gif",
        "3 second resting.gif", 
        "4 second thinking.gif",
        "1 second loading celebration.gif",
        "6 second reading and running.gif",
        "10 second loading.gif",
        "6 second running loading screen.gif",
        "5 second upside doown animation.gif"
    ]
    
    for filename in gif_files:
        gif_path = os.path.join(buji_dir, filename)
        if os.path.exists(gif_path):
            print(f"\n=== Processing {filename} ===")
            aggressive_background_removal(gif_path, threshold=60)
        else:
            print(f"Not found: {filename}")

if __name__ == '__main__':
    process_all_buji_gifs()
    print("\n🎯 All Buji GIFs processed with aggressive transparency!")