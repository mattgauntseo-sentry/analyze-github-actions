import {durationString} from './duration.js';

export function logLongestCheckRun(owner, repo, longest) {
  console.log(`Longest Check Runs for all commit(s)`);
  console.log(`    Commit:      https://github.com/${owner}/${repo}/commit/${longest.ref}`);
  console.log(`    Duration:    ${durationString(longest.duration)}`);
  console.log(`    Check Runs:  ${longest.checkRuns.length}`);
  console.log(`    First Check: ${longest.first.started_at_string} -> ${longest.first.name}`);
  console.log(`    Last Check:  ${longest.last.completed_at_string} -> ${longest.last.name}`);
  console.log();
}

export function logCheckRuns(owner, repo, ref, checkRuns) {
  console.log(`All check runs for ${owner}/${repo} @ ${ref}`);
  checkRuns.sort((a, b) => a.name.localeCompare(b.name));
  for (const cr of checkRuns) {
    console.log(`  - ${cr.name} -> ${durationString(cr.duration)}`);
  }
  console.log();
}

export function logCheckRunGroupingAvgs(groupingValues) {
  for (const [key, value] of Object.entries(groupingValues)) {
    console.log(`Avergages for ${key}...........`);
    console.log(`    Mean:   ${durationString(value.meanDuration)}`);
    console.log(`    Median: ${durationString(value.medianDuration)}`);
    console.log(`    Q75:    ${durationString(value.q75)}`);
    console.log(`    Q90:    ${durationString(value.q90)}`);
    console.log();
  }
}
