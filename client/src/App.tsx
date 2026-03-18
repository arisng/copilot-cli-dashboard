import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/shared/Layout.tsx';
import { SessionList } from './components/SessionList/SessionList.tsx';
import { SessionDetail } from './components/SessionDetail/SessionDetail.tsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SessionList />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
      </Routes>
    </Layout>
  );
}
