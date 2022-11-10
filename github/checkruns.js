import {octokit} from './octokit.js';
import {getCachedData, setCachedData} from './cache.js';

const CATEGORY = 'checkruns';
const CATEGORY_ANNOTATIONS = 'checkruns-annotations';

export async function getCheckRunsForCommit(owner, repo, ref) {
  const d = await getCachedData(CATEGORY, owner, repo, ref);
  if (d) {
    return d;
  }

  console.debug(`Getting check runs for ${owner}/${repo} @ ${ref}`);
  try {
    console.debug(`Downloading check runs ${owner}/${repo}@${ref}`);
    const checks = await octokit.paginate(octokit.checks.listForRef, {
      owner: owner,
      repo,
      ref,
      status: 'completed',
      per_page: 100,
    });

    await setCachedData(CATEGORY, owner, repo, ref, checks);
    return checks;
  } catch (err) {
    console.warn(`Failed to get check runs for ${owner}/${repo} @ ${ref}`);
  }
  return [];

}

export async function getCheckRunAnnotations(owner, repo, crID) {
  const d = await getCachedData(CATEGORY_ANNOTATIONS, owner, repo, crID);
  if (d) {
    return d;
  }

  console.debug(`Downloading check run annotationss ${owner}/${repo}@${crID}`);
  const annotations = await octokit.paginate(octokit.checks.listAnnotations, {
    owner: owner,
    repo,
    check_run_id: crID,
    per_page: 100,
  });

  await setCachedData(CATEGORY_ANNOTATIONS, owner, repo, crID, annotations);
  return annotations;
}

export function cleanupCheckRuns(checkRuns) {
  const finalRuns = [];
  const filterNames = [
    // Scheduled
    'lock',
    'bootstrap',
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
    if (cr.status != 'completed') {
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
