import { ApiError, api } from './api/client';
import {
  getPendingOutbox,
  markOutboxSynced,
  recordOutboxFailure,
  type PendingOutboxItem,
} from './database';

interface SyncSummary {
  synced: number;
  pending: number;
  failed: number;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 0
      ? 'Connexion au serveur impossible'
      : error.message || `Erreur serveur (${error.status})`;
  }
  return error instanceof Error ? error.message : 'Erreur de synchronisation inconnue';
}

/**
 * Flushes durable local operations. The server-side operation ID is identical
 * to the local UUID, so retrying after a lost HTTP response cannot duplicate it.
 */
export async function syncPendingOperations(): Promise<SyncSummary> {
  const queue = await getPendingOutbox();
  const summary: SyncSummary = { synced: 0, pending: 0, failed: 0 };

  for (const item of queue) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;

      if (item.operation !== 'CREATE') {
        await recordOutboxFailure(item.id, 'Opération de synchronisation non prise en charge.', true);
        summary.failed += 1;
        continue;
      }

      if (item.entity_type === 'SALE') {
        await api('/api/sales', { method: 'POST', body: payload });
      } else if (item.entity_type === 'PURCHASE') {
        await api('/api/purchases', { method: 'POST', body: payload });
      } else {
        await recordOutboxFailure(item.id, 'Type de synchronisation non pris en charge.', true);
        summary.failed += 1;
        continue;
      }

      await markOutboxSynced(item);
      summary.synced += 1;
    } catch (error) {
      const permanent =
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status !== 401 &&
        error.status !== 403;
      await recordOutboxFailure(item.id, describeError(error), permanent);
      if (permanent) {
        summary.failed += 1;
        continue;
      }

      summary.pending += queue.length - summary.synced - summary.failed;
      // A network or authentication failure blocks later operations too.
      break;
    }
  }

  return summary;
}
