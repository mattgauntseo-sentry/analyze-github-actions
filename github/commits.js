import {octokit} from './octokit.js';
import {retryTask} from '../utils/retries.js';

const MAX_RETRIES = 5;

export async function getLatestCommits(owner, repo, count=100) {
  const commits = await retryTask(MAX_RETRIES, async function() {
    try {
      const {data} = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: count,
      });
      return data.map((d) => d.sha);
    } catch (err) {
      if (err.status == 409) {
        return [];
      }
      throw err;
    }
  })
  return commits;


}
