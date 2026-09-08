const worker = new Worker(new URL('./worker.js', import.meta.url));
let next = 1; const pending = new Map();
worker.onmessage = ({data}) => { const call = pending.get(data.id); if (!call) return; pending.delete(data.id); data.error ? call.reject(Object.assign(new Error(data.error.message), data.error)) : call.resolve(data.result); };
export const db = { call(op, payload = {}) { return new Promise((resolve,reject) => { const id=next++; pending.set(id,{resolve,reject}); worker.postMessage({id,op,payload}); }); } };
