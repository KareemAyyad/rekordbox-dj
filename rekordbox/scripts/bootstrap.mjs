import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('[bootstrap] Created .env from .env.example');
  } else {
    console.log('[bootstrap] Warning: .env.example not found');
  }
} else {
  console.log('[bootstrap] .env already exists');
}

// Ensure the DJ Library inbox exists locally if it's the default
const defaultInbox = path.join(root, 'DJ Library', '00_INBOX');
if (!fs.existsSync(defaultInbox)) {
  fs.mkdirSync(defaultInbox, { recursive: true });
  console.log(`[bootstrap] Created default inbox at ${defaultInbox}`);
}
