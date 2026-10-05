import { open } from 'node:fs/promises';
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
  if (args.length !== 2 || args[0] !== '--log' || !args[1] || args[1].startsWith('--')) {
    throw new Error('Usage: node bridge/src/read-events.js --log <path>');
  }
  return resolve(args[1]);
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
          try {
            const record = parseRecord(line);
            if (record) onRecord(record);
          } catch (error) {
            onWarning(error.message);
          }
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
  const logPath = parseArgs(process.argv.slice(2));
  const tail = await createTail(logPath, {
    onRecord: ({ ship, destination }) => console.log(`Docking acknowledged: ship ${ship} -> destination ${destination}`),
    onWarning: (message) => console.error(`Bridge warning: ${message}`)
  });
  console.log(`Watching from current end: ${logPath}`);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    while (!controller.signal.aborted) {
      await tail.poll();
      await delay(250, undefined, { signal: controller.signal });
    }
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Bridge error: ${error.message}`);
    process.exitCode = 1;
  });
}
