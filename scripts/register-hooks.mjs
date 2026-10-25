// Entry shim: `node --import ./scripts/register-hooks.mjs <script>`
import { register } from 'node:module';
register('./alias-hooks.mjs', import.meta.url);
