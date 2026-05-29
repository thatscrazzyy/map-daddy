import { useEffect, useState } from 'react';
import { DashboardPage } from './app/dashboard/page';
import { EditorPage } from './app/editor/[projectId]/page';
import { ProjectorPage } from './app/projector/[projectId]/page';

function routeFromLocation() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (path === '/' || path === '/dashboard') return { name: 'dashboard' as const };
  if (parts[0] === 'editor' && parts[1]) return { name: 'editor' as const, projectId: parts[1] };
  if (parts[0] === 'projector' && parts[1]) return { name: 'projector' as const, projectId: parts[1] };
  return { name: 'dashboard' as const };
}

export default function App() {
  const [route, setRoute] = useState(routeFromLocation);

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/dashboard');
      setRoute(routeFromLocation());
    }
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route.name === 'editor') return <EditorPage projectId={route.projectId} />;
  if (route.name === 'projector') return <ProjectorPage projectId={route.projectId} />;
  return <DashboardPage />;
}
