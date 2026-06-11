param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath,
    [Parameter(Mandatory = $true)]
    [string]$PdfPath
)

$ErrorActionPreference = "Stop"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    Write-Output "OPEN"
    $doc = $word.Documents.Open($DocxPath, $false, $false)
    $doc.TrackRevisions = $false
    if ($doc.Revisions.Count -gt 0) {
        $doc.AcceptAllRevisions()
    }

    Write-Output "LANG"
    $doc.Range().LanguageID = 1055

    Write-Output "UPDATE_FIELDS"
    try { $doc.Fields.Update() | Out-Null } catch {}
    for ($i = 1; $i -le $doc.TablesOfContents.Count; $i++) {
        try { $doc.TablesOfContents.Item($i).Update() | Out-Null } catch {}
    }
    for ($i = 1; $i -le $doc.TablesOfContents.Count; $i++) {
        try { $doc.TablesOfContents.Item($i).UpdatePageNumbers() | Out-Null } catch {}
    }

    Write-Output "UPDATE_FIELDS_2"
    try { $doc.Fields.Update() | Out-Null } catch {}
    for ($i = 1; $i -le $doc.TablesOfContents.Count; $i++) {
        try { $doc.TablesOfContents.Item($i).Update() | Out-Null } catch {}
    }

    Write-Output "SAVE"
    $doc.Save()

    Write-Output "EXPORT"
    if (Test-Path -LiteralPath $PdfPath) {
        Remove-Item -LiteralPath $PdfPath -Force
    }
    $doc.ExportAsFixedFormat($PdfPath, 17)

    Write-Output "CLOSE"
    $doc.Close($false)
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output "WORD_EXPORT_OK"
