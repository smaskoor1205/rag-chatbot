# Test Strategy

The project keeps executable tests inside each workspace:

- `server/src/**/*.test.ts` covers API, service, repository, and ingestion behavior.
- `client/src/**/*.test.tsx` covers UI state and rendering behavior.

Run all tests with:

```bash
npm run test
```
