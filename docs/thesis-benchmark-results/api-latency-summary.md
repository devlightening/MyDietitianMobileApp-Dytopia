# API Latency Summary

Measurements were executed through ASP.NET Core test-server HTTP requests. They include routing, controller execution and JSON serialization inside the test host, but do not include external internet or mobile network latency.

| Endpoint | Count | Min | Max | Average | Median | P95 | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| GET /api/dev/benchmark/acquisition | 30 | 588,3143 | 3265,1798 | 738,3293 | 619,0012 | 936,6138 | 0 |
| GET /api/dev/benchmark/hybrid-recipe | 30 | 1,7192 | 3,7918 | 2,3160 | 2,2848 | 3,5945 | 0 |
| GET /api/dev/benchmark/normalization | 30 | 68,1741 | 742,6409 | 120,7076 | 99,8828 | 137,8748 | 0 |
| GET /api/dev/benchmark/recommendation | 30 | 2,2669 | 13,4221 | 4,1603 | 3,4633 | 12,0954 | 0 |
