---
'@edgestore/cli': patch
---

Do not mistake an enabled skill-only EdgeStore plugin for an MCP connection.
Direct MCP setup preserves plugin configuration and reports unknown plugin
connection inventory, while still detecting visible direct connections.
