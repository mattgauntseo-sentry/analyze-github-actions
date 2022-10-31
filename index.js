import meow from 'meow';
import {getCheckRunsForCommit, cleanupCheckRuns} from './github/checkruns.js';
import {getLatestCommits} from './github/commits.js';
import {logCheckRuns, logLongestCheckRun, logCheckRunGroupingAvgs} from './logging/checkruns.js';

const OWNER = 'getsentry';

const cli = meow({
  importMeta: import.meta,
	flags: {
    repo: {
      type: 'string',
      isRequired: true,
    },
		commit: {
			type: 'string',
		},
    verbose: {
      type: 'boolean',
      alias: 'v',
    }
	}
});

function getGroupForCheckRuns(checkruns) {
  let fe = false;
  let be = false;
  for (const cr of checkruns) {
    if (cr.name.indexOf('frontend tests') !== -1) {
      fe = true;
    }
    if (cr.name.indexOf('backend test') !== -1) {
      be = true;
    }
  }
  if (fe && be) {
    return 'frontend and backend';
  } else if (fe) {
    return 'frontend';
  } else if (be) {
    return 'backend';
  }

  return 'unknown';
}

async function getCommits(repo) {
  if (cli.flags.commit) {
    return [cli.flags.commit];
  }

  console.log(`Getting latest commits for ${repo}`);
  return await getLatestCommits(OWNER, repo);
}

function getFirstAndLastCheckRun(checkRuns) {
  let first = null;
  let last = null;
  for (const cr of checkRuns) {
    const s = cr.started_at;
    const e = cr.completed_at;
    if (first == null || s < first.started_at) {
      first = cr;
    }
    if (last == null || e > last.completed_at) {
      last = cr;
    }
  }
  return {first, last}
}

async function analyzeCommit(repo, ref) {
  const checkRuns = cleanupCheckRuns(
    await getCheckRunsForCommit(OWNER, repo, ref)
  );
  if (!checkRuns || checkRuns.length == 0) {
    return null;
  }

  if (cli.flags.verbose) {
    logCheckRuns(OWNER, repo, ref, checkRuns);
  }

  const {first, last} = getFirstAndLastCheckRun(checkRuns);
  return {
    checkRuns,
    ref,
    first,
    last,
    duration: last.completed_at - first.started_at,
    group: getGroupForCheckRuns(checkRuns),
  };
}

function medianValue(arr) {
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 == 0) {
    return (arr[mid-1] + arr[mid]) / 2;
  }
  return arr[mid];
}

function quantile(arr, q) {
  const sorted = arr.sort();
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
      return sorted[base];
  }
};

function analyzeCheckRunGroups(checkRuns) {
  const groupingValues = {};
  for (const cr of checkRuns) {
    if (!groupingValues[cr.group]) {
      groupingValues[cr.group] = {
        totalDuration: 0,
        checkRunsCount: 0,
        durations: [],
      };
    }
    groupingValues[cr.group].totalDuration += cr.duration;
    groupingValues[cr.group].checkRunsCount++;
    groupingValues[cr.group].durations.push(cr.duration);
  }

  for (const [key, value] of Object.entries(groupingValues)) {
    groupingValues[key].durations.sort();

    groupingValues[key].meanDuration = value.totalDuration / value.checkRunsCount;
    groupingValues[key].medianDuration = medianValue(value.durations);
    groupingValues[key].q75 = quantile(value.durations, 0.75);
    groupingValues[key].q90 = quantile(value.durations, 0.90);
  }

  logCheckRunGroupingAvgs(groupingValues);
}

async function analyzeCommits(repo, commits) {
  let longest = null;
  const checkRuns = [];
  for (const c of commits) {
    const results = await analyzeCommit(repo, c);
    if (!results) {
      continue;
    }

    checkRuns.push(results);
    if (longest == null || longest.duration < results.duration) {
      longest = results;
    }
  }
  if (!longest) {
    throw new Error('Failed to get a longest check run.');
  }

  // Add new line in case node logs warnings from fetch
  console.log();

  logLongestCheckRun(OWNER, repo, longest);
  analyzeCheckRunGroups(checkRuns);
}

async function runOnRepo(repo) {
  console.log(`----------------------------------`);
  console.log(`        ${OWNER}/${repo}`);
  console.log(`----------------------------------`);
  const commits = await getCommits(repo);
  console.log(`Examining ${commits.length} commit(s)`);
  await analyzeCommits(repo, commits);

}
runOnRepo(cli.flags.repo);
