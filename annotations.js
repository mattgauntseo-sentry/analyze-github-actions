import { logger } from '@gauntface/logger';
import meow from 'meow';
import {getCheckRunsForCommit, cleanupCheckRuns, getCheckRunAnnotations} from './github/checkruns.js';
import {getLatestCommits} from './github/commits.js';
import { octokit } from './github/octokit.js';

const OWNER = 'getsentry';

const cli = meow({
  importMeta: import.meta,
	flags: {
    repo: {
      type: 'string',
    },
    'commits': {
      type: 'number',
      default: 10,
    },
    verbose: {
      type: 'boolean',
      alias: 'v',
    }
	}
});

async function getCommits(org, repo) {
  return await getLatestCommits(org, repo, cli.flags.commits);
}

const annotationsMsgFilter = [
  /^React Hook useEffect has a missing dependency/,
  /^React Hook useEffect has missing dependencies/,
  /^React Hook useCallback has a missing dependency/,
  /^React Hook useCallback has missing dependencies/,
  /^'before' field is missing in event payload - changes will be detected from last commit$/,
  /^Process completed with exit code \d*.$/,
  /^It took \d* tries to successfully aquire a Unity license/,
];
function filterOutAnnotationMessage(msg) {
  for (const r of annotationsMsgFilter) {
    if (msg.match(r)) {
      return true;
    }
  }
  return false;
}

const urlReg = /.*(https:\/\/github.blog\/changelog\/[^\/]*\/).*/;
function idFromAnnotationMsg(msg) {
  const m = msg.match(urlReg);
  if (!m) {
    return msg;
  }
  return m[1];
}

const actionsReg = /.*Please update the following actions [^:]*:\s*(.*)/;
function actionsFromMsg(msg) {
  const m = msg.match(actionsReg);
  if (!m) {
    return [];
  }
  return m[1].split(", ");
}

async function logAnnotations(owner, repo, checkRuns) {
  const issues = {};
  for (const cr of checkRuns) {
    if (cr.output.annotations_count == 0) {
      continue;
    }

    const annotations = await getCheckRunAnnotations(owner, repo, cr.id);
    for (const a of annotations) {
      if (filterOutAnnotationMessage(a.message)) {
        continue;
      }

      const id = idFromAnnotationMsg(a.message);
      if (!issues[id]) {
        issues[id] = {
          count: 0,
          id: id,
          message: a.message,
          annotations: [],
          checkRuns: {},
          actions: [],
        };
      }
      issues[id].count++;
      issues[id].annotations.push(a);
      issues[id].checkRuns[cr.name] = cr;
      const as = actionsFromMsg(a.message);
      for (const ac of as) {
        if (issues[id].actions.indexOf(ac) == -1) {
          issues[id].actions.push(ac);
        }
      }
    }
  }
  const issuesArr = [];
  for (const i of Object.values(issues)) {
    issuesArr.push(i);
  }

  if (issuesArr.length == 0 && cli.flags.verbose) {
    console.log(`✅ ${owner}/${repo}`);
    console.log();
  }

  if (issuesArr.length == 0) {
    return;
  }

  console.log(`❌ ${owner}/${repo}`);

  issuesArr.sort((a, b) => b.count - a.count);

  if (cli.flags.verbose) {
    for (const i of issuesArr) {
      console.log(`    (${i.count}) ${i.id}`);
      console.log(`        Affected Check Runs:`);
      for (const cr of Object.values(i.checkRuns)) {
        console.log(`            ${cr.name}: ${cr.html_url}`);
      }
      if (i.actions.length > 0) {
        console.log(`        Affected Actions:`);
        for (const a of i.actions) {
          console.log(`            ${a}`);
        }
      }
      console.log();
    }
  }

  for (const i of issuesArr) {
    console.log(`    🟡 (${i.count}) ${i.id}`);
  }
  console.log();
}

async function analyzeCommits(repo, commits) {
  const checkRuns = [];
  for (const c of commits) {
    const crs = cleanupCheckRuns(
      await getCheckRunsForCommit(OWNER, repo, c)
    );
    if (!crs) {
      continue;
    }

    checkRuns.push(...crs);
  }

  logAnnotations(OWNER, repo, checkRuns);
}

async function runOnRepo(org, repo) {
  const commits = await getCommits(org, repo);
  await analyzeCommits(repo, commits);

}

async function runOnOrg(org) {
  if (cli.flags.repo) {
    return runOnRepo(org, cli.flags.repo);
  }

  const repos = await octokit.paginate(octokit.repos.listForOrg, {
    org,
  })
  repos.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of repos) {
    await runOnRepo(org, r.name);
  }

  console.log();
  console.log('Run this command it `-v` for full details and links for issues.');
  console.log();
}

logger.setLogLevel(cli.flags.verbose ? 0 : 2);

runOnOrg(OWNER);
