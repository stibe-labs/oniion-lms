'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, RefreshButton, useToast } from '@/components/dashboard/shared';
import { Download, Loader2, Smartphone, Upload, Sparkles, ShieldAlert } from 'lucide-react';
import { usePlatformName } from '@/components/providers/PlatformProvider';

interface TeacherAppRelease {
  id: string;
  version_name: string;
  version_code: number;
  file_url: string;
  download_url: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  release_notes: string | null;
  uploaded_by: string;
  is_latest: boolean;
  is_force_update: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function parseAxmlVersion(data: Uint8Array): { versionCode: number; versionName: string } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 8 || view.getUint16(0, true) !== 0x0003) return null;
  let offset = 8;
  let strings: string[] = [];
  let resourceMap: number[] = [];
  let versionCode = 0;
  let versionName = '';
  while (offset + 8 <= data.length) {
    const chunkType = view.getUint16(offset, true);
    const headerSize = view.getUint16(offset + 2, true);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkSize === 0 || offset + chunkSize > data.length) break;
    if (chunkType === 0x0001) { // StringPool
      const strCount = view.getUint32(offset + 8, true);
      const flags = view.getUint32(offset + 16, true);
      const stringsStart = view.getUint32(offset + 20, true);
      const isUtf8 = (flags & 0x100) !== 0;
      strings = [];
      for (let i = 0; i < strCount; i++) {
        try {
          const strOff = view.getUint32(offset + headerSize + i * 4, true);
          const strBase = offset + stringsStart + strOff;
          if (isUtf8) {
            let p = strBase;
            let charLen = data[p++]; if (charLen & 0x80) charLen = ((charLen & 0x7f) << 8) | data[p++];
            let byteLen = data[p++]; if (byteLen & 0x80) byteLen = ((byteLen & 0x7f) << 8) | data[p++];
            strings.push(new TextDecoder().decode(data.subarray(p, p + byteLen)));
          } else {
            let p = strBase;
            let charLen = view.getUint16(p, true); p += 2;
            if (charLen & 0x8000) { charLen = ((charLen & 0x7fff) << 16) | view.getUint16(p, true); p += 2; }
            strings.push(new TextDecoder('utf-16le').decode(data.subarray(p, p + charLen * 2)));
          }
        } catch { strings.push(''); }
      }
    } else if (chunkType === 0x0180) { // ResourceMap
      resourceMap = [];
      const count = (chunkSize - headerSize) / 4;
      for (let i = 0; i < count; i++) resourceMap.push(view.getUint32(offset + headerSize + i * 4, true));
    } else if (chunkType === 0x0102) { // START_ELEMENT (first = <manifest>)
      const attrStart = view.getUint16(offset + 24, true);
      const attrSize = view.getUint16(offset + 26, true);
      const attrCount = view.getUint16(offset + 28, true);
      const attrBase = offset + 16 + attrStart;
      for (let i = 0; i < attrCount; i++) {
        const aOff = attrBase + i * attrSize;
        const nameIdx = view.getUint32(aOff + 4, true);
        const rawValIdx = view.getInt32(aOff + 8, true);
        const dataType = data[aOff + 15];
        const dataVal = view.getUint32(aOff + 16, true);
        const resId = nameIdx < resourceMap.length ? resourceMap[nameIdx] : 0;
        if (resId === 0x0101021b) { versionCode = dataVal; }
        else if (resId === 0x0101021c) {
          if (dataType === 0x03 && dataVal < strings.length) versionName = strings[dataVal];
          else if (rawValIdx >= 0 && rawValIdx < strings.length) versionName = strings[rawValIdx];
        }
      }
      if (versionCode || versionName) break;
    }
    offset += chunkSize;
  }
  return (versionCode || versionName) ? { versionCode, versionName } : null;
}

async function parseApkVersion(file: File): Promise<{ versionCode: number; versionName: string } | null> {
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  let cdOff = view.getUint32(eocd + 16, true);
  const cdCount = view.getUint16(eocd + 10, true);
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(cdOff, true) !== 0x02014b50) break;
    const compMethod = view.getUint16(cdOff + 10, true);
    const compSize = view.getUint32(cdOff + 20, true);
    const uncompSize = view.getUint32(cdOff + 24, true);
    const fnLen = view.getUint16(cdOff + 28, true);
    const exLen = view.getUint16(cdOff + 30, true);
    const cmLen = view.getUint16(cdOff + 32, true);
    const lfhOff = view.getUint32(cdOff + 42, true);
    const fn = new TextDecoder().decode(bytes.subarray(cdOff + 46, cdOff + 46 + fnLen));
    if (fn === 'AndroidManifest.xml') {
      const lfhFnLen = view.getUint16(lfhOff + 26, true);
      const lfhExLen = view.getUint16(lfhOff + 28, true);
      const dataStart = lfhOff + 30 + lfhFnLen + lfhExLen;
      const compData = bytes.subarray(dataStart, dataStart + compSize);
      let manifestData: Uint8Array;
      if (compMethod === 0) {
        manifestData = bytes.subarray(dataStart, dataStart + uncompSize);
      } else if (compMethod === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compData); writer.close();
        const chunks: Uint8Array[] = [];
        const reader = ds.readable.getReader();
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        const total = chunks.reduce((a, c) => a + c.length, 0);
        manifestData = new Uint8Array(total);
        let off = 0; for (const c of chunks) { manifestData.set(c, off); off += c.length; }
      } else { return null; }
      return parseAxmlVersion(manifestData);
    }
    cdOff += 46 + fnLen + exLen + cmLen;
  }
  return null;
}

