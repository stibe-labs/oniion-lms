'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface Material {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  title: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

interface Props {
  sessionId: string | null;
  teacherEmail: string;
  /** When true, renders in a light-mode card (for dashboard). Default: dark classroom theme. */
  lightMode?: boolean;
  /** Called whenever the materials list changes, with new count */
  onMaterialsChange?: (count: number) => void;
}

export default function SessionMaterialsPanel({ sessionId, teacherEmail, lightMode = false, onMaterialsChange }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);

  // Notify parent when materials count changes
  useEffect(() => { onMaterialsChange?.(materials.length); }, [materials.length, onMaterialsChange]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMaterials = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/v1/session-materials?session_id=${encodeURIComponent(sessionId)}`);
      const json = await res.json() as { success: boolean; data?: { materials: Material[] } };
      if (json.success) setMaterials(json.data?.materials ?? []);
    } catch { /* silent */ }
  }, [sessionId]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const handleUpload = async (file: File) => {
    if (!sessionId) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('session_id', sessionId);
      fd.append('file', file);
      if (title.trim()) fd.append('title', title.trim());
      const res = await fetch('/api/v1/session-materials', { method: 'POST', body: fd });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) { setError(json.error ?? 'Upload failed'); return; }
      setTitle('');
      await fetchMaterials();
    } catch { setError('Upload failed — please try again.'); }
    finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/session-materials?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch { /* silent */ }
  };

  const fileIcon = (type: string) => {
    if (type === 'pdf') return '📄';
    if (type === 'image') return '🖼️';
    if (type === 'video') return '🎬';
    return '📎';
  };

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (lightMode) {
    // ── Light mode: for teacher dashboard session list ──────────────
    return (
      <div className="space-y-3">
        {!sessionId ? (
          <p className="text-xs text-gray-400 text-center py-4">No session ID — cannot upload files.</p>
        ) : (
          <>
            {/* Upload area */}
            <div
              className="rounded-xl border-2 border-dashed border-gray-200 hover:border-teal-300 bg-gray-50 p-4 cursor-pointer transition-colors text-center"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="*/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = ''; } }}
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-teal-600">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" strokeOpacity={0.3}/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                  <span className="text-xs font-medium">Uploading…</span>
                </div>
              ) : (
                <>
                  <svg className="h-8 w-8 mx-auto mb-2 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                  <p className="text-sm text-gray-500 font-medium">Click or drag a file to upload</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, images, docs, videos — max 50 MB</p>
                </>
              )}
            </div>

            {/* Optional title input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="File label (optional)"
              className="w-full rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-secondary"
            />

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* Files list */}
            {materials.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No files uploaded yet</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{materials.length} file{materials.length !== 1 ? 's' : ''}</p>
                {materials.map(m => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <span className="text-xl shrink-0">{fileIcon(m.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.title || m.file_name}</p>
                      {m.title && <p className="text-xs text-gray-400 truncate">{m.file_name}</p>}
                      {m.file_size_bytes ? <p className="text-xs text-gray-400">{fmtSize(m.file_size_bytes)}</p> : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors" title="Open">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                      <button onClick={() => handleDelete(m.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Dark mode: in-classroom sidebar / overlay ──────────────────
  return (
    <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
      {/* Header */}
      <div className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        Session Materials
      </div>

      {!sessionId && (
        <p className="text-xs text-[#9aa0a6] text-center py-6">Session not started yet</p>
      )}

      {sessionId && (
        <>
          {/* Upload area */}
          <div
            className="rounded-xl border-2 border-dashed border-[#3c4043] hover:border-[#8ab4f8]/50 bg-[#292a2d] p-4 cursor-pointer transition-colors text-center"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="*/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = ''; } }}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-[#8ab4f8]">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" strokeOpacity={0.3}/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                <span className="text-xs">Uploading…</span>
              </div>
            ) : (
              <>
                <svg className="h-7 w-7 mx-auto mb-2 text-[#5f6368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                <p className="text-xs text-[#9aa0a6]">Click or drag a file to upload</p>
                <p className="text-[10px] text-[#5f6368] mt-1">PDF, images, docs — max 50 MB</p>
              </>
            )}
          </div>

          {/* Optional title input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="File label (optional)"
            className="w-full rounded-lg bg-[#292a2d] border border-[#3c4043] px-3 py-2 text-xs text-[#e8eaed] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8]/50"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Uploaded files list */}
          {materials.length === 0 ? (
            <p className="text-xs text-[#5f6368] text-center pt-2">No files uploaded yet</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider">{materials.length} file{materials.length !== 1 ? 's' : ''}</p>
              {materials.map(m => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-[#292a2d] border border-[#3c4043] px-2.5 py-2">
                  <span className="text-base shrink-0">{fileIcon(m.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[#e8eaed] truncate">{m.title || m.file_name}</p>
                    {m.title && <p className="text-[9px] text-[#5f6368] truncate">{m.file_name}</p>}
                    {m.file_size_bytes && <p className="text-[9px] text-[#5f6368]">{fmtSize(m.file_size_bytes)}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md hover:bg-[#3c4043] text-[#8ab4f8]" title="Open">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                    <button onClick={() => handleDelete(m.id)} className="p-1 rounded-md hover:bg-red-900/30 text-[#9aa0a6] hover:text-red-400" title="Delete">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
