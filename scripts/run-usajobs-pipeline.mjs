import 'dotenv/config';
import { discoveryPipeline } from '../backend/src/discovery/pipeline/pipeline.js';

async function main() {
  console.log('Starting USAJOBS pipeline run...');
  const result = await discoveryPipeline.runUsaJobsExample();
  console.log('Pipeline completed:', result.status);
  process.exit(result.status === 'SUCCEEDED' ? 0 : 1);
}

main().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});