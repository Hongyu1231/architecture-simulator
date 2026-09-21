# 60-second demo script

Before recording, start the supplied Python service and the Vite frontend using the commands in `README.md`. Begin with the untouched initial canvas: `Internet → Web Server → Database`.

| Time | Action and narration |
| --- | --- |
| **0:00–0:05** | Show the initial three nodes and the two architecture edges. Say: “This is the starting architecture.” |
| **0:05–0:10** | Enter `add node Cache` and apply it. Point out the new draggable node and the success message in command history. |
| **0:10–0:15** | Enter `connect Web Server to Cache`. Point out the new architecture edge. |
| **0:15–0:20** | Enter `disconnect Web Server from Database`. Show that the original database edge disappears. |
| **0:20–0:25** | Enter `remove node Cache`. Show that Cache and its connected edge are removed. |
| **0:25–0:30** | Enter `add node Cache` again. Point out that the node is re-added in an available layout slot. |
| **0:30–0:35** | Enter `connect Web Server to Cache` again. The edited architecture is ready to simulate. |
| **0:35–0:37** | Click **Run simulation**. Say: “The app sends the current node IDs and types to the supplied API and starts polling.” |
| **0:37–0:52** | Leave the real run on screen for its approximately 15-second service delay. Show the loading UI moving through `Sending request`, `Queued`, `Running simulation`, and, if the service is still working at the expected time, `Waiting for result`; point out the live elapsed seconds and indeterminate progress bar. The completed response draws the animated dashed trace. |
| **0:52–0:55** | Click **Next**. Point to the selected trace edge, highlighted source and target nodes, latency, packet count, and `success` status. Mention that the command history still has its own usable scroll area while the result is shown. |
| **0:55–0:58** | Click **Previous**. Show the highlight and metrics moving back to the prior trace step. |
| **0:58–1:00** | Show the command history and say: “Topology commands are parsed deterministically, with validation and helpful recovery messages, so this flow needs no LLM.” |

Keep the canvas visible during the command sequence so the recording shows each topology change. The trace is an API result over the current node list and remains visually separate from the editable architecture edges.
