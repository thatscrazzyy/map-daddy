import { Image as ImageIcon, Plus, Upload, Video } from 'lucide-react';
import type { ProjectMedia } from '../../lib/projects/types';

export function MediaPanel({
  media,
  notice,
  onUpload,
  onAddSample,
  disabled
}: {
  media: ProjectMedia[];
  notice?: string;
  onUpload: (file: File) => void;
  onAddSample: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded border border-white/10 bg-[#151821] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Media</h2>
        <div className="flex gap-2">
          <button
            disabled={disabled}
            onClick={onAddSample}
            className={`inline-flex h-8 items-center gap-1.5 rounded border border-cyan-300/20 px-2 text-xs text-cyan-200 ${disabled ? 'opacity-50' : 'hover:bg-cyan-300/10'}`}
            title="Add sample grid"
          >
            <Plus size={14} /> Sample
          </button>
          <label className={`inline-flex h-8 items-center gap-1.5 rounded border border-cyan-300/40 px-2 text-xs text-cyan-100 ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-cyan-300/10'}`}>
            <Upload size={14} />
            Upload
            <input disabled={disabled} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = '';
            }} />
          </label>
        </div>
      </div>
      {notice && (
        <div className="mb-3 rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          {notice}
        </div>
      )}
      <div className="space-y-2">
        {media.length === 0 && <div className="rounded border border-dashed border-white/10 p-4 text-sm text-slate-500">No media yet.</div>}
        {media.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded border border-white/10 bg-black/20 p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/40 text-slate-300">
              {item.type === 'video' ? <Video size={16} /> : <ImageIcon size={16} />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm text-slate-100">{item.name}</div>
              <div className="mono text-[10px] uppercase text-slate-500">{item.type}</div>
              {item.id.startsWith('session_media_') && (
                <div className="text-[11px] text-yellow-200">Session only</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
