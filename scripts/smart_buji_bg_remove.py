#!/usr/bin/env python3
"""
Smart Buji Background Removal — Character-First Approach
=========================================================
Uses a two-strategy approach based on whether the original has a black background:

**For GIFs with black backgrounds:**
  Character-first detection — find the colored character body, dilate it to
  protect nearby dark features (outlines, eyebrows, eye borders, shoe details),
  then only remove dark pixels that are OUTSIDE the protection zone.

**For GIFs already transparent:**
  Simple edge flood-fill (previous approach) — these files have no background
  leakage problem since the character dark features aren't connected to a
  solid black background.

Usage:
    python3 scripts/smart_buji_bg_remove.py                     # Process all GIFs
    python3 scripts/smart_buji_bg_remove.py --png               # Also regenerate PNGs
    python3 scripts/smart_buji_bg_remove.py --threshold 20      # Stricter dark detection
"""

import os
import sys
import argparse
import numpy as np
from PIL import Image, ImageSequence
from collections import deque
from scipy import ndimage


def has_black_background(rgba_array, dark_threshold=25):
    """Detect whether a frame has a solid black background (>30% dark opaque pixels)."""
    r, g, b, a = rgba_array[:,:,0], rgba_array[:,:,1], rgba_array[:,:,2], rgba_array[:,:,3]
    dark_opaque = (r <= dark_threshold) & (g <= dark_threshold) & (b <= dark_threshold) & (a > 0)
    total = rgba_array.shape[0] * rgba_array.shape[1]
    dark_pct = np.sum(dark_opaque) / total
    return dark_pct > 0.30


def character_mask_background(rgba_array, dark_threshold=25, dilate_radius=25, min_cluster_size=50):
    """
    Character-first background detection for images with black backgrounds.
    
    Strategy:
    1. Find all non-dark opaque pixels (these are definitely character pixels)
    2. Remove tiny noise clusters (< min_cluster_size pixels) that aren't part of character
    3. Dilate that mask by dilate_radius pixels to create a "protection zone"
       that encompasses outlines, eyebrows, eye borders, etc.
    4. Any dark pixel OUTSIDE the protection zone = background → make transparent
    5. Any dark pixel INSIDE the protection zone = character feature → preserve
    
    Returns a boolean mask where True = background pixel to make transparent.
    """
    h, w = rgba_array.shape[:2]
    r, g, b, a = rgba_array[:,:,0], rgba_array[:,:,1], rgba_array[:,:,2], rgba_array[:,:,3]
    
    # Step 1: Find colored (non-dark) opaque pixels = definite character body
    is_dark = (r <= dark_threshold) & (g <= dark_threshold) & (b <= dark_threshold)
    is_opaque = a > 0
    character_seed = is_opaque & ~is_dark  # colored pixels = character body
    
    # Step 1.5: Remove tiny noise clusters
    labeled, n_features = ndimage.label(character_seed)
    if n_features > 1:
        sizes = ndimage.sum(character_seed, labeled, range(1, n_features + 1))
        # Keep only clusters >= min_cluster_size
        for label_idx in range(n_features):
            if sizes[label_idx] < min_cluster_size:
                character_seed[labeled == (label_idx + 1)] = False
    
    # Step 2: Dilate the character body to create protection zone
    # This protects dark features near the character (outlines, eyebrows, etc.)
    struct = ndimage.generate_binary_structure(2, 2)  # 8-connectivity
    protection_zone = ndimage.binary_dilation(character_seed, struct, iterations=dilate_radius)
    
    # Step 3: Background = dark AND outside protection zone
    bg_mask = is_dark & is_opaque & ~protection_zone
    
    return bg_mask


