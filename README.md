[![Coverage Status](https://coveralls.io/repos/github/Zingle/esbulker/badge.svg?branch=travis-build)](https://coveralls.io/github/Zingle/esbulker?branch=travis-build)

esbulker Bulking Proxy for Elasticsearch
========================================

Install
-------
```sh
sudo -H npm install -g @zingle/esbulker
```

Usage
-----
```sh
# begin proxying ES PUT requests to Elasticsearch
esbulker http://localhost:9200

# set maximum number of documents per insert
esbulker --flush-documents=500 http://localhost:9200

# set maximum size of insert (may be larger with partial doc at end)
esbulker --flush-size=1000000 http://localhost:9200
```

Setup
-----
The `esbulker` proxy only accepts `PUT` requests to a specific document type
endpoint, that is `/<index>/<doctype>/<id>`.  Nginx or another proxy should
be used to split this acceptable traffic from the rest of the Elasticsearch
traffic.  The remaining traffic should be along to Elasticsearch.

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
