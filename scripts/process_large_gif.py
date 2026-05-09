#!/usr/bin/env python3
"""
Memory-efficient version for processing large GIF files
"""

import os
from PIL import Image, ImageSequence
import sys

def process_large_gif(gif_path, threshold=30):
    """Process a large GIF with memory optimization"""
    print(f"Processing large GIF: {gif_path}")
    
    try:
        # Create temporary working file
        temp_path = gif_path.replace('.gif', '_processed.gif')
        
        with Image.open(gif_path) as img:
            print(f"  Total frames: {img.n_frames}")
            
            # Process in smaller batches to save memory
            batch_size = 10  # Process 10 frames at a time
            all_frames = []
            all_durations = []
            
            for i in range(0, img.n_frames, batch_size):
                end_frame = min(i + batch_size, img.n_frames)
                print(f"  Processing batch {i+1}-{end_frame}/{img.n_frames}", end='\r')
                
                batch_frames = []
                batch_durations = []
                
                # Process this batch of frames
                img.seek(i)
                for j in range(i, end_frame):
                    try:
                        img.seek(j)
                        frame = img.copy()
                        
                        # Convert to RGBA
                        if frame.mode != 'RGBA':
                            frame = frame.convert('RGBA')
                        
                        # Get image data and process pixels
                        data = list(frame.getdata())
                        new_data = []
                        
                        for pixel in data:
                            r, g, b = pixel[:3]
                            alpha = pixel[3] if len(pixel) == 4 else 255
                            
                            # Check if pixel is close to black
                            if r <= threshold and g <= threshold and b <= threshold:
                                new_data.append((r, g, b, 0))  # Make transparent
                            else:
                                new_data.append((r, g, b, alpha))  # Keep original
                        
                        # Create processed frame
                        new_frame = Image.new('RGBA', frame.size)
                        new_frame.putdata(new_data)
                        batch_frames.append(new_frame)
                        
                        # Get duration
                        duration = frame.info.get('duration', 100)
                        batch_durations.append(duration)
                        
                    except Exception as e:
                        print(f"\nError on frame {j}: {e}")
                        continue
                
                # Add this batch to the total
                all_frames.extend(batch_frames)
                all_durations.extend(batch_durations)
                
                # Clear batch to free memory
                batch_frames.clear()
                batch_durations.clear()
            
            print(f"\n  Saving {len(all_frames)} processed frames...")
            
            # Save the result
            if all_frames:
                all_frames[0].save(
                    temp_path,
                    save_all=True,
                    append_images=all_frames[1:],
                    duration=all_durations,
                    loop=0,
                    transparency=0,
                    disposal=2
                )
                
                # Replace original with processed version
                os.replace(temp_path, gif_path)
                print(f"✓ Successfully processed: {gif_path}")
                return True
            else:
                print("✗ No frames were processed successfully")
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return False
                
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == '__main__':
    gif_file = "/Users/pydart/Projects/stibe/stibe-portal/public/buji/10 second loading.gif"
    
    # Create backup first
    backup_file = gif_file.replace('.gif', '.original.gif')
    if not os.path.exists(backup_file):
        import shutil
        shutil.copy2(gif_file, backup_file)
        print(f"Created backup: {os.path.basename(backup_file)}")
    
    success = process_large_gif(gif_file)
    print(f"\nResult: {'Success' if success else 'Failed'}")