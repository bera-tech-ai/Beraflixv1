import { NextResponse } from 'next/server';
import { OfflineTransferError, prepareOfflineTransfer } from '../../../../lib/offline-transfer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request) {
  try {
    const result = await prepareOfflineTransfer(new URL(request.url).searchParams, request.signal);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    const status = error instanceof OfflineTransferError ? error.status : 502;
    if (!(error instanceof OfflineTransferError)) console.error('Offline preparation failed.');
    return NextResponse.json({ error: error instanceof OfflineTransferError ? error.message : 'Offline saving is temporarily unavailable.' }, { status, headers: NO_STORE });
  }
}
