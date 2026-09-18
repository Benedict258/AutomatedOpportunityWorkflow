import { UnifiedModelService } from '../../models/unified-service';
import { createIntelligencePipeline } from '../intelligence/pipeline';

async function runIntegrationTest() {
  console.log('=== Phase 4 Integration Test ===\n');

  const modelService = new UnifiedModelService();
  await modelService.initialize();

  const pipeline = createIntelligencePipeline(modelService);
  await pipeline.initialize();

  const testOpportunity = {
    externalId: 'test-001',
    rawData: `Senior Software Engineer at Acme Corp
We are looking for a Senior Software Engineer with 5+ years of experience in Python, React, and AWS.
Required: Python, React, AWS, 5+ years experience
Preferred: Kubernetes, TypeScript, GraphQL
Nice to have: PostgreSQL, Docker
Location: Remote (US time zones)
Salary: $150,000 - $200,000
Apply by: 2025-03-15
US Citizenship required`
  };

  const testCandidate = {
    id: 'candidate-001',
    citizenship: 'US',
    education: [{ degree: 'Masters', field: 'Computer Science' }],
    skills: [
      { name: 'Python', years: 7 },
      { name: 'React', years: 5 },
      { name: 'AWS', years: 4 },
      { name: 'TypeScript', years: 3 },
      { name: 'Kubernetes', years: 2 }
    ],
    experience: [
      { title: 'Senior Engineer', years: 5, technologies: ['Python', 'React', 'AWS'] },
      { title: 'Software Engineer', years: 3, technologies: ['Java', 'Spring'] }
    ],
    locationPreferences: ['Remote'],
    remotePreference: true,
    careerGoals: ['Technical Leadership', 'AI/ML'],
    domains: ['Web Development', 'Cloud Computing']
  };

  console.log('Running full intelligence pipeline...\n');

  const result = await pipeline.run({
    rawDocument: testOpportunity,
    candidateProfile: testCandidate,
    opportunityId: 'test-001',
    candidateId: 'candidate-001'
  });

  console.log('=== EXTRACTION ===');
  console.log(`Title: ${result.extraction.fields?.title}`);
  console.log(`Org: ${result.extraction.fields?.organization}`);
  console.log(`Skills: ${result.extraction.fields?.skills?.join(', ')}`);
  console.log(`Confidence: ${result.extraction.confidence}`);

  console.log('\n=== CLASSIFICATION ===');
  console.log(`Primary: ${result.classification[0]?.categoryId}`);
  console.log(`Confidence: ${result.classification[0]?.confidence?.score}`);

  console.log('\n=== REQUIREMENTS ===');
  console.log(`Total: ${result.requirements.requirements?.length}`);
  result.requirements.requirements?.forEach((r: any) => {
    console.log(`  ${r.requirement}: ${r.type} (confidence: ${r.confidence})`);
  });

  console.log('\n=== ELIGIBILITY ===');
  console.log(`Status: ${result.eligibility.overall}`);
  result.eligibility.decisions?.forEach((d: any) => {
    console.log(`  ${d.requirement}: ${d.state} - ${d.reason}`);
  });

  console.log('\n=== CANDIDATE INTELLIGENCE ===');
  console.log(`Derived Skills: ${result.candidateIntelligence.derivedProfile?.technicalSkills?.map((s: any) => s.name).join(', ')}`);
  console.log(`Career Goals: ${result.candidateIntelligence.derivedProfile?.careerGoals?.join(', ')}`);

  console.log('\n=== SEMANTIC MATCH ===');
  console.log(`Skill Similarity: ${result.semanticMatch.factors.skillSimilarity.toFixed(2)}`);
  console.log(`Career Similarity: ${result.semanticMatch.factors.careerSimilarity.toFixed(2)}`);
  console.log(`Weighted Score: ${result.semanticMatch.weightedScore.toFixed(2)}`);

  console.log('\n=== SCORING ===');
  console.log(`Final Score: ${result.scoring.finalScore.toFixed(3)}`);
  console.log(`Hard Eligibility: ${result.scoring.hardEligibility}`);
  console.log(`Weighted Match: ${result.scoring.weightedMatchScore.toFixed(3)}`);
  result.scoring.factors?.forEach((f: any) => {
    console.log(`  ${f.name}: ${f.normalizedScore.toFixed(2)} (weight: ${f.weight})`);
  });

  console.log('\n=== VALUE ===');
  console.log(`Composite: ${result.value.compositeScore.toFixed(2)}`);

  console.log('\n=== TIMING ===');
  console.log(`Actionability: ${result.timing.actionability.toFixed(2)}`);
  console.log(`Days to Deadline: ${result.timing.deadlineDistanceDays}`);

  console.log('\n=== RANKING ===');
  console.log(`Rank: ${result.ranking[0]?.rank}`);

  console.log('\n=== EXPLANATION ===');
  console.log(`Summary: ${result.explanation.summary}`);
  console.log(`Strengths: ${result.explanation.strengths?.join(', ')}`);
  console.log(`Gaps: ${result.explanation.gaps?.join(', ')}`);
  console.log(`Preparation: ${result.explanation.preparation?.join(', ')}`);
  console.log(`Uncertainties: ${result.explanation.uncertainties?.join(', ')}`);

  console.log('\n=== PROVENANCE ===');
  console.log(JSON.stringify(result.provenance, null, 2));

  await pipeline.shutdown();
  await modelService.shutdown();

  console.log('\n✅ Integration test completed successfully!');
}

runIntegrationTest().catch(console.error);