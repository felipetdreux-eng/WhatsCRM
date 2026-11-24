// Mocks simples para testar módulos que usam localStorage e Supabase sem rede.

export function installLocalStorage() {
  const store = new Map();
  const storage = {
    getItem: key => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: key => { store.delete(String(key)); },
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  globalThis.localStorage = storage;
  return storage;
}

// Query builder encadeável do Supabase: qualquer método devolve o próprio
// builder e o `await` resolve com o resultado configurado para a tabela.
export function createFakeSupabase(supabase, { user = null, tables = {}, rpc = {} } = {}) {
  const calls = [];

  const builderFor = (table) => {
    const chain = [];
    const builder = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') {
          const handler = tables[table];
          const result = typeof handler === 'function' ? handler(chain) : (handler ?? { data: null, error: null });
          calls.push({ table, chain });
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        }
        return (...args) => {
          chain.push([prop, ...args]);
          return builder;
        };
      },
    });
    return builder;
  };

  const originals = {
    from: supabase.from,
    rpc: supabase.rpc,
    getUser: supabase.auth.getUser,
  };

  supabase.from = table => builderFor(table);
  supabase.rpc = async (name, args) => {
    calls.push({ rpc: name, args });
    const handler = rpc[name];
    return typeof handler === 'function' ? handler(args) : (handler ?? { data: null, error: null });
  };
  supabase.auth.getUser = async () => (user
    ? { data: { user }, error: null }
    : { data: { user: null }, error: new Error('no session') });

  return {
    calls,
    restore() {
      supabase.from = originals.from;
      supabase.rpc = originals.rpc;
      supabase.auth.getUser = originals.getUser;
    },
  };
}

export function chainHas(chain, method, ...args) {
  return chain.some(([name, ...rest]) => name === method && args.every((arg, i) => JSON.stringify(rest[i]) === JSON.stringify(arg)));
}
