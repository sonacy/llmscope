# Releasing llmscope

## Cadence

Release-on-tag. Cut a tag like `v0.1.0` from `main`; the GitHub Actions workflow at `.github/workflows/release.yml` runs typecheck + tests + UI build, then creates a GitHub release with:

- The single-file `packages/llmscope-mitmproxy/addon.py`
- A SHA256 sums file (`addon.py.sha256`)
- Auto-generated release notes from PR titles since the previous tag

```sh
# from main, after PR merged:
git tag v0.1.0
git push origin v0.1.0
```

## Verifying the addon hash

```sh
shasum -a 256 ~/.llmscope/mitmproxy_addon.py
# compare to the SHA256 in the GitHub release notes
```

## npm publish (manual, post-1.0)

Auto-publish is wired but commented in `release.yml`. To enable:

1. Add `NPM_TOKEN` secret in repo settings (scope `automation`, allow `@llmscope/cli`).
2. Uncomment the `npm-publish` job.
3. Push a tag — the publish runs after the GitHub release is created.

For v1, publish manually:

```sh
cd packages/cli
npm publish --access public
```

The `cli` package's `bin` field exposes `llmscope`; once published, users install with `bunx llmscope` or `npm i -g @llmscope/cli`.

## Whistle plugin publishing

The whistle plugin is `whistle.llmscope` (the `whistle.<name>` convention). Publish from `packages/whistle-llmscope`:

```sh
cd packages/whistle-llmscope
npm publish --access public
```

Once on npm, users skip the local install step: `w2 add whistle.llmscope`.
