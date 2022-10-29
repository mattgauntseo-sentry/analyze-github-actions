import {logger} from '@gauntface/logger';
import { Octokit } from '@octokit/rest';

const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];

if (!GITHUB_TOKEN) {
  logger.error('Please define a GITHUB_TOKEN.');
  throw new Error('No GITHUB_TOKEN.');
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});
export {octokit};
