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
let syncInFlight: Promise<SyncSummary> | null = null;

export function syncPendingOperations(): Promise<SyncSummary> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = flushPendingOperations().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function flushPendingOperations(): Promise<SyncSummary> {
  const queue = await getPendingOutbox();
  const summary: SyncSummary = { synced: 0, pending: 0, failed: 0 };

  for (const item of queue) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;

      const method =
        item.operation === 'CREATE' ? 'POST' :
        item.operation === 'UPDATE' ? 'PUT' :
        item.operation === 'DELETE' ? 'DELETE' : null;
      if (!method) {
        await recordOutboxFailure(item.id, 'Opération de synchronisation non prise en charge.', true);
        summary.failed += 1;
        continue;
      }

      if (item.entity_type === 'SALE' && method === 'POST') {
        await api('/api/sales', { method, body: payload });
      } else if (item.entity_type === 'SALE_CANCEL' && method === 'POST') {
        const saleId = typeof payload.saleId === 'string' ? payload.saleId : '';
        if (!saleId) throw new Error('Identifiant de vente absent de l’annulation.');
        await api(`/api/sales/${saleId}/cancel`, {
          method: 'POST',
          body: { reason: payload.reason },
        });
      } else if (item.entity_type === 'SALE_REFUND' && method === 'POST') {
        const saleId = typeof payload.saleId === 'string' ? payload.saleId : '';
        if (!saleId) throw new Error('Identifiant de vente absent du retour.');
        await api(`/api/sales/${saleId}/refunds`, {
          method: 'POST',
          body: { id: payload.id, lines: payload.lines, reason: payload.reason },
        });
      } else if (item.entity_type === 'PURCHASE' && method === 'POST') {
        await api('/api/purchases', { method, body: payload });
      } else if (item.entity_type === 'EXPENSE') {
        const expenseId = typeof payload.id === 'string' ? payload.id : '';
        if (!expenseId) throw new Error('Identifiant de dépense absent de la synchronisation.');
        await api(method === 'POST' ? '/api/expenses' : `/api/expenses/${expenseId}`, {
          method,
          ...(method === 'DELETE' ? {} : { body: payload }),
        });
      } else if (item.entity_type === 'CUSTOMER_PAYMENT' && method === 'POST') {
        const customerId = typeof payload.customerId === 'string' ? payload.customerId : '';
        if (!customerId) throw new Error('Identifiant client absent du paiement.');
        await api(`/api/customers/${customerId}/payments`, { method, body: payload });
      } else if (item.entity_type === 'PURCHASE_PAYMENT' && method === 'POST') {
        const purchaseId = typeof payload.purchaseId === 'string' ? payload.purchaseId : '';
        if (!purchaseId) throw new Error('Identifiant d’achat absent du paiement fournisseur.');
        await api(`/api/purchases/${purchaseId}/payments`, { method, body: payload });
      } else if (item.entity_type === 'CUSTOMER') {
        const entityId = typeof payload.id === 'string' ? payload.id : '';
        if (!entityId) throw new Error('Identifiant client absent de la synchronisation.');
        await api(method === 'POST' ? '/api/customers' : `/api/customers/${entityId}`, {
          method,
          ...(method === 'DELETE' ? {} : { body: payload }),
        });
      } else if (item.entity_type === 'SUPPLIER') {
        const entityId = typeof payload.id === 'string' ? payload.id : '';
        if (!entityId) throw new Error('Identifiant fournisseur absent de la synchronisation.');
        await api(method === 'POST' ? '/api/suppliers' : `/api/suppliers/${entityId}`, {
          method,
          ...(method === 'DELETE' ? {} : { body: payload }),
        });
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
        error.status < 500 &&
        error.status !== 401 &&
        error.status !== 403 &&
        error.status !== 408 &&
        error.status !== 429;
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
