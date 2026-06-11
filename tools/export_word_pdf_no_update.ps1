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
$word.Options.UpdateFieldsAtPrint = $false
$word.Options.UpdateLinksAtOpen = $false

try {
    $doc = $word.Documents.Open($DocxPath, $false, $false)
    $doc.Save()
    if (Test-Path -LiteralPath $PdfPath) {
        Remove-Item -LiteralPath $PdfPath -Force
    }
    $doc.ExportAsFixedFormat($PdfPath, 17)
    $doc.Close($false)
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output "WORD_EXPORT_NO_UPDATE_OK"
