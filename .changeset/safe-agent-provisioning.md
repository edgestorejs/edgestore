---
'@edgestore/cli': major
---

Stop returning initial project keys and management-token secrets in structured output. Automated `project create` now requires `--without-key`; deliver a subsequent key with `project key create --output`. Automated `token create` requires `--output` inside the selected package, protected from Git and written with private permissions. JSON token results contain token metadata and delivery status, never the one-time secret. Interactive human one-time display remains available.
