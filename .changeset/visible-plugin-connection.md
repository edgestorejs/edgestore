---
'@edgestore/cli': patch
---

Do not infer an MCP connection from an enabled EdgeStore plugin's name alone.
Direct MCP setup preserves plugin configuration and reports unknown plugin
connection inventory, while still detecting visible direct connections.