export default function TeacherAppUpdatesPanel() {
  const toast = useToast();
  const platformName = usePlatformName();
  const [releases, setReleases] = useState<TeacherAppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [apkParsing, setApkParsing] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const latest = useMemo(
    () => releases.find((release) => release.is_latest) || releases[0] || null,
    [releases]
  );

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/teacher-app/releases?all=1');
      const data = await res.json();
      if (data.success) {
        setReleases(data.data?.releases || []);
      } else {
        toast.error(data.error || 'Failed to load app releases');
      }
    } catch {
      toast.error('Network error loading app releases');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const handleUpload = useCallback(async () => {
    const code = Number(versionCode.trim());
    if (!versionName.trim()) {
      toast.error('Version name is required');
      return;
    }
    if (!Number.isInteger(code) || code <= 0) {
      toast.error('Version code must be a positive integer');
      return;
    }
    if (!selectedFile) {
      toast.error('Please choose an APK file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('apk', selectedFile);
      formData.append('version_name', versionName.trim());
      formData.append('version_code', String(code));
      formData.append('release_notes', releaseNotes.trim());
      formData.append('is_force_update', forceUpdate ? 'true' : 'false');
      formData.append('is_latest', 'true');

      const res = await fetch('/api/v1/teacher-app/releases', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to upload APK');
        return;
      }

      toast.success('Teacher app APK uploaded');
      setVersionName('');
      setVersionCode('');
      setReleaseNotes('');
      setForceUpdate(false);
      setSelectedFile(null);
      await fetchReleases();
    } catch {
      toast.error('Network error uploading APK');
    }
    setUploading(false);
  }, [fetchReleases, forceUpdate, releaseNotes, selectedFile, toast, versionCode, versionName]);

  const handleFileChange = useCallback(async (file: File | null) => {
    setSelectedFile(file);
    if (!file) return;
    setApkParsing(true);
    try {
      const ver = await parseApkVersion(file);
      if (ver) {
        if (ver.versionName) setVersionName(ver.versionName);
        if (ver.versionCode) setVersionCode(String(ver.versionCode));
      }
    } catch { /* ignore parse errors */ }
    setApkParsing(false);
  }, []);

  const updateRelease = useCallback(async (id: string, patch: Partial<TeacherAppRelease>, successMessage: string) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/v1/teacher-app/releases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to update release');
        return;
      }
      toast.success(successMessage);
      await fetchReleases();
    } catch {
      toast.error('Network error updating release');
    }
    setSavingId(null);
  }, [fetchReleases, toast]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">Teacher App Updates</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Upload the latest Android APK for the {platformName} Teacher screen-sharing app. Teachers will be prompted inside the app when a newer version is available.
            </p>
          </div>
          <RefreshButton loading={loading} onClick={fetchReleases} />
        </div>

        <Alert
          variant="info"
          message="Upload a new APK with a higher version code than the currently installed app. The mobile app compares version codes to decide whether an update is available."
        />

        {latest && (
          <div className="rounded-xl border border-primary/20 bg-primary/5/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">Latest Live</span>
              {latest.is_force_update && (
                <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white">Force Update</span>
              )}
              <span className="text-sm font-semibold text-emerald-900">
                v{latest.version_name} ({latest.version_code})
              </span>
            </div>
            <p className="mt-2 text-sm text-emerald-900/90">
              File: <span className="font-medium">{latest.file_name}</span> · {formatSize(latest.file_size)}
            </p>
            {latest.release_notes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900/80">{latest.release_notes}</p>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Version Name</label>
            <input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="1.0.1"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Version Code</label>
            <input
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
              placeholder="2"
              inputMode="numeric"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Release Notes</label>
          <textarea
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            rows={3}
            placeholder="What changed in this update?"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={forceUpdate}
                onChange={(e) => setForceUpdate(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Force update before app usage
              </span>
            </label>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">APK File</label>
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="block text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-primary/5 file:px-4 file:py-2 file:font-medium file:text-primary hover:file:bg-primary/10"
              />
              {selectedFile && (
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                  {apkParsing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  {selectedFile.name} · {formatSize(selectedFile.size)}
                  {apkParsing && <span className="text-primary">Reading version…</span>}
                </p>
              )}
            </div>
          </div>

          <Button
            icon={uploading ? Loader2 : Upload}
            loading={uploading}
            onClick={handleUpload}
            className="min-w-[180px]"
          >
            Upload Latest APK
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Release History</h4>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading releases…
          </div>
        ) : releases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            No teacher app APK uploaded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {releases.map((release) => (
              <div key={release.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {release.is_latest && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">Latest</span>
                      )}
                      {release.is_force_update && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">Force Update</span>
                      )}
                      {!release.is_active && (
                        <span className="rounded-full bg-gray-500 px-2 py-0.5 text-[11px] font-semibold text-white">Inactive</span>
                      )}
                      <span className="text-base font-semibold text-gray-900">
                        v{release.version_name} ({release.version_code})
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {release.file_name} · {formatSize(release.file_size)} · uploaded by {release.uploaded_by}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(release.created_at).toLocaleString()}
                    </p>
                    {release.release_notes && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{release.release_notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Download}
                      onClick={() => window.open(release.download_url, '_blank', 'noopener,noreferrer')}
                    >
                      Download
                    </Button>
                    {!release.is_latest && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={savingId === release.id}
                        onClick={() => updateRelease(release.id, { is_latest: true }, 'Latest version updated')}
                      >
                        Set Latest
                      </Button>
                    )}
                    <Button
                      variant={release.is_force_update ? 'danger' : 'outline'}
                      size="sm"
                      loading={savingId === release.id}
                      onClick={() => updateRelease(
                        release.id,
                        { is_force_update: !release.is_force_update },
                        release.is_force_update ? 'Force update disabled' : 'Force update enabled',
                      )}
                    >
                      {release.is_force_update ? 'Unset Force' : 'Force Update'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
