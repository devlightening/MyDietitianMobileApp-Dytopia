# API / Operation Latency Summary

These values are measured in-process against the same service and policy components used by the API layer; they do not include external network latency.

| Operation | Count | Min | Max | Average | Median | P95 | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ingredient normalization | 100 | 1,2299 | 18,3642 | 2,6916 | 2,4652 | 4,7748 | 0 |
| Kitchen recipe match | 100 | 0,0078 | 0,4754 | 0,0141 | 0,0092 | 0,0113 | 0 |
| Premium visibility filter | 100 | 0,7003 | 5,1743 | 0,9889 | 0,8587 | 1,3600 | 0 |
| Public recipes filter | 100 | 0,5976 | 5,5103 | 0,7617 | 0,6724 | 1,0912 | 0 |
