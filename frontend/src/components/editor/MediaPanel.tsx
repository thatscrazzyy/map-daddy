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
    <section className="border-b border-[#111009] p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="md-section-label">Media</h2>
        <div className="flex gap-1">
          <button
            disabled={disabled}
            onClick={onAddSample}
            className="md-button h-7 gap-1 px-2 text-[11px]"
            title="Add sample grid"
            type="button"
          >
            <Plus size={13} /> Sample
          </button>
          <label className={`md-button h-7 gap-1 px-2 text-[11px] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
            <Upload size={13} />
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
        <div className="mb-2 rounded-[3px] border border-[#e8a02055] bg-[#e8a02012] px-2 py-1.5 text-[11px] leading-4 text-[#c8b89a]">
          {notice}
        </div>
      )}
      <div className="space-y-2">
        {media.length === 0 && <div className="rounded-[3px] border border-dashed border-[#1e1c14] p-3 text-xs text-[#7a6a4a]">No media yet.</div>}
        {media.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-[3px] border border-[#1e1c14] bg-[#0e0d0a] p-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-[#030303] text-[#7a6a4a]">
              {item.type === 'video' ? <Video size={15} /> : <ImageIcon size={15} />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs text-[#c8b89a]">{item.name}</div>
              <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#7a6a4a]">{item.type}</div>
              {item.id.startsWith('session_media_') && (
                <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#e8a020]">Session only</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
