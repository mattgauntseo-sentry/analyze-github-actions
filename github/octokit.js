import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';

const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];

if (!GITHUB_TOKEN) {
  console.error('Please define a GITHUB_TOKEN.');
  throw new Error('No GITHUB_TOKEN.');
}

const MyOctokit = Octokit.plugin(throttling);

const octokit = new MyOctokit({
  auth: GITHUB_TOKEN,
	throttle: {
    onRateLimit: (retryAfter, options) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );

      // Retry twice after hitting a rate limit error, then give up
      if (options.request.retryCount <= 2) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onAbuseLimit: (retryAfter, options) => {
      octokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`
      );

			// Retry twice after hitting a rate limit error, then give up
      if (options.request.retryCount <= 2) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
			}
    },
  },
});
export {octokit};
