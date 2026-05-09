'use client';

import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Crop as CropIcon, RotateCw, ZoomIn, ZoomOut, Check, X } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

/** Draw crop onto canvas, return a File (JPEG, ≤ quality threshold) */
async function getCroppedFile(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotation: number,
  fileName: string,
): Promise<File> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const pixelCrop = {
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY,
  };

  // Handle rotation
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  // Output square-ish canvas sized to the crop
  const outputWidth = pixelCrop.width;
  const outputHeight = pixelCrop.height;

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  // Move to center, rotate, then draw the offset
  ctx.save();
  ctx.translate(outputWidth / 2, outputHeight / 2);
  ctx.rotate(radians);

  // Draw the image so the crop area is centered
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    -outputWidth / 2,
    -outputHeight / 2,
    outputWidth,
    outputHeight,
  );
  ctx.restore();

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(new File([blob!], fileName.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  });
}

// ── Component ────────────────────────────────────────────────
export interface ImageCropModalProps {
  /** Data-URL or object-URL of the selected image */
  imageSrc: string;
  /** Original file name for the output File */
  fileName: string;
  /** Called with the cropped File + preview data-URL */
  onCropComplete: (file: File, previewUrl: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Lock to circular crop (default true for avatars) */
  circularCrop?: boolean;
  /** Aspect ratio (default 1 = square) */
  aspect?: number;
}

export default function ImageCropModal({
  imageSrc,
  fileName,
  onCropComplete,
  onCancel,
  circularCrop = true,
  aspect = 1,
}: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      imgRef.current = e.currentTarget;
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    },
    [aspect],
  );

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    setSaving(true);
    try {
      const file = await getCroppedFile(imgRef.current, completedCrop, rotation, fileName);
      const reader = new FileReader();
      reader.onload = (ev) => {
        onCropComplete(file, ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CropIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Crop Photo</h3>
              <p className="text-xs text-gray-400">Drag to adjust the crop area</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Crop area */}
        <div className="p-4 flex items-center justify-center bg-gray-950/5 min-h-80 max-h-[60vh] overflow-hidden">
          <ReactCrop
            crop={crop}
            onChange={(_, pc) => setCrop(pc)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            circularCrop={circularCrop}
            className="max-h-[55vh]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ transform: `scale(${scale}) rotate(${rotation}deg)`, maxHeight: '55vh' }}
              className="transition-transform duration-200"
            />
          </ReactCrop>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-t border-b flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
            title="Rotate 90°"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !completedCrop}
            className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            {saving ? 'Processing…' : 'Apply Crop'}
          </button>
        </div>
      </div>
    </div>
  );
}
