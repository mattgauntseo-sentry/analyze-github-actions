import {octokit} from './octokit.js';

export async function getLatestCommits(owner, repo) {
  const {data} = await octokit.repos.listCommits({
    owner,
    repo,
    per_page: 100,
  });
  return data.map((d) => d.sha);
}
