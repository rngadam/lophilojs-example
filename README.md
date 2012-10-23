# Welcome to your first Lophilo app!

## Overview

Demonstrates building a full application with client/server architecture, 
HTML5 user interface and embedded hardware control.

## Running 

In Cloud9, click on the root folder app.js file and click the Run button.

Note that the most common mistake is to click on another Javascript that is
not the main app; Cloud9 will happily run it anyway...

## Architecture

These are the files you'll be most interested in:

### Client-side (client/)

* View: client/views/app.html
 * the user interface, in HTML5 
 * uses Bootstrap CSS classes for widgets, layout and appearance
 * Knockout.js data-bind= attributes matches your data
* Model: client/code/app.js
 * Knockout models made of "observables" that automatically notify subscribers
 * Updating the model will transparently update the user interface.

### Server-side (server/)

* Server API: server/rpc/lophilo.js
 * uses SocketStream style API (automatically generated from filename)
 * depends on lophilo.js to interact with the hardware
 * exposes a multi-users remotely callable web API

## Development

Workflow:

* fork the project from Lophilo to your own user
* make changes 
* run application and test 
* make more changes (no need to re-run app if you're changing client-side apps)
* git commit your changes
* git push them to your forked repo
* initiate pull requests to main Lophilo repository