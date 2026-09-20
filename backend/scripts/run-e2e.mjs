// Load environment variables from repository root .env before any other imports
import 'tsconfig-paths/register';
import { config as loadEnvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const envPath = path.resolve(repoRoot, '.env');
console.log('Loading .env from:', envPath);
loadEnvConfig({ path: envPath });
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'present' : 'missing');

// Now import pipeline class after env is loaded
const { DiscoveryPipeline } = await import('../src/discovery/pipeline/pipeline.js');

async function main() {
  console.log('Starting USAJOBS pipeline run...');
  const result = await DiscoveryPipeline.runUsaJobsExample();
  console.log('Pipeline completed:', result.status);
  process.exit(result.status === 'SUCCEEDED' ? 0 : 1);
}

main().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});