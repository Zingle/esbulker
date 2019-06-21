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
