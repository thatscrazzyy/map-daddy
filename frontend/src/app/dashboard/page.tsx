import { useEffect, useState } from 'react';
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createProject, deleteProject, listProjects, renameProject } from '../../lib/projects/projectRepository';
import type { ProjectSummary } from '../../lib/projects/types';
import { appPath } from '../../lib/routing';
import { APP_VERSION_LABEL } from '../../lib/version';

export function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState('New Projection Map');
  const [editingProjectId, setEditingProjectId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  const open = (path: string) => {
    window.history.pushState({}, '', appPath(path));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const create = async () => {
    const project = await createProject(name.trim() || 'Untitled Project');
    open(`/editor/${project.id}`);
  };

  const beginRename = (project: ProjectSummary) => {
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  const cancelRename = () => {
    setEditingProjectId('');
    setEditingName('');
  };

  const saveRename = async (projectId: string) => {
    const nextName = editingName.trim() || 'Untitled Project';
    const updated = await renameProject(projectId, nextName);
    setProjects((current) => current.map((project) => (
      project.id === projectId ? { ...project, name: updated.name, updatedAt: updated.updatedAt } : project
    )));
    cancelRename();
  };

  const removeProject = async (project: ProjectSummary) => {
    const confirmed = window.confirm(`Delete "${project.name}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteProject(project.id);
    setProjects((current) => current.filter((item) => item.id !== project.id));
    if (editingProjectId === project.id) cancelRename();
  };

  return (
    <main className="min-h-screen bg-[#0b0d12] text-slate-100">
      <header className="border-b border-white/10 bg-[#121620] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <div className="flex items-baseline gap-3">
              <div className="neon-cyan text-2xl font-black">MAP DADDY</div>
              <span className="mono text-xs uppercase tracking-wider text-slate-500">{APP_VERSION_LABEL}</span>
            </div>
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
              <article key={project.id} className="rounded border border-white/10 bg-[#151821] p-4 hover:border-cyan-300/45">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingProjectId === project.id ? (
                      <div className="flex gap-2">
                        <input
                          className="h-9 min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveRename(project.id);
                            if (event.key === 'Escape') cancelRename();
                          }}
                          autoFocus
                        />
                        <button className="flex h-9 w-9 items-center justify-center rounded border border-lime-300/30 bg-lime-300/10 text-lime-200 hover:bg-lime-300/20" onClick={() => saveRename(project.id)} title="Save project name">
                          <Check size={16} />
                        </button>
                        <button className="flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]" onClick={cancelRename} title="Cancel rename">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <h3 className="truncate text-lg font-semibold text-slate-100">{project.name}</h3>
                    )}
                    <p className="mono mt-1 text-[10px] uppercase tracking-wider text-slate-500">{project.id}</p>
                  </div>
                  <FolderOpen size={19} className="mt-1 shrink-0 text-cyan-200" />
                </div>
                <div className="mt-5 flex gap-3 text-xs text-slate-400">
                  <span>{project.surfaceCount} surfaces</span>
                  <span>{project.mediaCount} media</span>
                </div>
                <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
                  <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded bg-cyan-100 text-sm font-semibold text-slate-950 hover:bg-cyan-200" onClick={() => open(`/editor/${project.id}`)}>
                    <FolderOpen size={15} /> Open
                  </button>
                  <button className="flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-300/50" onClick={() => beginRename(project)} title="Rename project">
                    <Pencil size={15} />
                  </button>
                  <button className="flex h-9 w-9 items-center justify-center rounded border border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/20" onClick={() => removeProject(project)} title="Delete project">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            {!loading && projects.length === 0 && <div className="rounded border border-dashed border-white/10 p-8 text-slate-500">No projects yet.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
