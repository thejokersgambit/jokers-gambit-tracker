// npm run publish — re-check, rebuild and upload (e.g. to retry after an offline failure).
import { publish } from './lib/publish.mjs';

try {
  publish(process.argv.slice(2).join(' ') || 'Update bets');
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
