# start-server.ps1
# 별도 설치 없이 Windows 기본 PowerShell만으로 구동되는 로컬 웹 및 영구 데이터 파일 서버 (data/db.json 자동 저장)

param(
    [int]$Port = 8080
)

$Root = $PSScriptRoot
$DataDir = Join-Path $Root "data"
$DbFile = Join-Path $DataDir "db.json"

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
}

$Listener = New-Object System.Net.HttpListener
$Prefix = "http://localhost:$Port/"
$Listener.Prefixes.Add($Prefix)
$Listener.Start()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 학과별 복합 다중게시판 서버가 시작되었습니다!" -ForegroundColor Green
Write-Host " 브라우저 접속 주소: $Prefix" -ForegroundColor Yellow
Write-Host " 영구 저장 파일 경로: $DbFile" -ForegroundColor Gray
Write-Host " 종료하려면 Ctrl + C 를 누르세요." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".md"   = "text/markdown; charset=utf-8"
}

try {
    while ($Listener.IsListening) {
        $Context = $Listener.GetContext()
        $Req = $Context.Request
        $Res = $Context.Response
        $UrlPath = $Req.Url.AbsolutePath

        if ($UrlPath -eq "/api/db") {
            if ($Req.HttpMethod -eq "GET") {
                if (Test-Path $DbFile) {
                    $JsonContent = [System.IO.File]::ReadAllText($DbFile, [System.Text.Encoding]::UTF8)
                } else {
                    $JsonContent = "{}"
                }
                $Buffer = [System.Text.Encoding]::UTF8.GetBytes($JsonContent)
                $Res.ContentType = "application/json; charset=utf-8"
                $Res.StatusCode = 200
                $Res.OutputStream.Write($Buffer, 0, $Buffer.Length)
                $Res.Close()
                continue
            }
            elseif ($Req.HttpMethod -eq "POST") {
                $Reader = New-Object System.IO.StreamReader($Req.InputStream, [System.Text.Encoding]::UTF8)
                $Body = $Reader.ReadToEnd()
                $Reader.Close()
                [System.IO.File]::WriteAllText($DbFile, $Body, [System.Text.Encoding]::UTF8)
                $Buffer = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                $Res.ContentType = "application/json; charset=utf-8"
                $Res.StatusCode = 200
                $Res.OutputStream.Write($Buffer, 0, $Buffer.Length)
                $Res.Close()
                continue
            }
        }

        if ($UrlPath -eq "/") {
            $UrlPath = "/index.html"
        }

        $LocalPath = Join-Path $Root ($UrlPath.TrimStart('/').Replace('/', '\'))
        if (Test-Path $LocalPath -PathType Leaf) {
            $Ext = [System.IO.Path]::GetExtension($LocalPath).ToLower()
            $Res.ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
            $Bytes = [System.IO.File]::ReadAllBytes($LocalPath)
            $Res.StatusCode = 200
            $Res.OutputStream.Write($Bytes, 0, $Bytes.Length)
        } else {
            $Res.StatusCode = 404
        }
        $Res.Close()
    }
}
finally {
    $Listener.Stop()
}
