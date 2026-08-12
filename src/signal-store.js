export function createMemorySignalStore(initial = {}) {
  const data = new Map(Object.entries(initial));

  return {
    async getJSON(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null;
    },
    async setJSON(key, value) {
      data.set(key, structuredClone(value));
      return value;
    }
  };
}

export function mapFromSeenObject(seen = {}) {
  return new Map(Object.entries(seen).map(([key, value]) => [key, Number(value)]));
}

export function seenObjectFromMap(seenMap = new Map()) {
  return Object.fromEntries(seenMap.entries());
}
