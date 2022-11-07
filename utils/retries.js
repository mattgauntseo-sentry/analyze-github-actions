import {sleep} from '../utils/sleep.js';

export async function retryTask(maxRetries, func) {
  let e;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await func();
    } catch (err) {
      console.log(err);
      e = err;
      if (i+1 < maxRetries) {
        // GitHub gets cranky if you call the API too frequently
        await sleep(2000);
      }
    }
  }
  throw e
}
