import { MessengerWorkspace } from './MessengerWorkspace';

export function TicketInboxPanel({ mode }: { mode: 'seller' | 'admin' }) {
  return <MessengerWorkspace mode={mode} fullScreen />;
}
