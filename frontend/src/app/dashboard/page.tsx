import { useEffect, useState } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { createProject, listProjects } from '../../lib/projects/projectRepository';
import type { ProjectSummary } from '../../lib/projects/types';

export function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState('New Projection Map');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  const open = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const create = async () => {
    const project = await createProject(name.trim() || 'Untitled Project');
    open(`/editor/${project.id}`);
  };

  return (
    <main className="min-h-screen bg-[#0b0d12] text-slate-100">
      <header className="border-b border-white/10 bg-[#121620] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <div className="neon-cyan text-2xl font-black">MAP DADDY</div>
            <p className="text-sm text-slate-400">Browser controller and browser projector</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[360px,1fr]">
        <section className="rounded border border-white/10 bg-[#151821] p-4">
          <h1 className="mb-4 text-xl font-bold">Create Project</h1>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Project name</span>
            <input className="h-10 w-full rounded border border-white/10 bg-black/30 px-3 outline-none focus:border-cyan-300/50" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-cyan-100 font-semibold text-slate-950 hover:bg-cyan-200" onClick={create}>
            <Plus size={17} /> Create and Open
          </button>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Projects</h2>
            {loading && <span className="mono text-xs uppercase text-slate-500">Loading</span>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <button key={project.id} onClick={() => open(`/editor/${project.id}`)} className="rounded border border-white/10 bg-[#151821] p-4 text-left hover:border-cyan-300/45">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">{project.name}</h3>
                    <p className="mono mt-1 text-[10px] uppercase tracking-wider text-slate-500">{project.id}</p>
                  </div>
                  <FolderOpen size={19} className="text-cyan-200" />
                </div>
                <div className="mt-5 flex gap-3 text-xs text-slate-400">
                  <span>{project.surfaceCount} surfaces</span>
                  <span>{project.mediaCount} media</span>
                </div>
              </button>
            ))}
            {!loading && projects.length === 0 && <div className="rounded border border-dashed border-white/10 p-8 text-slate-500">No projects yet.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
