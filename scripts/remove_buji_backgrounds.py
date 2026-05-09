#!/usr/bin/env python3
"""
Buji GIF Background Removal Script
Removes black backgrounds from GIF files and makes them transparent.
"""

import os
import sys
from PIL import Image, ImageSequence
import argparse

def remove_black_background(gif_path, output_path=None, threshold=30):
    """
    Remove black background from a GIF file and make it transparent.
    
    Args:
        gif_path: Path to input GIF
        output_path: Path for output (if None, overwrites original)
        threshold: RGB threshold for considering a pixel "black" (0-255)
    """
    if output_path is None:
        output_path = gif_path
    
    print(f"Processing: {gif_path}")
    
    try:
        # Open the GIF
        with Image.open(gif_path) as img:
            frames = []
            durations = []
            
            # Process each frame
            for i, frame in enumerate(ImageSequence.Iterator(img)):
                print(f"  Processing frame {i+1}/{img.n_frames}", end='\r')
                
                # Convert to RGBA if not already
                if frame.mode != 'RGBA':
                    frame = frame.convert('RGBA')
                
                # Get image data
                data = frame.getdata()
                new_data = []
                
                # Process each pixel
                for pixel in data:
                    r, g, b = pixel[:3]
                    alpha = pixel[3] if len(pixel) == 4 else 255
                    
                    # Check if pixel is close to black
                    if r <= threshold and g <= threshold and b <= threshold:
                        # Make transparent
                        new_data.append((r, g, b, 0))
                    else:
                        # Keep original
                        new_data.append((r, g, b, alpha))
                
                # Create new frame with updated data
                new_frame = Image.new('RGBA', frame.size)
                new_frame.putdata(new_data)
                frames.append(new_frame)
                
                # Get frame duration
                try:
                    duration = frame.info.get('duration', 100)
                    durations.append(duration)
                except:
                    durations.append(100)
            
            print(f"\n  Saving {len(frames)} frames to: {output_path}")
            
            # Save the processed GIF
            frames[0].save(
                output_path,
                save_all=True,
                append_images=frames[1:],
                duration=durations,
                loop=0,  # Infinite loop
                transparency=0,
                disposal=2  # Clear frame before next
            )
            
            print(f"✓ Successfully processed: {gif_path}")
            
    except Exception as e:
        print(f"✗ Error processing {gif_path}: {str(e)}")
        return False
    
    return True

def main():
    parser = argparse.ArgumentParser(description='Remove black backgrounds from Buji GIF files')
    parser.add_argument('--directory', '-d', default='/Users/pydart/Projects/stibe/stibe-portal/public/buji',
                       help='Directory containing GIF files')
    parser.add_argument('--threshold', '-t', type=int, default=30,
                       help='RGB threshold for black detection (0-255)')
    parser.add_argument('--backup', '-b', action='store_true',
                       help='Create backup files (.original.gif) before processing')
    parser.add_argument('--files', '-f', nargs='+',
                       help='Specific files to process (otherwise processes all needed files)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.directory):
        print(f"Error: Directory not found: {args.directory}")
        sys.exit(1)
    
    # Get list of GIF files to process
    if args.files:
        gif_files = [f for f in args.files if f.endswith('.gif')]
    else:
        # Find GIFs that likely need processing
        all_files = os.listdir(args.directory)
        gif_files = []
        
        for filename in all_files:
            if filename.endswith('.gif') and not filename.endswith('.original.gif'):
                # Check if this file needs processing by looking for certain patterns
                # or if it doesn't have a corresponding .original file
                original_name = filename.replace('.gif', '.original.gif')
                
                # Files that definitely need processing (no .original version exists)
                needs_processing = [
                    '3 second resting.gif',
                    '5 second upside doown animation.gif',
                    '6 second reading and running.gif',
                    '6 second running loading screen.gif',
                    '8 second reading.gif',
                    '10 second loading.gif'
                ]
                
                if filename in needs_processing or original_name not in all_files:
                    gif_files.append(filename)
    
    if not gif_files:
        print("No GIF files found to process!")
        return
    
    print(f"Found {len(gif_files)} GIF files to process in: {args.directory}")
    print(f"Files: {', '.join(gif_files)}")
    
    # Process each file
    success_count = 0
    total_count = len(gif_files)
    
    for filename in gif_files:
        gif_path = os.path.join(args.directory, filename)
        
        if not os.path.exists(gif_path):
            print(f"Warning: File not found: {gif_path}")
            continue
        
        # Create backup if requested
        if args.backup:
            backup_name = filename.replace('.gif', '.original.gif')
            backup_path = os.path.join(args.directory, backup_name)
            if not os.path.exists(backup_path):
                import shutil
                shutil.copy2(gif_path, backup_path)
                print(f"Created backup: {backup_name}")
        
        # Process the file
        if remove_black_background(gif_path, threshold=args.threshold):
            success_count += 1
    
    print(f"\nProcessing complete!")
    print(f"Successfully processed: {success_count}/{total_count} files")
    
    if success_count < total_count:
        print(f"Failed: {total_count - success_count} files")
        sys.exit(1)

if __name__ == '__main__':
    main()