# API / Operation Latency Summary

These values are measured in-process against the same service and policy components used by the API layer; they do not include external network latency.

| Operation | Count | Min | Max | Average | Median | P95 | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ingredient normalization | 100 | 1,9045 | 26,4984 | 4,3192 | 3,0890 | 11,3384 | 0 |
| Kitchen recipe match | 100 | 0,0046 | 0,3042 | 0,0084 | 0,0051 | 0,0063 | 0 |
| Premium visibility filter | 100 | 0,9142 | 11,4778 | 1,7291 | 1,4106 | 2,2668 | 0 |
| Public recipes filter | 100 | 0,9353 | 19,5706 | 1,7355 | 1,2164 | 2,3856 | 0 |
