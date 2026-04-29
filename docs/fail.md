backend log : 

", c."SenderRole", c."Text"
      FROM "ClientCareMessages" AS c
      WHERE c."ClientId" = @__clientId_0 AND c."SenderRole" = 'Client' AND c."CreatedAtUtc" >= @__startUtc_1
fail: Microsoft.EntityFrameworkCore.Query[10100]
      An exception occurred while iterating over the results of a query for context type 'MyDietitianMobileApp.Infrastructure.Persistence.AppDbContext'.
      Npgsql.PostgresException (0x80004005): 42703: column c.ReplyToId does not exist

      POSITION: 80
         at Npgsql.Internal.NpgsqlConnector.ReadMessageLong(Boolean async, DataRowLoadingMode dataRowLoadingMode, Boolean readingNotifications, Boolean isReadingPrependedMessage)
         at System.Runtime.CompilerServices.PoolingAsyncValueTaskMethodBuilder`1.StateMachineBox`1.System.Threading.Tasks.Sources.IValueTaskSource<TResult>.GetResult(Int16 token)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.InitializeReaderAsync(AsyncEnumerator enumerator, CancellationToken cancellationToken)
         at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
        Exception data:
          Severity: ERROR
          SqlState: 42703
          MessageText: column c.ReplyToId does not exist
          Position: 80
          File: parse_relation.c
          Line: 3665
          Routine: errorMissingColumn
      Npgsql.PostgresException (0x80004005): 42703: column c.ReplyToId does not exist

      POSITION: 80
         at Npgsql.Internal.NpgsqlConnector.ReadMessageLong(Boolean async, DataRowLoadingMode dataRowLoadingMode, Boolean readingNotifications, Boolean isReadingPrependedMessage)
         at System.Runtime.CompilerServices.PoolingAsyncValueTaskMethodBuilder`1.StateMachineBox`1.System.Threading.Tasks.Sources.IValueTaskSource<TResult>.GetResult(Int16 token)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.InitializeReaderAsync(AsyncEnumerator enumerator, CancellationToken cancellationToken)
         at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
        Exception data:
          Severity: ERROR
          SqlState: 42703
          MessageText: column c.ReplyToId does not exist
          Position: 80
          File: parse_relation.c
          Line: 3665
          Routine: errorMissingColumn
fail: MyDietitianMobileApp.Api.Controllers.DashboardController[0]
      Failed to get dashboard data for user
      Npgsql.PostgresException (0x80004005): 42703: column c.ReplyToId does not exist

      POSITION: 80
         at Npgsql.Internal.NpgsqlConnector.ReadMessageLong(Boolean async, DataRowLoadingMode dataRowLoadingMode, Boolean readingNotifications, Boolean isReadingPrependedMessage)
         at System.Runtime.CompilerServices.PoolingAsyncValueTaskMethodBuilder`1.StateMachineBox`1.System.Threading.Tasks.Sources.IValueTaskSource<TResult>.GetResult(Int16 token)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.InitializeReaderAsync(AsyncEnumerator enumerator, CancellationToken cancellationToken)
         at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
         at Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync[TSource](IQueryable`1 source, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync[TSource](IQueryable`1 source, CancellationToken cancellationToken)
         at MyDietitianMobileApp.Application.Services.ClientGamificationService.BuildStateAsync(Guid clientId, Boolean isPremium, Nullable`1 dietitianId, Boolean persistChanges, CancellationToken ct) in C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Application\Services\ClientGamificationService.cs:line 225
         at MyDietitianMobileApp.Application.Services.ClientGamificationService.GetSummaryAsync(Guid clientId, Boolean isPremium, Nullable`1 dietitianId, CancellationToken ct) in C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Application\Services\ClientGamificationService.cs:line 59
         at MyDietitianMobileApp.Api.Controllers.DashboardController.GetDashboard() in C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api\Controllers\DashboardController.cs:line 57
        Exception data:
          Severity: ERROR
          SqlState: 42703
          MessageText: column c.ReplyToId does not exist
          Position: 80
          File: parse_relation.c
          Line: 3665
          Routine: errorMissingColumn
info: Microsoft.EntityFrameworkCore.Database.Command[20101]
      Executed DbCommand (1ms) [Parameters=[@__parsedUserId_0='52e412d0-c0c4-4300-bed5-ee487554f4d7'], CommandType='Text', CommandTimeout='30']
      SELECT u."Id", u."ActiveDietitianContextId", u."Email", u."FullName", u."LastLoginAtUtc", u."LinkedClientId", u."LinkedDietitianId", u."PasswordChangedAtUtc", u."PasswordHash", u."PublicUserId", u."Role", u."SecurityStamp"
      FROM "UserAccounts" AS u
      WHERE u."Id" = @__parsedUserId_0
      LIMIT 1
