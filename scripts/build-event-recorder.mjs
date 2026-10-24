import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateRecorder } from '../recorder/md-generator.mjs';

const config = JSON.parse(readFileSync(new URL('../recorder/config.json', import.meta.url), 'utf8'));
const output = new URL('../extensions/lifesigns_event_recorder/md/LifeSigns_EventRecorder.xml', import.meta.url);
mkdirSync(new URL('.', output), { recursive: true });
writeFileSync(output, generateRecorder(config));
console.log(`Built ${fileURLToPath(output)}`);
