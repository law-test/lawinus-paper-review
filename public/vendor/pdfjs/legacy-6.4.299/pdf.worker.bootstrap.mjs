import './pdf.compat.mjs';
const { WorkerMessageHandler } = await import('./pdf.worker.mjs');
// PDF.js also imports this export if the browser cannot start a module worker.
export { WorkerMessageHandler };
