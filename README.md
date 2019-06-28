[![Build Status](https://travis-ci.com/Zingle/esbulker.svg?branch=master)](https://travis-ci.com/Zingle/esbulker)
[![Coverage Status](https://coveralls.io/repos/github/Zingle/esbulker/badge.svg?branch=travis-build)](https://coveralls.io/github/Zingle/esbulker?branch=travis-build)

esbulker Bulking Proxy for Elasticsearch
========================================

How the Proxy Works
-------------------
When a request is made to `PUT` a document, the proxy will queue the request
and immediately return a `202 Accepted` response.  As documents are queued,
the proxy will batch them up and `POST` them to a target Elasticsearch bulk
endpoint, such as `/<index>/<doctype>/_bulk`.

When a temporary problem is encountered writing to Elasticsearch, the proxy
will begin backing off to avoid overloading ES.  If a problem persists, the
proxy will start returning `503 Service Unavailable` errors and will no
longer queue any documents.

![Request Flow Diagram](doc/diagram.png)

Installation
------------
```sh
sudo -H npm install -g @zingle/esbulker
```

Configuration
-------------
Carefully consider how the proxy is configured to get the best use out of it.

### Configure Backoff
When Elasticsearch begins to become overloaded, slow inserts can be an early
warning sign.  Configuring a slow insert threshold will cause an Elasticsearch
target endpoint to be paused.  While paused, the proxy will continue to accept
requests, but writing to the Elasticsearch endpoint will begin backing off
between writes until the problem resolves.

*The backoff on slow inserts is fibonacci based, and the corresponding
rampup is geometric.  This means recovery time will be impacted by how long the
endpoint was paused.*

When backoff is enabled, insert limits should also be configured to ensure
inserts don't get larger and larger and slower during a backoff.

Use the `--slow` option to configure backoff.

### Configure Insert Limits
By default, the proxy will attempt to load the entire queue into Elasticsearch
each request.  Under reasonable load and normal operation, this is probably ok,
but if the connection to Elasticsearch is lost temporarily or Elasticsearch
simply begins to fall behind, the queue may become very large.  Configuring
insert limits will force the proxy to break up the work into multiple inserts.

Use the `--flush-docs` and/or `--flush-size` options to configure insert
limits.

### Configure Circuit Breaking
Under normal operation, the proxy will queue requests and return a successful
response to clients even if the target Elasticsearch server has gone down.  This
can hide issues and eventually lead to memory exhaustion, so it's a good idea to
configure circuit breaking.  When a circuit breaker is triggered, the proxy
begins returning error responses to clients.  The proxy will continue to attempt
loading any documents remaining in the queue.  Once the problem has resolved,
the proxy will automatically start accepting requests again.

Use the `--break-docs` and/or `--break-size` options to configure circuit
breaking.

### Logging Failed Requests
For debugging, it can be helpful to see the full request and response when
Elasticsearch returns an error.

Use the `--http-log` option to configure the HTTP error log.  Send the proxy a
`HUP` signal to have it re-open the file.

Usage
-----
```
Usage:
  esbulker [<OPTIONS>] <endpoint>
  esbulker --help

Start elasticsearch bulk load proxy.

ARGUMENTS

  endpoint              URL of Elasticsearch server.

OPTIONS

  --help                Show this help.
  --break-docs=<docs>   Max documents queued before breaking.
  --break-size=<bytes>  Max size of queue before breaking.
  --flush-docs=<docs>   Max documents loaded per insert.
  --flush-size=<bytes>  Max size of data per insert.
  --http-log=<file>     Path where failed HTTP requests are written.
  --retry=<num>         Number of times to immediately retry before failing.
  --slow=<secs>         Slow insert threshold.
  --version             Print version number.

  NOTE: options which accept bytes can have units such as "10mb" or "1GiB"

ENVIRONMENT

  LISTEN_PORT           Configure port which proxy listens on. (default 1374)

SIGNALS

  HUP                   Re-open HTTP log file.
```

Additional Setup
----------------
The `esbulker` proxy only accepts `PUT` requests to a specific document type
endpoint, that is `/<index>/<doctype>/<id>`.  Nginx or another proxy should
be used to split this acceptable traffic from the rest of the Elasticsearch
traffic.  The remaining traffic should be passed along to Elasticsearch.
