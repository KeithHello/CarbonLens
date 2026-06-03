# CarbonLens Demo Data

CarbonLens uses MongoDB Atlas for demo-ready data.

## Restore Demo State

Run:

```bash
npm run reset:demo
```

This restores:

- `emission_factors`: base emission factor data from `data/emission_factors.json`
- `global_benchmarks`: base benchmark data from `data/global_benchmarks.json`
- `user_profiles`: one demo profile for `user_id=default`
- `user_entries`: deterministic demo carbon reports for history and report pages,
  including 200+ records across all current categories.

Use this before demos when the app should already show enough history data.

## Restore Empty Initial State

Run:

```bash
npm run reset:empty
```

This keeps only base factor and benchmark collections, and clears all user
profiles and user entries.

## Verify

With the local server running:

```bash
npm run test:api
```

Or open:

```text
http://localhost:3001/history
```

The demo user is:

```text
user_id=default
```
