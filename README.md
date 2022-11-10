# Analyze GitHub Actions

This is essentially a dumping ground of scripts examining GitHub actions for
different needs / asks.

**Do not depend on this for anything production.**

## Annotations

[Context](https://www.notion.so/sentry/2022-11-GitHub-Action-Deprecations-f3279bb477e24995b32f0b27e399ec58)

### Examples

Run on a specific repo:

```sh
node annotations.js --commit=10 --repo=getsentry
```

Run on a specific repo with verbose output:

```sh
node annotations.js --commit=10 --repo=getsentry -v
```

Log all annotations, not just github deprecations:

```sh
node annotations.js --commit=10 --repo=getsentry --all-issues=true
```

Run on an all repos in getsentry and output csv:

```sh
node annotations.js --commit=10 --csv=annotations.csv
```


Future exploration: https://gist.github.com/asottile-sentry/894fa81c92b64165efee13c72af6c344
