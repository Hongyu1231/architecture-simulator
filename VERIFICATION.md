# Verification report

Verified on 21 September 2026 on Windows using Node 24.11.1, npm 11.6.2, Python 3.12.14, and Chromium through Playwright CLI.

## Changes and issues fixed

- Aborted requests and polling when the topology changes or the app unmounts; guarded against stale results restoring a cleared trace. Duplicate launches are blocked immediately.
- Added a 45-second overall deadline, including hung network requests, runtime API response validation, simulation ID checks, and concise errors with backend startup guidance. Errors clear stale simulation status and permit retry.
- Improved whitespace, case, quoted endpoint, empty input, and long-label handling. New-node placement avoids existing rectangles, including dragged nodes. Deleting a node removes all attached architecture edges.
- Kept architecture connections and simulation connections on separate handles. Solid architecture edges remain separate from dashed traces. Active source, target, and trace edge are highlighted; node labels stay above paths.
- Made the chat history viewport independently scrollable, kept the latest response visible, added accessibility status/error announcements, and fitted the canvas after topology changes and window resizing. History entries remain in memory until refresh.
- Added a dependency lockfile, 15 lightweight tests, a favicon, expanded ignore rules, complete README, and a realistic recording script.

The supplied `simulation_service.py` is unchanged. SHA256, verified against the original ZIP:

```text
bb6d1209a854ba18f340bf1d7867d233c09e434afb13f1cb5240a0cb1507183d
```

## Commands actually executed

```text
npm install
npm test
npm run build
python -m pip install fastapi uvicorn
python -m uvicorn simulation_service:app --reload --host 127.0.0.1 --port 8000
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
npm run preview -- --host 127.0.0.1 --port 4175 --strictPort
npx --yes --package @playwright/cli playwright-cli ...
```

On this Windows host, npm/npx were invoked using their `.cmd` launchers. Python was invoked by its bundled absolute executable path because `python` was not on PATH. The README uses portable commands for a normal Python installation. Preview port 4173 was already occupied, so verification used 4175. No lint script was configured.

## Results

| Check | Result |
| --- | --- |
| Dependency installation | Passed; npm reported zero vulnerabilities. |
| TypeScript and production build | Passed; after the loading UI update, Vite built 196 modules with no compile/build errors. |
| Built-app preview | Passed on port 4175: real service run produced two trace edges, with zero browser console errors. |
| Unit tests | 15 passed: 9 parser/layout tests and 6 API/polling tests. |
| Backend health | HTTP 200, `{"status":"ok"}`. |
| Invalid backend requests | Empty node list → HTTP 400; unknown simulation ID → HTTP 404. |
| Real backend runs | 1, 2, and 4 nodes: HTTP 202 queued, running, then completed in 15.140–15.141 seconds; respectively 0, 1, and 3 edges. Schema and metrics validated. |
| UI command tests | 21 scenarios passed, including all required exact command forms, case/whitespace, spaced labels, duplicates, missing nodes/edges, self-connections, malformed/empty input, and multi-edge deletion cleanup. |
| Real UI API integration | Four-node run completed in 15.261 seconds in the final regression. One POST and 15 sequential GETs; request contained only `id` and `type`. Queued, running, and completed observed. Polling stopped afterward. |
| Trace separation | Three returned edges rendered while the architecture remained at one edge. Returned paths absent from architecture were displayed normally. |
| Step exploration | All steps checked against actual API edge data. Correct source/target highlighted, exactly one red current trace edge, step count, latency, packets, and status. Previous/Next boundaries and reverse navigation passed. |
| Small and empty architectures in UI | One node → empty trace; two nodes → one step with both navigation controls disabled. Zero nodes → Run disabled. Actual service waits were 15.337 and 15.296 seconds. |
| UI errors | Real backend 400 and 404 triggered by forwarding invalid requests; polling connection refusal and offline mode injected in the browser. Useful alert, error state, retry, and no stale overlay verified. |
| Cancellation | Topology edit stopped polling; waited 17 more seconds and confirmed no stale trace reappeared. Reload stopped old polling too. |
| Desktop and narrow layout | Checked at 1440×900, 800×900, and 375×900. No horizontal document overflow; all nodes fitted the canvas and step controls remained reachable. Screenshots visually inspected. |
| Source integrity and cleanup | No frontend simulation implementation, LLM dependency, API key, database, authentication, debugging logs, or TODO placeholders added. |

Unit tests use isolated response fixtures and an accelerated timeout timer; successful browser runs and the recording use the unchanged real service. The 15-second service delay was never shortened. Fault injection was limited to error testing, outside application code.

## Limits and submission

The project is designed for local review with two running processes. A deployed static build needs a same-origin `/api` reverse proxy. Architecture/chat state resets on refresh; the supplied backend stores jobs only in memory. Cancelling in the frontend does not cancel a job already accepted by the external service. Labels are limited to 80 characters; quote endpoints containing separator words. Direct canvas connection creation and keyboard deletion are intentionally disabled in favor of validated text commands.

Browser verification used Chromium; Firefox and Safari were not tested. The included WebM recording has no narration and shows the real application and service wait. The submission package excludes `node_modules`, `dist`, virtual environments, Python caches, build metadata, and test-tool output. There are no known blockers to the requested local take-home submission.

## Loading UI and chat layout regression

After the requested UI changes, `npm test` passed all 15 tests and `npm run build` passed again. A real four-node browser run completed in **15.286 seconds**, using one POST and 15 GET requests. The request contained only node `id` and `type`; three trace edges appeared without changing the three architecture edges. Previous/Next navigation still worked.

The loading card showed the real `running` status and an increasing elapsed timer. Its progress bar was indeterminate (`aria-valuenow` absent), because the supplied API does not report a completion percentage. The card disappeared on completion, architecture-edit cancellation, and network failure. Starting another run reset the elapsed timer to zero; failure left the Run button available for retry. No JavaScript runtime exceptions occurred; the intentionally offline request produced the expected network error.

Measured command-history viewport heights before and after completion:

| Browser viewport | Before | After |
| --- | --- | --- |
| 1440 × 900 | 306 px | 306 px |
| 1280 × 720 | 250 px | 250 px |
| 1024 × 576 | 250 px | 250 px |
| 800 × 900 | 306 px | 306 px |
| 375 × 900 | 306 px | 306 px |

There was no horizontal document overflow in these cases. Simulation content now expands the page instead of taking height away from the command history. On desktop, the architecture canvas stays visible while scrolling through the panels.

The updated **64.84-second** demo was recorded against the production build on the local preview server, using the real backend. All four topology operations, the loading UI, and Next/Previous navigation were exercised. Its browser console had zero errors and warnings. After React Flow's 200 ms fitting animation settled, every node was confirmed inside the canvas at all five viewport sizes above.

See the [completed screenshot](docs/simulation-completed.png), [loading screenshot](docs/simulation-loading.png), and [demo recording](docs/demo.webm).
