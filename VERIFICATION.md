# Verification

Last checked: 22 September 2026. Environment: Windows, Node 24.11.1, npm 11.6.2, Python 3.12.14, and Chromium.

## Build and tests

The repository was cloned from GitHub into a clean directory and checked with:

```bash
npm ci
npm test
npm run build
npm run preview
```

Dependency installation succeeded with no reported vulnerabilities. All **15 tests passed**: nine parser/layout tests and six API/polling tests. TypeScript compilation and the Vite production build passed. No lint script is configured.

## Requirements

| Requirement | Result |
| --- | --- |
| Add and remove nodes and edges through text | Passed in unit tests and 21 browser command scenarios. Deleting a node also removes its connected architecture edges. |
| Input validation | Case, whitespace, quoted labels, aliases, duplicates, missing nodes/edges, self-connections, empty input, and malformed commands were checked. Invalid commands leave the graph unchanged. |
| Architecture display | React Flow renders the initial Internet → Web Server → Database graph and subsequent edits, with node labels and types. |
| Simulation API | The frontend sends only node `id` and `type`, receives a simulation ID, and polls the supplied service until completion. |
| Separate simulation trace | Three returned trace edges were displayed while the architecture still contained one edge. The trace is cleared by a topology edit. |
| Step exploration | Previous/Next, first/last-step boundaries, step count, latency, packets, status, and source/target/edge highlights were checked against the API response. |
| Loading feedback | The UI displays the service status, elapsed time, and an indeterminate progress indicator. Duplicate runs are disabled. Completion, cancellation, and errors clear the loading state. |
| Error handling | HTTP 400/404, unavailable API, polling failure, malformed responses, cancellation, and timeout handling were checked. Errors allow another run. |
| Bonus features | Chat history, command aliases, validation, helpful error messages, and parser tests are included. |
| Submission materials | Source, README, demo script, and a Loom demo link are included. Local documentation links resolve. |

## Service integration

The backend health endpoint returned HTTP 200. Empty node input returned HTTP 400, and an unknown simulation ID returned HTTP 404.

| Submitted nodes | Completion time | Returned edges |
| --- | --- | --- |
| 1 | 15.25 seconds | 0 |
| 2 | 15.25 seconds | 1 |
| 4 | 15.25 seconds | 3 |

Browser runs used the real service. The frontend made one POST followed by sequential polling requests and stopped polling after completion. Unit tests use response fixtures; browser fault injection is limited to error scenarios.

The supplied `simulation_service.py` retains its original content and SHA256:

```text
bb6d1209a854ba18f340bf1d7867d233c09e434afb13f1cb5240a0cb1507183d
```

The `.gitattributes` rule preserves this file's original bytes across platform checkouts.

## Layout

Command-history height before and after simulation completion:

| Viewport | Before | After |
| --- | --- | --- |
| 1440 × 900 | 306 px | 306 px |
| 1280 × 720 | 250 px | 250 px |
| 1024 × 576 | 250 px | 250 px |
| 800 × 900 | 306 px | 306 px |
| 375 × 900 | 306 px | 306 px |

All checked layouts had no horizontal document overflow. Nodes fitted within the canvas after its resize animation, and step controls remained accessible. Simulation results expand the page without reducing the chat area's height.

See the [completed view](docs/simulation-completed.png), [loading view](docs/simulation-loading.png), [narrow view](docs/simulation-narrow.png), and [demo recording](https://www.loom.com/share/1e3015b7067d41bf828a05b0ba520f67).

## Repository contents

The repository includes source, configuration, tests, documentation, and demo assets. Dependencies, build output, virtual environments, caches, logs, local configuration, and temporary files are ignored.

The lockfile, tests, and environment examples remain eligible for tracking. The demo is linked from Loom; local video files are ignored. No tracked files match the ignore rules.

## Limitations

- Local use requires the frontend and simulation service to run separately. Static hosting needs a same-origin `/api` reverse proxy.
- Architecture and chat history reset on refresh. Backend jobs are stored in memory.
- Cancelling frontend polling does not stop a job already accepted by the service.
- Node labels are limited to 80 characters. Labels containing command separators need quotes.
- Topology changes use text commands; direct drag-to-connect and keyboard deletion are disabled.
- Browser checks covered Chromium. Firefox and Safari were not tested.
