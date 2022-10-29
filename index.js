import {logger} from '@gauntface/logger';
import * as fs from 'fs-extra';
import { writeFile, readFile } from 'node:fs/promises';
import * as path from 'path';
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

/* function emojiForCheckRun(cr) {
  switch (cr.conclusion) {
    case 'success':
      return '✅';
    case 'skipped':
      return '🫥';
    default:
      return `🤷 [${cr.conclusion}]`;
  }
}*/

function durationOfCheckRunMS(cr) {
  const start = Date.parse(cr.started_at);
  const end = Date.parse(cr.completed_at);
  const durationMillis = end - start;
  return durationMillis;
}

function avgDurations(crs) {
  let values = 0;
  for (const cr of crs) {
    values += durationOfCheckRunMS(cr);
  }
  return values / crs.length;
}



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

async function getCheckSuite(repo, ref) {
  const fp = path.join('checksuites', repo, `${ref}.json`)
  try {
    const b = await readFile(fp);
    return JSON.parse(b.toString());
  } catch(err) {
    // NOOP
    logger.error(`${repo}@${ref} => `, err);
    logger.log(`Downloading check suites ${repo}@${ref}`);
    const suites = await octokit.paginate(octokit.checks.listSuitesForRef, {
      owner: OWNER,
      repo,
      ref,
    });
    await fs.ensureFile(fp);
    await writeFile(fp, JSON.stringify(suites, null, 2));
    return suites;
  }
}

async function getCommitStatusesForCommit(repo, ref) {
  const fp = path.join('commitstatuses', repo, `${ref}.json`)
  try {
    const b = await readFile(fp);
    return JSON.parse(b.toString());
  } catch(err) {
    // NOOP
    logger.error(`${repo}@${ref} => `, err);
    logger.log(`Downloading commit statuses ${repo}@${ref}`);
    const statuses = await octokit.repos.listCommitStatusesForRef({
      owner: OWNER,
      repo,
      ref,
    });
    await fs.ensureFile(fp);
    await writeFile(fp, JSON.stringify(statuses, null, 2));
    return statuses;
  }
}

function logCheckRunsTimeSeries(checkRuns) {
  checkRuns.sort((a, b) => a.started_at - b.started_at);
  for (const cr of checkRuns) {
    console.log(`  ${new Date(cr.started_at_string).toLocaleTimeString()} [${durationString(cr.completed_at - cr.started_at)}] => ${cr.name}`);
  }
}

function logCheckRunsDuration(checkRuns) {
  checkRuns.sort((a, b) => a.name.localeCompare(b.name))
  for (const cr of checkRuns) {
    console.log(`${cr.name} => ${durationString(cr.completed_at - cr.started_at)}`);
  }
}

async function avgRunsForRepo(repo) {
  await reviewCheckSuites(repo, ['e77bd9e8ffd7a9478bfd760462fb8b742871ad1f']);
  /*

  await reviewCheckSuites(repo, commitRefs);*/
  // await reviewCheckRuns(repo, commitRefs);
  // await reviewCommitStatuses(repo, commitRefs);

  /* const allCheckRuns = {};
  const statusDurationGroups = {};

  for (const ref of commitRefs) {
    const {data} = await getCheckRunsForCommit(repo, ref);

    let start = null;
    let end = null;

    for (const cr of data.check_runs) {
      if (!allCheckRuns[cr.name]) {
        allCheckRuns[cr.name] = []
      }
      allCheckRuns[cr.name].push(cr);

      const s = Date.parse(cr.started_at);
      const e = Date.parse(cr.completed_at);
      if (start == null || s < start) {
        start = s;
      }
      if (end == null || e > end) {
        end = e;
      }
    }

    const group = getGroup(data.check_runs);

    if (!statusDurationGroups[group]) {
      statusDurationGroups[group] = [];
    }
    statusDurationGroups[group].push({
      check_runs: data.check_runs,
      start,
      end,
      duration: end - start,
    });
  }

  for (const key of  Object.keys(allCheckRuns).sort()) {
    const values = allCheckRuns[key];

    const d = avgDurations(values);

    logger.log(`${key} ${values.length} => ${durationString(d)}`);
  }

  console.log();

  for (const [key, values] of Object.entries(statusDurationGroups)) {
    let avgDuration = 0;
    for (const v of values) {
      avgDuration += v.duration;
    }
    avgDuration /= values.length;
    console.log(key, durationString(avgDuration));
    if (key == 'unknown') {
      console.log(`Unknown check list`);
      for (const v of values) {
        console.log(`${durationString(v.duration)}   ${new Date(v.start).toISOString()} => ${new Date(v.end).toISOString()}`);
        v.check_runs.sort((a, b) => b.started_at - a.started_at);
        for (const cr of v.check_runs) {
          console.log(`[${durationString(Date.parse(cr.completed_at) - Date.parse(cr.started_at))}]`);
          console.log(`\t${cr.name}`);
          console.log(`\t${cr.started_at} -> ${cr.completed_at}`);
          console.log(`\t${cr.html_url}`);
          console.log(`\t${cr.check_suite.id}`);
        }
        console.log('---------------------------');
      }
      console.log();
    }
  }*/
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
