import meow from 'meow';
import {getCheckRunsForCommit, cleanupCheckRuns, getCheckRunAnnotations} from './github/checkruns.js';
import {getLatestCommits} from './github/commits.js';
import { octokit } from './github/octokit.js';
import {createObjectCsvWriter} from 'csv-writer';

const cli = meow({
  importMeta: import.meta,
	flags: {
    org: {
      type: 'string',
      default: 'getsentry',
    },
    repo: {
      type: 'string',
    },
    commits: {
      type: 'number',
      default: 10,
    },
    verbose: {
      type: 'boolean',
      alias: 'v',
    },
    allIssues: {
      type: 'boolean',
      default: false,
    },
    csv: {
      type: 'string',
    }
	}
});

async function getCommits(org, repo) {
  return await getLatestCommits(org, repo, cli.flags.commits);
}

const urlReg = /.*(https:\/\/github.blog\/changelog\/[^\/]*\/).*/;
function githubURLFromMsg(msg) {
  const m = msg.match(urlReg);
  if (!m) {
    return null;
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

async function processAnnotations(owner, repo, checkRuns) {
  const issues = {};
  for (const cr of checkRuns) {
    if (cr.output.annotations_count == 0) {
      continue;
    }

    const annotations = await getCheckRunAnnotations(owner, repo, cr.id);
    for (const a of annotations) {
      const ghurl = githubURLFromMsg(a.message);
      if (!ghurl && !cli.flags.allIssues) {
        continue;
      }

      const id = ghurl || a.message;
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
  issuesArr.sort((a, b) => b.count - a.count);
  return issuesArr;
}

async function logAnnotations(owner, repo, annotations) {
  if (annotations.length == 0 && cli.flags.verbose) {
    console.log(`✅ ${owner}/${repo}`);
    console.log();
  }

  if (annotations.length == 0) {
    return;
  }

  console.log(`❌ ${owner}/${repo}`);

  if (cli.flags.verbose) {
    for (const i of annotations) {
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

  for (const i of annotations) {
    console.log(`    🟡 (${i.count}) ${i.id}`);
  }
  console.log();
}

async function analyzeCommits(owner, repo, commits) {
  const checkRuns = [];
  for (const c of commits) {
    const crs = cleanupCheckRuns(await getCheckRunsForCommit(owner, repo, c));
    if (!crs) {
      continue;
    }

    checkRuns.push(...crs);
  }

  const annotations = await processAnnotations(owner, repo, checkRuns);
  logAnnotations(owner, repo, annotations);
  return annotations;
}

async function saveCSV(org, repoannotations) {
  if (!cli.flags.csv) {
    return;
  }

  const header = [
    { id: 'org', title: 'Owner' },
    { id: 'repo', title: 'Repo' },
    { id: 'count', title: 'Issue Count' },
    { id: 'links', title: 'Issue Link / Description' },
    { id: 'actions', title: 'Affected Actions' },
    { id: 'example_runs', title: 'Example runs' },
  ];
  const data = [];
  for (const [repo, ras] of Object.entries(repoannotations)) {
    if (ras.length == 0) {
      data.push({
        org,
        repo,
        count:0,
      });
      continue;
    }

    for (const ra of ras) {
      data.push({
        org,
        repo,
        count: ra.count,
        links: ra.id,
        actions: ra.actions.join("\n"),
        example_runs: Object.values(ra.checkRuns).map(cr => cr.html_url).join("\n"),
      });
    }

    const csvWriter = createObjectCsvWriter({
      path: cli.flags.csv,
      header,
    });
    await csvWriter.writeRecords(data);
  }
  console.log(`CSV file written: ${cli.flags.csv}`);
}

async function runOnRepo(org, repo) {
  const commits = await getCommits(org, repo);
  return await analyzeCommits(org, repo, commits);
}

async function runOnRepos(org, repos) {
  const ra = {};
  for (const r of repos) {
    const annotations = await runOnRepo(org, r);
    ra[r] = annotations;
  }
  await saveCSV(org, ra);
}

async function main(org) {
  if (cli.flags.repo) {
    return await runOnRepos(org, [cli.flags.repo]);
  }

  const repos = await octokit.paginate(octokit.repos.listForOrg, {
    org,
  })
  const reponames = repos.map(r => r.name)
  reponames.sort((a, b) => a.localeCompare(b));
  await runOnRepos(org, reponames);
}

main(cli.flags.org);
