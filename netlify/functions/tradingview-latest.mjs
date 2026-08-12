import { getStore } from '@netlify/blobs';
import { handleLatestTradingViewSignal } from '../../src/tradingview-webhook-handler.js';

function blobJSONStore() {
  const store = getStore('alphagate-signals');
  return {
    async getJSON(key) {
      const value = await store.get(key, { type: 'json' });
      return value ?? null;
    },
    async setJSON(key, value) {
      await store.setJSON(key, value);
      return value;
    }
  };
}

export async function handler(event) {
  return handleLatestTradingViewSignal({
    method: event.httpMethod,
    store: blobJSONStore()
  });
}
