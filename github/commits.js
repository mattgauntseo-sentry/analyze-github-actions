import {octokit} from './octokit.js';

export async function getLatestCommits(owner, repo, count=100) {
  const {data} = await octokit.repos.listCommits({
    owner,
    repo,
    per_page: count,
  });
  return data.map((d) => d.sha);
}
