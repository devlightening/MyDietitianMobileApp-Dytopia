param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath,
    [Parameter(Mandatory = $true)]
    [string]$PdfPath
)

$ErrorActionPreference = "Stop"

$wdAlertsNone = 0
$wdExportFormatPDF = 17
$wdFindStop = 0
$wdReplaceNone = 0
$wdColorBlack = 0
$wdNoUnderline = 0
$wdTurkish = 1055
$wdEnglishUS = 1033

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = $wdAlertsNone
$word.Options.UpdateFieldsAtPrint = $true
$word.Options.UpdateLinksAtOpen = $false

try {
    $doc = $word.Documents.Open($DocxPath, $false, $false)

    $doc.TrackRevisions = $false
    if ($doc.Revisions.Count -gt 0) {
        $doc.AcceptAllRevisions()
    }

    $doc.Range().LanguageID = $wdTurkish

    $abstractStart = $doc.Content.Start
    $abstractEnd = $doc.Content.Start
    $findRange = $doc.Content.Duplicate
    $findRange.Find.ClearFormatting()
    $findRange.Find.Text = "ABSTRACT"
    if ($findRange.Find.Execute()) {
        $abstractStart = $findRange.End
        $endRange = $doc.Content.Duplicate
        $endRange.Start = $abstractStart
        $endRange.Find.ClearFormatting()
        $endRange.Find.Text = "ÖNSÖZ"
        if ($endRange.Find.Execute()) {
            $abstractEnd = $endRange.Start
            $doc.Range($abstractStart, $abstractEnd).LanguageID = $wdEnglishUS
        }
    }

    $technicalTerms = @(
        "Dytopia", "MyDietitian", "Access Key", "Premium Guard", "Tenant Isolation",
        "premium guard", "tenant isolation", "backend", "frontend", "SignalR",
        "PostgreSQL", "React Native", "React", "Expo", "Next.js", "Tailwind",
        "JWT", "OpenAI", "IngredientId", "RecipeRecommendationEngine",
        "canonical", "alias", "fuzzy", "benchmark", "controller", "endpoint",
        "API", "DbSet", "docker-compose.yml", "Program.cs", "net8.0"
    )
    foreach ($term in $technicalTerms) {
        $r = $doc.Content.Duplicate
        $r.Find.ClearFormatting()
        $r.Find.Text = $term
        $r.Find.Forward = $true
        $r.Find.Wrap = $wdFindStop
        while ($r.Find.Execute()) {
            $r.NoProofing = $true
            $r.Start = $r.End
            $r.End = $doc.Content.End
        }
    }

    foreach ($style in $doc.Styles) {
        try {
            $style.Font.Name = "Times New Roman"
            $style.Font.NameAscii = "Times New Roman"
            $style.Font.NameFarEast = "Times New Roman"
            $style.Font.NameOther = "Times New Roman"
            $style.Font.Size = 12
            $style.Font.Color = $wdColorBlack
            $style.Font.Italic = 0
            $style.Font.Underline = $wdNoUnderline
        } catch {
        }
    }

    $doc.Range().Font.Name = "Times New Roman"
    $doc.Range().Font.NameAscii = "Times New Roman"
    $doc.Range().Font.NameFarEast = "Times New Roman"
    $doc.Range().Font.NameOther = "Times New Roman"
    $doc.Range().Font.Size = 12
    $doc.Range().Font.Color = $wdColorBlack
    $doc.Range().Font.Italic = 0
    $doc.Range().Font.Underline = $wdNoUnderline

    foreach ($table in $doc.Tables) {
        $table.Range.Font.Name = "Times New Roman"
        $table.Range.Font.Size = 12
        $table.Range.Font.Color = $wdColorBlack
        $table.Range.Font.Italic = 0
        $table.Range.Font.Underline = $wdNoUnderline
        $table.AllowAutoFit = $true
        $table.AutoFitBehavior(2)
        try {
            $table.Rows.Item(1).HeadingFormat = $true
        } catch {
        }
    }

    foreach ($section in $doc.Sections) {
        foreach ($footer in $section.Footers) {
            $footer.Range.Font.Name = "Times New Roman"
            $footer.Range.Font.Size = 12
            $footer.Range.Font.Color = $wdColorBlack
            $footer.Range.ParagraphFormat.Alignment = 1
        }
    }

    foreach ($field in $doc.Fields) {
        try { $field.Update() | Out-Null } catch {}
    }
    foreach ($toc in $doc.TablesOfContents) {
        try { $toc.Update() | Out-Null } catch {}
    }

    $story = $doc.StoryRanges
    foreach ($range in $story) {
        $r = $range
        while ($null -ne $r) {
            foreach ($field in $r.Fields) {
                try { $field.Update() | Out-Null } catch {}
            }
            $r = $r.NextStoryRange
        }
    }
    foreach ($toc in $doc.TablesOfContents) {
        try { $toc.UpdatePageNumbers() | Out-Null } catch {}
    }

    $doc.Range().Font.Name = "Times New Roman"
    $doc.Range().Font.Size = 12
    $doc.Range().Font.Color = $wdColorBlack
    $doc.Range().Font.Italic = 0
    $doc.Range().Font.Underline = $wdNoUnderline

    $doc.Save()
    if (Test-Path -LiteralPath $PdfPath) {
        Remove-Item -LiteralPath $PdfPath -Force
    }
    $doc.ExportAsFixedFormat($PdfPath, $wdExportFormatPDF)
    $doc.Close($false)
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output "WORD_EXPORT_OK"
