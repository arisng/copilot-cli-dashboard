import { useParams } from 'react-router-dom';
import { MobileSessionPane } from './MobileSessionPane.tsx';

export function MobileSessionDetail() {
  const { id = '' } = useParams<{ id: string }>();
  return (
    <div data-testid="mobile-session-detail">
      <MobileSessionPane sessionId={id} showBackLinks />
    </div>
  );
}
