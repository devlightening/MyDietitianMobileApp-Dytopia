using System.Data;
using System.Data.Common;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using MyDietitianMobileApp.Api.Models;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Services;

public sealed class DatabaseAuditService
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DatabaseAuditService> _logger;

    public DatabaseAuditService(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DatabaseAuditService> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    public async Task<DatabaseAuditReport> BuildReportAsync(CancellationToken cancellationToken)
    {
        var tableAudits = new List<DatabaseTableAudit>(DatabaseAuditCatalog.Tables.Count);

        foreach (var spec in DatabaseAuditCatalog.Tables)
        {
            var context = ResolveContext(spec.Database);
            tableAudits.Add(await BuildTableAuditAsync(context, spec, cancellationToken));
        }

        var missingTables = tableAudits
            .Where(x => !x.ExistsInDatabase)
            .Select(x => $"{x.Database}:{x.TableName}")
            .ToArray();

        var summary = new DatabaseAuditSummary(
            CatalogTableCount: DatabaseAuditCatalog.Tables.Count,
            PresentTableCount: tableAudits.Count(x => x.ExistsInDatabase),
            MissingTableCount: missingTables.Length,
            AppDbCatalogTableCount: DatabaseAuditCatalog.Tables.Count(x => x.Database == DatabaseAuditCatalog.AppDb),
            AuthDbCatalogTableCount: DatabaseAuditCatalog.Tables.Count(x => x.Database == DatabaseAuditCatalog.AuthDb),
            ConflictFamilyCount: DatabaseAuditCatalog.ConflictFamilies.Count,
            MissingTables: missingTables);

        var conflicts = DatabaseAuditCatalog.ConflictFamilies
            .Select(spec => new TableConflictFamilyAudit(
                spec.FamilyName,
                spec.CanonicalCandidate,
                spec.Status,
                spec.Rationale,
                spec.Tables,
                spec.Readers.Select(MapUsage).ToArray(),
                spec.Writers.Select(MapUsage).ToArray()))
            .ToArray();

        return new DatabaseAuditReport(
            GeneratedAtUtc: DateTime.UtcNow,
            Summary: summary,
            Tables: tableAudits,
            ConflictFamilies: conflicts);
    }

    private DbContext ResolveContext(string database)
    {
        return database switch
        {
            DatabaseAuditCatalog.AppDb => _appDb,
            DatabaseAuditCatalog.AuthDb => _authDb,
            _ => throw new InvalidOperationException($"Unsupported database catalog key '{database}'.")
        };
    }

    private async Task<DatabaseTableAudit> BuildTableAuditAsync(
        DbContext context,
        TableGovernanceSpec spec,
        CancellationToken cancellationToken)
    {
        var mappedEntities = GetMappedEntities(context, spec.TableName);
        bool existsInDatabase;
        long? rowCount = null;
        IReadOnlyList<TableTrackedColumnAudit> trackedColumns = [];

        var shouldClose = await EnsureConnectionOpenAsync(context, cancellationToken);

        try
        {
            rowCount = await ExecuteCountAsync(context.Database.GetDbConnection(), spec.TableName, cancellationToken);
            existsInDatabase = true;
            trackedColumns = await BuildTrackedColumnsAsync(context, spec.TableName, rowCount.Value, cancellationToken);
        }
        catch (Exception ex)
        {
            existsInDatabase = false;
            _logger.LogDebug(ex, "Database audit skipped table {Database}:{TableName}", spec.Database, spec.TableName);
        }
        finally
        {
            if (shouldClose)
            {
                await context.Database.CloseConnectionAsync();
            }
        }

        return new DatabaseTableAudit(
            Database: spec.Database,
            TableName: spec.TableName,
            Category: spec.Category,
            Purpose: spec.Purpose,
            DecisionCode: spec.DecisionCode,
            DecisionLabel: spec.DecisionLabel,
            Note: spec.Note,
            ExistsInDatabase: existsInDatabase,
            RowCount: rowCount,
            MappedEntities: mappedEntities,
            TrackedColumns: trackedColumns);
    }

    private async Task<IReadOnlyList<TableTrackedColumnAudit>> BuildTrackedColumnsAsync(
        DbContext context,
        string tableName,
        long rowCount,
        CancellationToken cancellationToken)
    {
        var trackedColumns = GetTrackedColumns(context, tableName);
        if (trackedColumns.Count == 0)
        {
            return [];
        }

        var connection = context.Database.GetDbConnection();
        var audits = new List<TableTrackedColumnAudit>(trackedColumns.Count);

        foreach (var trackedColumn in trackedColumns)
        {
            var nullCount = await ExecuteConditionalCountAsync(
                connection,
                tableName,
                $"WHERE {QuoteIdentifier(trackedColumn.ColumnName)} IS NULL",
                cancellationToken);

            var rowsInLast30Days = await ExecuteConditionalCountAsync(
                connection,
                tableName,
                $"WHERE {QuoteIdentifier(trackedColumn.ColumnName)} IS NOT NULL AND {QuoteIdentifier(trackedColumn.ColumnName)} >= {GetLastThirtyDaysExpression(context.Database.ProviderName, trackedColumn.ClrType)}",
                cancellationToken);

            var (minValue, maxValue) = await ExecuteMinMaxAsync(
                connection,
                tableName,
                trackedColumn.ColumnName,
                cancellationToken);

            audits.Add(new TableTrackedColumnAudit(
                ColumnName: trackedColumn.ColumnName,
                Kind: GetColumnKind(trackedColumn.ClrType),
                IsNullable: trackedColumn.IsNullable,
                NullCount: nullCount,
                NonNullCount: rowCount - nullCount,
                RowsInLast30Days: rowsInLast30Days,
                MinValue: minValue,
                MaxValue: maxValue));
        }

        return audits;
    }

    private static IReadOnlyList<string> GetMappedEntities(DbContext context, string tableName)
    {
        return context.Model.GetEntityTypes()
            .Where(x => string.Equals(x.GetTableName(), tableName, StringComparison.Ordinal))
            .Select(x => SimplifyEntityName(x.Name))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();
    }

    private static IReadOnlyList<TrackedColumnSpec> GetTrackedColumns(DbContext context, string tableName)
    {
        var columns = new Dictionary<string, TrackedColumnSpec>(StringComparer.OrdinalIgnoreCase);

        foreach (var entityType in context.Model.GetEntityTypes()
                     .Where(x => string.Equals(x.GetTableName(), tableName, StringComparison.Ordinal)))
        {
            var storeObject = StoreObjectIdentifier.Table(tableName, entityType.GetSchema());

            foreach (var property in entityType.GetProperties())
            {
                var columnName = property.GetColumnName(storeObject);
                if (string.IsNullOrWhiteSpace(columnName))
                {
                    continue;
                }

                var clrType = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (!IsTrackedTemporalType(clrType))
                {
                    continue;
                }

                columns.TryAdd(columnName, new TrackedColumnSpec(columnName, clrType, property.IsNullable));
            }
        }

        return columns.Values
            .OrderBy(x => x.ColumnName, StringComparer.Ordinal)
            .ToArray();
    }

    private static bool IsTrackedTemporalType(Type clrType)
    {
        return clrType == typeof(DateTime) ||
               clrType == typeof(DateTimeOffset) ||
               clrType == typeof(DateOnly);
    }

    private static string GetColumnKind(Type clrType)
    {
        if (clrType == typeof(DateOnly))
        {
            return "date";
        }

        if (clrType == typeof(DateTimeOffset))
        {
            return "datetimeoffset";
        }

        return "datetime";
    }

    private static async Task<bool> EnsureConnectionOpenAsync(DbContext context, CancellationToken cancellationToken)
    {
        if (context.Database.GetDbConnection().State == ConnectionState.Open)
        {
            return false;
        }

        await context.Database.OpenConnectionAsync(cancellationToken);
        return true;
    }

    private static async Task<long> ExecuteCountAsync(
        DbConnection connection,
        string tableName,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT COUNT(*) FROM {QuoteIdentifier(tableName)}";

        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt64(scalar, CultureInfo.InvariantCulture);
    }

    private static async Task<long> ExecuteConditionalCountAsync(
        DbConnection connection,
        string tableName,
        string whereClause,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT COUNT(*) FROM {QuoteIdentifier(tableName)} {whereClause}";

        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt64(scalar, CultureInfo.InvariantCulture);
    }

    private static async Task<(string? MinValue, string? MaxValue)> ExecuteMinMaxAsync(
        DbConnection connection,
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            SELECT MIN({QuoteIdentifier(columnName)}), MAX({QuoteIdentifier(columnName)})
            FROM {QuoteIdentifier(tableName)}
            WHERE {QuoteIdentifier(columnName)} IS NOT NULL
            """;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return (null, null);
        }

        return (
            reader.IsDBNull(0) ? null : FormatDbValue(reader.GetValue(0)),
            reader.IsDBNull(1) ? null : FormatDbValue(reader.GetValue(1)));
    }

    private static string? FormatDbValue(object? value)
    {
        return value switch
        {
            null => null,
            DateTime dateTime => dateTime.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
            DateTimeOffset dateTimeOffset => dateTimeOffset.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
            DateOnly dateOnly => dateOnly.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture)
        };
    }

    private static string GetLastThirtyDaysExpression(string? providerName, Type clrType)
    {
        var isSqlite = providerName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;
        var isDateOnly = clrType == typeof(DateOnly);

        if (isSqlite)
        {
            return isDateOnly
                ? "date('now', '-30 days')"
                : "datetime('now', '-30 days')";
        }

        return isDateOnly
            ? "(CURRENT_DATE - INTERVAL '30 days')"
            : "(CURRENT_TIMESTAMP - INTERVAL '30 days')";
    }

    private static string QuoteIdentifier(string identifier)
    {
        return "\"" + identifier.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
    }

    private static string SimplifyEntityName(string entityName)
    {
        var lastSeparator = entityName.LastIndexOf('.');
        return lastSeparator >= 0
            ? entityName[(lastSeparator + 1)..]
            : entityName;
    }

    private static TableUsageReferenceAudit MapUsage(TableUsageReferenceSpec spec)
    {
        return new TableUsageReferenceAudit(
            TableName: spec.TableName,
            Surface: spec.Surface,
            Action: spec.Action,
            PathOrHandler: spec.PathOrHandler,
            Source: spec.Source);
    }

    private sealed record TrackedColumnSpec(
        string ColumnName,
        Type ClrType,
        bool IsNullable);
}
