# Next.js development navigation

`next@15.5.9.patch` skips loading `dynamic-css-manifest.json` in development. Next.js only emits this manifest for production Pages Router builds, but its loader retries the missing file twice with 100 ms waits. Our locale fallback loads page components twice, adding about 400 ms to each route-data request.

The patch adds the missing `isDev` check in both CommonJS and ESM builds. Production loading is unchanged. pnpm applies it through `patchedDependencies`; restart the dev server after installing it.

Remove this patch when Next.js includes the equivalent fix. The loader in 15.5.25 still has the same condition.
