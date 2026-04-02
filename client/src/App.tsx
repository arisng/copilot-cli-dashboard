import { Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/shared/Layout.tsx';
import { SessionList } from './components/SessionList/SessionList.tsx';
import { SessionDetail } from './components/SessionDetail/SessionDetail.tsx';
import { SessionWatchMode } from './components/SessionWatchMode/SessionWatchMode.tsx';
import { MobileLayout } from './components/mobile/MobileLayout.tsx';
import { MobileSessionList } from './components/mobile/MobileSessionList.tsx';
import { MobileSessionDetail } from './components/mobile/MobileSessionDetail.tsx';

function DesktopRouteLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function MobileRouteLayout() {
  return (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<DesktopRouteLayout />}>
        <Route path="/" element={<SessionList />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/watch" element={<SessionWatchMode />} />
      </Route>

      <Route path="/m" element={<MobileRouteLayout />}>
        <Route index element={<MobileSessionList />} />
        <Route path="sessions/:id" element={<MobileSessionDetail />} />
      </Route>
    </Routes>
  );
}
