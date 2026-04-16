namespace MyDietitianMobileApp.Api.Models;

public sealed record DatabaseAuditReport(
    DateTime GeneratedAtUtc,
    DatabaseAuditSummary Summary,
    IReadOnlyList<DatabaseTableAudit> Tables,
    IReadOnlyList<TableConflictFamilyAudit> ConflictFamilies);

public sealed record DatabaseAuditSummary(
    int CatalogTableCount,
    int PresentTableCount,
    int MissingTableCount,
    int AppDbCatalogTableCount,
    int AuthDbCatalogTableCount,
    int ConflictFamilyCount,
    IReadOnlyList<string> MissingTables);

public sealed record DatabaseTableAudit(
    string Database,
    string TableName,
    string Category,
    string Purpose,
    string DecisionCode,
    string DecisionLabel,
    string Note,
    bool ExistsInDatabase,
    long? RowCount,
    IReadOnlyList<string> MappedEntities,
    IReadOnlyList<TableTrackedColumnAudit> TrackedColumns);

public sealed record TableTrackedColumnAudit(
    string ColumnName,
    string Kind,
    bool IsNullable,
    long? NullCount,
    long? NonNullCount,
    long? RowsInLast30Days,
    string? MinValue,
    string? MaxValue);

public sealed record TableConflictFamilyAudit(
    string FamilyName,
    string CanonicalCandidate,
    string Status,
    string Rationale,
    IReadOnlyList<string> Tables,
    IReadOnlyList<TableUsageReferenceAudit> Readers,
    IReadOnlyList<TableUsageReferenceAudit> Writers);

public sealed record TableUsageReferenceAudit(
    string TableName,
    string Surface,
    string Action,
    string PathOrHandler,
    string Source);
