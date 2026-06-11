# API Latency Summary

Measurements were executed through ASP.NET Core test-server HTTP requests. They include routing, controller execution and JSON serialization inside the test host, but do not include external internet or mobile network latency.

| Endpoint | Count | Min | Max | Average | Median | P95 | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| GET /api/dev/benchmark/acquisition | 30 | 425,3103 | 1445,0287 | 698,6758 | 707,0584 | 954,7615 | 0 |
| GET /api/dev/benchmark/hybrid-recipe | 30 | 1,3371 | 3,0296 | 1,8080 | 1,7334 | 2,5794 | 0 |
| GET /api/dev/benchmark/normalization | 30 | 37,7783 | 115,4517 | 63,6999 | 59,9132 | 97,6730 | 0 |
| GET /api/dev/benchmark/recommendation | 30 | 2,0824 | 10,2011 | 3,6471 | 3,2249 | 6,0163 | 0 |
