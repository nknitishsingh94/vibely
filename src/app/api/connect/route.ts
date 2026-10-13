import { POST as handleConnectRequest } from './request/route';

export async function POST(req: Request) {
  return handleConnectRequest(req);
}