info: Microsoft.EntityFrameworkCore.Database.Command[20101]
      Executed DbCommand (1ms) [Parameters=[@__Parse_0='52e412d0-c0c4-4300-bed5-ee487554f4d7'], CommandType='Text', CommandTimeout='30']
      SELECT u."Id", u."ActiveDietitianContextId", u."Email", u."FullName", u."LastLoginAtUtc", u."LinkedClientId", u."LinkedDietitianId", u."PasswordChangedAtUtc", u."PasswordHash", u."PublicUserId", u."Role", u."SecurityStamp"
      FROM "UserAccounts" AS u
      WHERE u."Id" = @__Parse_0 AND u."Role" = 'Dietitian'
      LIMIT 1
info: Microsoft.EntityFrameworkCore.Database.Command[20101]
      Executed DbCommand (1ms) [Parameters=[@__dietitianId_0='8f1866ab-b4ad-4b81-80c0-6525ec84c538', @__clientId_1='7b4a7d14-4630-4a44-81c1-ea3813ea8fd3'], CommandType='Text', CommandTimeout='30']
      SELECT d."Id", d."ClientId", d."DietitianId", d."IsActive", d."LinkedAt", d."PublicUserId", d."UnlinkedAt"
      FROM "DietitianClientLinks" AS d
      WHERE d."DietitianId" = @__dietitianId_0 AND d."ClientId" = @__clientId_1 AND d."IsActive" AND d."UnlinkedAt" IS NULL
      LIMIT 1
info: Microsoft.EntityFrameworkCore.Database.Command[20101]
      Executed DbCommand (1ms) [Parameters=[@__clientId_0='7b4a7d14-4630-4a44-81c1-ea3813ea8fd3'], CommandType='Text', CommandTimeout='30']
      SELECT c."Id", c."ActiveDietitianId", c."BirthDate", c."CreatedAt", c."DietitianId", c."Email", c."FullName", c."Gender", c."IsActive", c."PremiumActivatedAt", c."ProgramEndDate", c."ProgramStartDate"
      FROM "Clients" AS c
      WHERE c."Id" = @__clientId_0
      LIMIT 1
fail: Microsoft.EntityFrameworkCore.Database.Command[20102]
      Failed executing DbCommand (1ms) [Parameters=[@__clientId_0='7b4a7d14-4630-4a44-81c1-ea3813ea8fd3', @__dietitianId_Value_1='8f1866ab-b4ad-4b81-80c0-6525ec84c538' (Nullable = true)], CommandType='Text', CommandTimeout='30']
      SELECT c."Id", c."ClientId", c."CreatedAtUtc", c."DietitianId", c."ReadAtUtc", c."ReplyToId", c."ReplyToSnippet", c."SenderRole", c."Text"
      FROM "ClientCareMessages" AS c
      WHERE c."ClientId" = @__clientId_0 AND c."DietitianId" = @__dietitianId_Value_1 AND c."SenderRole" <> 'Dietitian' AND c."ReadAtUtc" IS NULL
fail: Microsoft.EntityFrameworkCore.Query[10100]
      An exception occurred while iterating over the results of a query for context type 'MyDietitianMobileApp.Infrastructure.Persistence.AppDbContext'.
      Npgsql.PostgresException (0x80004005): 42703: column c.ReplyToId does not exist

      POSITION: 80
         at Npgsql.Internal.NpgsqlConnector.ReadMessageLong(Boolean async, DataRowLoadingMode dataRowLoadingMode, Boolean readingNotifications, Boolean isReadingPrependedMessage)
         at System.Runtime.CompilerServices.PoolingAsyncValueTaskMethodBuilder`1.StateMachineBox`1.System.Threading.Tasks.Sources.IValueTaskSource<TResult>.GetResult(Int16 token)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.InitializeReaderAsync(AsyncEnumerator enumerator, CancellationToken cancellationToken)
         at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
        Exception data:
          Severity: ERROR
          SqlState: 42703
          MessageText: column c.ReplyToId does not exist
          Position: 80
          File: parse_relation.c
          Line: 3665
          Routine: errorMissingColumn
      Npgsql.PostgresException (0x80004005): 42703: column c.ReplyToId does not exist

      POSITION: 80
         at Npgsql.Internal.NpgsqlConnector.ReadMessageLong(Boolean async, DataRowLoadingMode dataRowLoadingMode, Boolean readingNotifications, Boolean isReadingPrependedMessage)
         at System.Runtime.CompilerServices.PoolingAsyncValueTaskMethodBuilder`1.StateMachineBox`1.System.Threading.Tasks.Sources.IValueTaskSource<TResult>.GetResult(Int16 token)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.InitializeReaderAsync(AsyncEnumerator enumerator, CancellationToken cancellationToken)
         at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
        Exception data:
          Severity: ERROR
          SqlState: 42703
          MessageText: column c.ReplyToId does not exist
          Position: 80
          File: parse_relation.c
          Line: 3665
          Routine: errorMissingColumn
