import { DiscoveryRunRecord, RunSummary, RunStatus } from './types';
import { RunPersistence } from './run-persistence';
import fs from 'fs';
import path from 'path';

/**
 * Generates run summaries and report artifacts.
 * Observability by design: structured outputs with request IDs.
 */
export class RunReporter {
  private persistence: RunPersistence;
  private outputDir: string;

  constructor(persistence: RunPersistence, outputDir?: string) {
    this.persistence = persistence;
    this.outputDir = outputDir ?? path.resolve(process.cwd(), 'reports', 'discovery-runs');
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateRunSummary(runId: string): Promise<RunSummary> {
    const record = await this.persistence.getRun(runId);
    if (!record) {
      throw new Error(`Run ${runId} not found`);
    }

    const durationMs = record.metrics.durationMs ?? (record.startedAt && record.completedAt
      ? new Date(record.completedAt).getTime() - new Date(record.startedAt).getTime()
      : undefined);

    const summaryText = this.buildSummaryText(record, durationMs);

    const summary: RunSummary = {
      runId: record.runId,
      status: record.status,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      durationMs,
      metrics: record.metrics,
      summary: summaryText,
    };

    return summary;
  }

  async generateRunReport(runId: string): Promise<string> {
    const record = await this.persistence.getRun(runId);
    if (!record) {
      throw new Error(`Run ${runId} not found`);
    }

    const summary = await this.generateRunSummary(runId);
    const report = this.formatMarkdownReport(record, summary);

    const filename = `run-${runId}-${Date.now()}.md`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, report, 'utf-8');

    return filepath;
  }

  async generateBatchReport(runIds: string[]): Promise<string> {
    const reports = [];
    for (const runId of runIds) {
      try {
        const summary = await this.generateRunSummary(runId);
        reports.push(summary);
      } catch {
        // skip missing
      }
    }

    const batchReport = this.formatBatchReport(reports);
    const filename = `batch-report-${Date.now()}.md`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, batchReport, 'utf-8');

    return filepath;
  }

  private buildSummaryText(record: DiscoveryRunRecord, durationMs?: number): string {
    const { status, metrics } = record;
    const parts = [
      `Run ${record.runId} completed with status ${status}.`,
      `Sources: ${metrics.sourcesSucceeded} succeeded, ${metrics.sourcesFailed} failed, ${metrics.sourcesSkipped} skipped of ${metrics.totalSources} requested.`,
      `Items discovered: ${metrics.itemsDiscovered}`,
    ];
    if (durationMs !== undefined) {
      parts.push(`Duration: ${durationMs}ms`);
    }
    if (record.error) {
      parts.push(`Error: ${record.error}`);
    }
    return parts.join(' ');
  }

  private formatMarkdownReport(record: DiscoveryRunRecord, summary: RunSummary): string {
    return `# Discovery Run Report

**Run ID:** ${record.runId}
**Job ID:** ${record.jobId ?? 'N/A'}
**Status:** ${record.status}
**Triggered By:** ${record.triggeredBy ?? 'system'}
**Scheduled At:** ${record.scheduledAt ?? 'N/A'}
**Started At:** ${record.startedAt ?? 'N/A'}
**Completed At:** ${record.completedAt ?? 'N/A'}
**Duration (ms):** ${summary.durationMs ?? 'N/A'}

## Metrics

| Metric | Value |
|---|---|
| Total Sources | ${record.metrics.totalSources} |
| Succeeded | ${record.metrics.sourcesSucceeded} |
| Failed | ${record.metrics.sourcesFailed} |
| Skipped | ${record.metrics.sourcesSkipped} |
| Items Discovered | ${record.metrics.itemsDiscovered} |
| Items Deduplicated | ${record.metrics.itemsDeduplicated} |
| Errors Count | ${record.metrics.errorsCount} |
| Warnings Count | ${record.metrics.warningsCount} |
| API Calls Made | ${record.metrics.apiCallsMade ?? 'N/A'} |
| Bytes Processed | ${record.metrics.bytesProcessed ?? 'N/A'} |

## Sources Requested
${record.sourcesRequested.map(s => `- ${s}`).join('\n')}

## Sources Completed
${record.sourcesCompleted.map(s => `- ${s}`).join('\n') || '_None_'}

## Summary
${summary.summary}

## Metadata
\`\`\`json
${JSON.stringify(record.metadata ?? {}, null, 2)}
\`\`\`

---
Generated at ${new Date().toISOString()}
`;
  }

  private formatBatchReport(summaries: RunSummary[]): string {
    const header = `# Discovery Runs Batch Report
Generated at ${new Date().toISOString()}

| Run ID | Status | Started | Completed | Duration ms | Sources Success | Items Discovered |
|---|---|---|---|---|---|---|
`;
    const rows = summaries.map(s => {
      return `| ${s.runId} | ${s.status} | ${s.startedAt ?? '-'} | ${s.completedAt ?? '-'} | ${s.durationMs ?? '-'} | ${s.metrics.sourcesSucceeded}/${s.metrics.totalSources} | ${s.metrics.itemsDiscovered} |`;
    }).join('\n');

    return `${header}${rows}\n`;
  }
}
