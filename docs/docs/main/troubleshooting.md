---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
slug: /troubleshooting
---

# Troubleshooting

If you followed the docs to get started with Edge Store, but you are having issues, here are some things you can try to find out what the problem might be.

## Check if the API is correctly configured

You can try to access the `/health` endpoint of your edgestore API from the browser.

The default URL is: [http://localhost:3000/api/edgestore/health](http://localhost:3000/api/edgestore/health)

If you can see `OK` on the page, then the API is configured in the correct path.

## Set the log level to `debug`

You can set the [log level](./logging.md) to `debug` to see in more details what is happening in the server. (this logs are for the server-side and will not be visible in the browser console)

## Check the browser console and network tab

Open the developer tools in your browser and check the console and network tab to see if there are any helpful error messages.

## Try to run one of the example apps

You can try to run one of the example apps in your local machine to see if it works.

- clone the repo
  - `git clone https://github.com/edgestorejs/edgestore.git`
- cd into the example app
  - `cd examples/next-basic`
- install dependencies
  - `npm install`
- add your environment variables
  - `examples/next-basic/.env.local`
- run the app
  - `npm run dev`
- access the app
  - [http://localhost:3000](http://localhost:3000)

There are also [other example apps](https://github.com/edgestorejs/edgestore/tree/main/examples) that you can try. Try to find the one that is closer to your use case.

# Tried everything and still not working?

If you tried everything and still can't figure out what is wrong, you can reach for support in the [Discord server](https://discord.gg/HvrnhRTfgQ) or [open an issue](https://github.com/edgestorejs/edgestore/issues) in the GitHub repo.