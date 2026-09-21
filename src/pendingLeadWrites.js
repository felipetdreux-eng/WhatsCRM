const DEFAULT_TTL_MS = 15000;

function normalizeIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || '')).filter(Boolean))];
}

export function createPendingLeadWrites(ttlMs = DEFAULT_TTL_MS) {
  const writes = new Map();

  const prune = now => {
    for (const [id, pending] of writes) {
      if (pending.expiresAt <= now) writes.delete(id);
    }
  };

  const decrement = id => {
    const pending = writes.get(id);
    if (!pending) return false;
    if (pending.count <= 1) writes.delete(id);
    else writes.set(id, { ...pending, count: pending.count - 1 });
    return true;
  };

  return {
    mark(ids, now = Date.now()) {
      prune(now);
      normalizeIds(ids).forEach(id => {
        const pending = writes.get(id);
        writes.set(id, {
          count: (pending?.count || 0) + 1,
          expiresAt: now + ttlMs,
        });
      });
    },

    consume(id, now = Date.now()) {
      prune(now);
      return decrement(String(id || ''));
    },

    release(ids, now = Date.now()) {
      prune(now);
      normalizeIds(ids).forEach(decrement);
    },
  };
}
