---
'@edgestore/cli': major
---

Stop returning project secrets in JSON for key creation and rotation. Automated key commands now require `--output` to a protected, gitignored env file; JSON returns key metadata and delivery information only. Interactive one-time secret display remains available. Update scripts that consume `secretKey` to use direct file delivery instead.

Initialization reuses configured environment destinations and detects existing environment files before choosing a default. Ambiguous noninteractive destinations require `--output`. Invalid API URL errors no longer echo the supplied value.
