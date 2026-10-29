import { createOfficeClient } from '../office/officeClient';
import { createFakeOfficeServer } from './fakeOffice';

/** A fake office server plus the real client on it, without retry waits. */
export function createFakeOffice() {
  const server = createFakeOfficeServer();
  const client = createOfficeClient(
    { url: 'https://fake.supabase.co', key: 'k' },
    server.fetchImpl,
    [],
  );
  return { ...server, client };
}
