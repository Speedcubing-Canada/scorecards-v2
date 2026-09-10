// bufferPolyfill MUST be the first import - ES modules execute in dependency
// order, so this sets globalThis.Buffer before @react-pdf/renderer initializes.
import './bufferPolyfill';

import { runJobs, type WorkerRequest } from './renderBundle';

// The rendering itself lives in ./renderBundle, which imports neither `self` nor the
// polyfill above and so can be tested outside a worker. This file is only the adapter.
export type { WorkerRequest, WorkerResponse } from './renderBundle';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

workerSelf.onmessage = (e: MessageEvent<WorkerRequest>) =>
  runJobs(e.data, (msg, transfer) => workerSelf.postMessage(msg, transfer ?? []));