def flood_fill_background(rgba_array, dark_threshold=25):
    """
    Find background pixels via edge-connected flood fill.
    For already-transparent GIFs where dark features aren't connected to bg.
    
    Returns a boolean mask where True = background pixel to make transparent.
    """
    h, w = rgba_array.shape[:2]
    r, g, b = rgba_array[:,:,0], rgba_array[:,:,1], rgba_array[:,:,2]
    is_dark = (r <= dark_threshold) & (g <= dark_threshold) & (b <= dark_threshold)
    
    bg_mask = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    
    queue = deque()
    for x in range(w):
        for y in [0, h - 1]:
            if is_dark[y, x] and not visited[y, x]:
                visited[y, x] = True
                bg_mask[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in [0, w - 1]:
            if is_dark[y, x] and not visited[y, x]:
                visited[y, x] = True
                bg_mask[y, x] = True
                queue.append((y, x))
    
    while queue:
        cy, cx = queue.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_dark[ny, nx]:
                    visited[ny, nx] = True
                    bg_mask[ny, nx] = True
                    queue.append((ny, nx))
    
    return bg_mask


def process_gif(input_path, output_path, dark_threshold=25, dilate_radius=25):
    """Process a GIF: remove background while preserving character features."""
    print(f"Processing: {os.path.basename(input_path)}")
    
    with Image.open(input_path) as img:
        n_frames = getattr(img, 'n_frames', 1)
        frames = []
        durations = []
        
        # Check first frame to determine strategy
        first_frame = img.convert('RGBA')
        first_arr = np.array(first_frame)
        black_bg = has_black_background(first_arr, dark_threshold)
        strategy = "character-mask" if black_bg else "flood-fill"
        print(f"  Strategy: {strategy} (black_bg={black_bg})")
        
        img.seek(0)  # reset
        
        for i, frame in enumerate(ImageSequence.Iterator(img)):
            if i % 20 == 0:
                print(f"  Frame {i+1}/{n_frames}...")
            
            rgba = frame.convert('RGBA')
            arr = np.array(rgba)
            
            if black_bg:
                # Character-first: dilate colored body to protect dark features
                bg_mask = character_mask_background(arr, dark_threshold, dilate_radius)
            else:
                # Edge flood-fill for already-transparent GIFs
                bg_mask = flood_fill_background(arr, dark_threshold)
                
                # Feather pass for flood-fill mode
                h, w = arr.shape[:2]
                feather_threshold = dark_threshold // 2
                r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
                is_very_dark = (r <= feather_threshold) & (g <= feather_threshold) & (b <= feather_threshold)
                
                border_mask = np.zeros((h, w), dtype=bool)
                border_mask[1:, :] |= bg_mask[:-1, :]
                border_mask[:-1, :] |= bg_mask[1:, :]
                border_mask[:, 1:] |= bg_mask[:, :-1]
                border_mask[:, :-1] |= bg_mask[:, 1:]
                
                feather = is_very_dark & border_mask & ~bg_mask
                bg_mask = bg_mask | feather
            
            # Apply transparency
            arr[bg_mask, 3] = 0
            
            new_frame = Image.fromarray(arr, 'RGBA')
            frames.append(new_frame)
            
            try:
                durations.append(frame.info.get('duration', 100))
            except:
                durations.append(100)
        
        # Stats
        last_arr = np.array(frames[-1])
        total_px = last_arr.shape[0] * last_arr.shape[1]
        transparent_px = np.sum(last_arr[:,:,3] == 0)
        dark_kept = np.sum(
            (last_arr[:,:,0] <= dark_threshold) & 
            (last_arr[:,:,1] <= dark_threshold) & 
            (last_arr[:,:,2] <= dark_threshold) & 
            (last_arr[:,:,3] > 0)
        )
        print(f"  Result: {transparent_px/total_px*100:.1f}% transparent, {dark_kept} dark pixels preserved (features)")
        
        print(f"  Saving {len(frames)} frames...")
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            transparency=0,
            disposal=2,
        )
        print(f"  OK: {output_path}")
    
    return True


def gif_to_apng(gif_path, png_path, max_size=200):
    """Convert processed GIF to small APNG for web use."""
    print(f"  → APNG: {os.path.basename(png_path)}")
    
    with Image.open(gif_path) as img:
        n_frames = getattr(img, 'n_frames', 1)
        frames = []
        durations = []
        
        for frame in ImageSequence.Iterator(img):
            rgba = frame.convert('RGBA')
            # Resize to max_size while preserving aspect ratio
            w, h = rgba.size
            if w > h:
                new_w = max_size
                new_h = int(h * max_size / w)
            else:
                new_h = max_size
                new_w = int(w * max_size / h)
            resized = rgba.resize((new_w, new_h), Image.LANCZOS)
            frames.append(resized)
            try:
                durations.append(frame.info.get('duration', 100))
            except:
                durations.append(100)
        
        frames[0].save(
            png_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            format='PNG',
        )
        print(f"  OK: {png_path} ({frames[0].size[0]}x{frames[0].size[1]}, {n_frames} frames)")


def main():
    parser = argparse.ArgumentParser(description='Smart Buji background removal (flood-fill from edges)')
    parser.add_argument('--originals', default='/tmp/buji_originals',
                       help='Directory with original GIF files')
    parser.add_argument('--output', default='/Users/pydart/Projects/stibe/stibe-portal/public/buji',
                       help='Output directory')
    parser.add_argument('--threshold', '-t', type=int, default=25,
                       help='Dark pixel threshold (default: 25)')
    parser.add_argument('--png', action='store_true',
                       help='Also regenerate APNG files from processed GIFs')
    parser.add_argument('--files', '-f', nargs='+',
                       help='Specific files to process')
    
    args = parser.parse_args()
    
    if args.files:
        gif_files = args.files
    else:
        gif_files = sorted([
            f for f in os.listdir(args.originals)
            if f.endswith('.gif')
        ])
    
    print(f"Smart Background Removal — {len(gif_files)} files")
    print(f"Threshold: {args.threshold}, Originals: {args.originals}")
    print(f"Output: {args.output}\n")
    
    for filename in gif_files:
        input_path = os.path.join(args.originals, filename)
        output_path = os.path.join(args.output, filename)
        
        if not os.path.exists(input_path):
            print(f"SKIP: {filename} (not found)")
            continue
        
        process_gif(input_path, output_path, args.threshold)
        
        if args.png:
            png_name = filename.replace('.gif', '.png')
            png_path = os.path.join(args.output, png_name)
            gif_to_apng(output_path, png_path)
        
        print()
    
    print("Done!")


if __name__ == '__main__':
    main()
