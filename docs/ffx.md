We found the real root cause of the ingredient image detection failure.

This is no longer primarily an alias or Turkish-character normalization issue.
The main blocker is EF Core DbContext concurrency inside the resolver pipeline.

Confirmed facts from backend logs:
1. OpenAI Vision call succeeds:
   - POST https://api.openai.com/v1/chat/completions
   - HTTP 200 returned
2. Vision detects 4 raw food names successfully
3. Then resolver fails for:
   - salatalık
   - marul
   - domates
4. Error is:
   System.InvalidOperationException:
   A second operation was started on this context instance before a previous operation completed.
5. Stack trace points to:
   - IngredientNormalizationService.NormalizeAsync(...)
   - IngredientDetectionResolver.ResolveAsync(...)
6. Only ton balığı resolves successfully:
   matchedBy=Canonical confidence=1.00 autoSelected=True
7. Final result:
   Image analysis complete: 1 matched (1 auto-selected), 3 unmatched (from 4 detected)

This proves:
- The image is being understood correctly
- OpenAI is working
- The closed-set list is not the main issue
- The current failure is caused by concurrent use of the same AppDbContext during multi-label resolution

Your task:
1. Audit AnalyzeIngredientImageCommandHandler and the full detection pipeline.
2. Find where detected labels are being resolved concurrently against the same scoped DbContext.
3. Fix it properly.

Required fix direction:
- Do NOT use the same AppDbContext instance concurrently across multiple label resolutions.
- Either:
  A) resolve labels sequentially with await in a simple foreach
  or
  B) use IDbContextFactory/AppDbContext factory and create an isolated DbContext per parallel resolution
- Prefer the safest and simplest production fix first.
- If there is no strong reason for parallelism here, make resolution sequential.

Also:
4. Audit IngredientNormalizationService.NormalizeAsync to ensure it does not enumerate EF queries while another EF query is still active on the same context.
5. Audit IngredientDetectionResolver.ResolveAsync for Task.WhenAll / Select(async ...) / parallel LINQ / fire-and-forget patterns.
6. Ensure exact canonical/alias matching still works after the concurrency fix.
7. Keep the Turkish-character normalization improvement already added.
8. Add clear structured logs per label:
   - rawLabel
   - normalizedLabel
   - startedResolution
   - completedResolution
   - match result
   - unresolved reason
9. Add one integration-safe test path or debug mode if needed.
10. Verify with the same image that all 4 detected items can complete resolution without concurrency exceptions.

Important:
- Do not patch this with random retries only
- Fix the actual concurrent DbContext usage
- Do not regress the ton balığı successful path
- Do not remove logging
- Do not blame aliases before fixing concurrency

Expected deliverables:
1. Apply code changes directly
2. Give me a concise Turkish summary:
   - exact root cause
   - where concurrency happened
   - whether labels were being resolved in parallel
   - which files changed
   - why only ton balığı survived
   - how to test again
3. Show final expected log behavior after the fix:
   - OpenAI 200
   - Vision detected 4 raw food names
   - all 4 labels resolved without DbContext concurrency exception