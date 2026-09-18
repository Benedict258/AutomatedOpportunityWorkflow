import { DiscoveryPipeline } from './pipeline';

DiscoveryPipeline.runUsaJobsExample()
  .then(result => {
    console.log('Pipeline completed');
    console.log(JSON.stringify({
      runId: result.runId,
      status: result.status,
      durationMs: result.durationMs,
      stages: result.stages.map(s => ({ stage: s.stage, status: s.status })),
      summary: result.summary,
    }, null, 2));
  })
  .catch(err => {
    console.error('Pipeline failed', err);
    process.exit(1);
  });
