import {logger} from '@gauntface/logger';
import {octokit} from './octokit.js';

import {getCachedData, setCachedData} from './cache.js';


const CATEGORY = 'checkruns';

export async function getCheckRunsForCommit(owner, repo, ref) {
  const d = await getCachedData(CATEGORY, owner, repo, ref);
  if (d) {
    return d;
  }

  logger.log(`Downloading check runs ${owner}/${repo}@${ref}`);
  const checks = await octokit.paginate(octokit.checks.listForRef, {
    owner: owner,
    repo,
    ref,
    per_page: 100,
  });

  await setCachedData(CATEGORY, owner, repo, ref, checks);
  return checks;
}

export function cleanupCheckRuns(checkRuns) {
  const finalRuns = [];
  const filterNames = [
    // Scheduled
    'lock',
    'Analyze (python)',
    'Analyze (javascript)',

    // Triggered via workflow
    'visual-diff',
    'detect what files changed',

    // Issue / PR comment
    'test getsentry',
    'unroute-new-issue',
    'route',
    'ensure_one_status',
    'stale',
  ];
  for (const cr of checkRuns) {
    if (filterNames.indexOf(cr.name) != -1) {
      continue;
    }

    cr.started_at_string = cr.started_at;
    cr.started_at = Date.parse(cr.started_at);
    cr.completed_at_string = cr.completed_at;
    cr.completed_at = Date.parse(cr.completed_at);

    cr.duration = cr.completed_at - cr.started_at;
    finalRuns.push(cr);
  }
  return finalRuns;
}