fail: MyDietitianMobileApp.Api.Middleware.GlobalExceptionMiddleware[0]
      An unhandled exception occurred: 42703: column c.ReplyToId does not exist

      POSITION: 80
      Npgsql.PostgresException (0x80004005): 42703: column c.ReplyToId does not exist

      POSITION: 80
         at Npgsql.Internal.NpgsqlConnector.ReadMessageLong(Boolean async, DataRowLoadingMode dataRowLoadingMode, Boolean readingNotifications, Boolean isReadingPrependedMessage)
         at System.Runtime.CompilerServices.PoolingAsyncValueTaskMethodBuilder`1.StateMachineBox`1.System.Threading.Tasks.Sources.IValueTaskSource<TResult>.GetResult(Int16 token)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlDataReader.NextResult(Boolean async, Boolean isConsuming, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
         at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.InitializeReaderAsync(AsyncEnumerator enumerator, CancellationToken cancellationToken)
         at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.Query.Internal.SingleQueryingEnumerable`1.AsyncEnumerator.MoveNextAsync()
         at Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync[TSource](IQueryable`1 source, CancellationToken cancellationToken)
         at Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync[TSource](IQueryable`1 source, CancellationToken cancellationToken)
         at MyDietitianMobileApp.Api.Controllers.DietitianCareController.GetCareHub(Guid clientId) in C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api\Controllers\DietitianCareController.cs:line 47
         at Microsoft.AspNetCore.Mvc.Infrastructure.ActionMethodExecutor.TaskOfIActionResultExecutor.Execute(ActionContext actionContext, IActionResultTypeMapper mapper, ObjectMethodExecutor executor, Object controller, Object[] arguments)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.<InvokeActionMethodAsync>g__Awaited|12_0(ControllerActionInvoker invoker, ValueTask`1 actionResultValueTask)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.<InvokeNextActionFilterAsync>g__Awaited|10_0(ControllerActionInvoker invoker, Task lastTask, State next, Scope scope, Object state, Boolean isCompleted)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.Rethrow(ActionExecutedContextSealed context)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.Next(State& next, Scope& scope, Object& state, Boolean& isCompleted)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.<InvokeInnerFilterAsync>g__Awaited|13_0(ControllerActionInvoker invoker, Task lastTask, State next, Scope scope, Object state, Boolean isCompleted)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.<InvokeFilterPipelineAsync>g__Awaited|20_0(ResourceInvoker invoker, Task lastTask, State next, Scope scope, Object state, Boolean isCompleted)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.<InvokeAsync>g__Awaited|17_0(ResourceInvoker invoker, Task task, IDisposable scope)
         at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.<InvokeAsync>g__Awaited|17_0(ResourceInvoker invoker, Task task, IDisposable scope)
         at MyDietitianMobileApp.Api.Middleware.GlobalExceptionMiddleware.InvokeAsync(HttpContext context) in C:\Users\hy971\source\repos\MyDietitianMobileApp\src\MyDietitianMobileApp.Api\Middleware\GlobalExceptionMiddleware.cs:line 27
        Exception data:
          Severity: ERROR
          SqlState: 42703
          MessageText: column c.ReplyToId does not exist
          Position: 80
          File: parse_relation.c
          Line: 3665
          Routine: errorMissingColumn




web panel log  : 

C:\Users\hy971\source\repos\MyDietitianMobileApp\web-panel>npm run dev

> mydietitian-web-panel@1.0.0 dev
> next dev

  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 3.2s
 ○ Compiling /auth/login ...
<w> [webpack.cache.PackFileCacheStrategy/webpack.FileSystemInfo] Parsing of C:\Users\hy971\source\repos\MyDietitianMobileApp\web-panel\node_modules\next-intl\dist\esm\production\extractor\format\index.js for build dependencies failed at 'import(t)'.
<w> Build dependencies behind this expression are ignored and might cause incorrect cache invalidation.
(node:23596) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. Please use Object.assign() instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
 ✓ Compiled /middleware in 4.8s (1163 modules)
[Middleware] Token valid, allowing access
 ○ Compiling /dashboard ...
 ✓ Compiled /dashboard in 1403ms (1252 modules)
 GET /dashboard 200 in 1234ms
 ✓ Compiled /api/dietitian/dashboard/stats in 427ms (761 modules)
 GET /api/dietitian/dashboard/stats 200 in 581ms
[Middleware] Token valid, allowing access
 ○ Compiling /dashboard/care-hub ...
 ✓ Compiled /dashboard/care-hub in 523ms (1363 modules)
[Middleware] Token valid, allowing access
[Middleware] Token valid, allowing access
 ✓ Compiled /_not-found in 278ms (1366 modules)
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 538ms
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 526ms
[Middleware] Token valid, allowing access
[Middleware] Token valid, allowing access
 ○ Compiling /dashboard/recipes ...
 ✓ Compiled /dashboard/recipes in 613ms (1404 modules)
[Middleware] Token valid, allowing access
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 81ms
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 78ms
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 51ms
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 38ms
[Middleware] Token valid, allowing access
[Middleware] Token valid, allowing access
 ○ Compiling /dashboard/appointments ...
 ✓ Compiled /dashboard/appointments in 577ms (1375 modules)
[Middleware] Token valid, allowing access
[Middleware] Token valid, allowing access
[Middleware] Token valid, allowing access
 ✓ Compiled /_not-found in 282ms (1378 modules)
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 401ms
 POST /hubs/sync/negotiate?negotiateVersion=1 404 in 391ms
