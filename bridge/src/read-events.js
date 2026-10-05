import { open, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const MARKER = 'LIFESIGNS_BRIDGE_V1';
const MAX_LINE_BYTES = 64 * 1024;
const CHUNK_BYTES = 64 * 1024;

export function parseRecord(line) {
  const index = line.indexOf(MARKER);
  if (index === -1) return null;
  // X4 may prepend a timestamp/filter; our record must finish the line.
  const match = /^LIFESIGNS_BRIDGE_V1\|docked\|ship=([A-Z]{3}-[0-9]{3})\|destination=([A-Z]{3}-[0-9]{3})\|END\s*$/.exec(line.slice(index));
  if (!match) throw new Error('Malformed LIFESIGNS_BRIDGE_V1 record');
  return { ship: match[1], destination: match[2] };
}

export function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--log', '--db'].includes(key) || options[key] || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Usage: node bridge/src/read-events.js --log <path> [--db <database>]');
    }
    options[key] = resolve(args[i + 1]);
  }
  if (!options['--log']) throw new Error('Usage: node bridge/src/read-events.js --log <path> [--db <database>]');
  return { logPath: options['--log'], dbPath: options['--db'] };
}

async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

function identity(stat) {
  return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
}

// Polls are sequential. All handles use read-only mode and close after each poll.
export async function createTail(logPath, { onRecord = () => {}, onWarning = () => {} } = {}) {
  let offset;
  let fileIdentity;
  let anchor = Buffer.alloc(0);
  let pending = Buffer.alloc(0);
  let discardLine = false;
  let unavailable = false;
  let oversized = false;

  const initial = await open(logPath, 'r');
  try {
    const stat = await initial.stat();
    if (!stat.isFile()) throw new Error('The --log path must be a regular file');
    offset = stat.size;
    fileIdentity = identity(stat);
    anchor = await readAt(initial, Math.max(0, offset - 64), Math.min(64, offset));
    // An old unfinished line must not become a newly acknowledged event.
    discardLine = offset > 0 && anchor.at(-1) !== 10;
  } finally {
    await initial.close();
  }

  function consume(buffer) {
    let start = 0;
    for (let end = buffer.indexOf(10); end !== -1; end = buffer.indexOf(10, start)) {
      const part = buffer.subarray(start, end);
      if (!discardLine && !oversized) {
        if (pending.length + part.length > MAX_LINE_BYTES) {
          onWarning('Log line exceeds 64 KiB; discarded');
        } else {
          const line = Buffer.concat([pending, part]).toString('utf8').replace(/\r$/, '');
          let record;
          try {
            record = parseRecord(line);
          } catch (error) {
            onWarning(error.message);
          }
          // Only parser errors are recoverable here. Storage/callback errors propagate.
          if (record) onRecord(record);
        }
      }
      pending = Buffer.alloc(0);
      discardLine = false;
      oversized = false;
      start = end + 1;
    }
    if (!discardLine && !oversized) {
      pending = Buffer.concat([pending, buffer.subarray(start)]);
      if (pending.length > MAX_LINE_BYTES) {
        onWarning('Log line exceeds 64 KiB; discarded');
        pending = Buffer.alloc(0);
        oversized = true;
      }
    }
  }

  return {
    async poll() {
      let handle;
      try {
        handle = await open(logPath, 'r');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (!unavailable) onWarning('Log unavailable; waiting for it to reappear');
        unavailable = true;
        return;
      }
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error('The log path is no longer a regular file');
        const replaced = unavailable || identity(stat) !== fileIdentity;
        // Also detects truncate-and-regrow when the size has already passed offset.
        const currentAnchor = await readAt(handle, Math.max(0, offset - anchor.length), anchor.length);
        const truncated = stat.size < offset || !currentAnchor.equals(anchor);
        if (replaced || truncated) {
          onWarning(`Log ${replaced ? 'replaced/reappeared' : 'truncated/rewritten'}; restarting at byte 0`);
          offset = 0;
          pending = Buffer.alloc(0);
          discardLine = false;
          oversized = false;
        }
        unavailable = false;
        fileIdentity = identity(stat);
        while (offset < stat.size) {
          const buffer = await readAt(handle, offset, Math.min(CHUNK_BYTES, stat.size - offset));
          if (!buffer.length) break;
          consume(buffer);
          offset += buffer.length;
        }
        anchor = await readAt(handle, Math.max(0, offset - 64), Math.min(64, offset));
      } finally {
        await handle.close();
      }
    }
  };
}

async function main() {
  const { logPath, dbPath } = parseArgs(process.argv.slice(2));
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let store;
  try {
    if (dbPath) {
      // Never let an empty log be initialised as a database, including hard links.
      const fold = (path) => process.platform === 'win32' ? path.toLowerCase() : path;
      if (fold(logPath) === fold(dbPath)) throw new Error('--db must be a different file from --log');
      const fileStat = async (path) => {
        try { return await stat(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      };
      const [logInfo, dbInfo] = await Promise.all([fileStat(logPath), fileStat(dbPath)]);
      if (logInfo && dbInfo && logInfo.dev === dbInfo.dev && logInfo.ino === dbInfo.ino) {
        throw new Error('--db must be a different file from --log');
      }
      // Validate/open storage before watching the log. Console-only needs no SQLite import.
      store = (await import('./event-store.js')).openEventStore(dbPath);
    }
    const tail = await createTail(logPath, {
      onRecord: (record) => {
        if (store) {
          const row = store.persist(record);
          console.log(`Docking persisted: ${JSON.stringify(row)}`);
        } else {
          console.log(`Docking acknowledged: ship ${record.ship} -> destination ${record.destination}`);
        }
      },
      onWarning: (message) => console.error(`Bridge warning: ${message}`)
    });
    console.log(`Watching from current end: ${logPath}`);
    while (!controller.signal.aborted) {
      await tail.poll();
      await delay(250, undefined, { signal: controller.signal });
    }
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    store?.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Bridge error: ${error.message}`);
    process.exitCode = 1;
  });
}
