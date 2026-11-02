import { NextResponse } from 'next/server';
import { OfflineTransferError, openOfflineTransfer } from '../../../../lib/offline-transfer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request) {
  try {
    const range = request.headers.get('range');
    const { response, headers } = await openOfflineTransfer(new URL(request.url).searchParams, range, request.signal);
    return new Response(response.body, { status: 206, headers });
  } catch (error) {
    const status = error instanceof OfflineTransferError ? error.status : error?.name === 'AbortError' ? 499 : 502;
    if (!(error instanceof OfflineTransferError) && error?.name !== 'AbortError') console.error('Offline media relay failed.');
    return NextResponse.json({ error: error instanceof OfflineTransferError ? error.message : 'The offline media transfer could not be completed.' }, { status, headers: NO_STORE });
  }
}
