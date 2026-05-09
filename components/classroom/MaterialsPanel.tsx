'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Material {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  material_type: string;
  created_at: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeIcon(type: string): string {
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.startsWith('image/')) return '🖼️';
  if (type.includes('pdf')) return '📕';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📊';
  if (type.includes('spreadsheet') || type.includes('excel')) return '📗';
  return '📄';
}

export default function MaterialsPanel({ className }: { className?: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/teaching-materials', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setMaterials(json.data?.materials || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  return (
    <div className={cn('flex flex-col h-full bg-[#1a1a2e] text-[#e8eaed]', className)}>
      <div className="px-3 py-2 border-b border-[#3c4043]">
        <h3 className="text-xs font-semibold text-[#8ab4f8]">📚 Study Materials</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-xs text-[#9aa0a6] text-center py-8">Loading materials…</div>
        ) : materials.length === 0 ? (
          <div className="text-xs text-[#9aa0a6] text-center py-8">No materials available</div>
        ) : (
          materials.map((m) => (
            <a
              key={m.id}
              href={m.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 rounded-lg bg-[#292a2d] hover:bg-[#3c4043] p-2.5 transition-colors group"
            >
              <span className="text-lg mt-0.5">{typeIcon(m.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#e8eaed] group-hover:text-[#8ab4f8] truncate">
                  {m.title}
                </div>
                {m.description && (
                  <div className="text-[10px] text-[#9aa0a6] line-clamp-2 mt-0.5">{m.description}</div>
                )}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-[#9aa0a6]">
                  <span className="bg-[#3c4043] px-1.5 py-0.5 rounded">{m.subject}</span>
                  <span>{formatSize(m.file_size)}</span>
                  <span>{m.material_type}</span>
                </div>
              </div>
              <span className="text-[#9aa0a6] group-hover:text-[#8ab4f8] text-sm mt-1">↗</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
