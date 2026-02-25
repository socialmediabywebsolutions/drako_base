$ErrorActionPreference = 'Stop'

$saases = @(
  @{ slug = 'drakos'; domain = 'drakos.drako.systems' },
  @{ slug = 'mentorias'; domain = 'mentoria.drako.systems' },
  @{ slug = 'bases'; domain = 'bases.drako.systems' },
  @{ slug = 'socialflows'; domain = 'socialflows.drako.systems' },
  @{ slug = 'cryptos'; domain = 'cryptos.drako.systems' },
  @{ slug = 'invoices'; domain = 'invoices.drako.systems' },
  @{ slug = 'analytics'; domain = 'analytics.drako.systems' },
  @{ slug = 'automations'; domain = 'automations.drako.systems' }
)

Write-Host '== Health checks =='
foreach ($saas in $saases) {
  Write-Host "-- $($saas.slug) ($($saas.domain))"
  $health = Invoke-RestMethod -Method GET -Uri "https://$($saas.domain)/api/health"
  [PSCustomObject]@{
    ok = $health.ok
    host = $health.host
    resolvedContext = $health.resolvedContext
    workerName = $health.workerName
    gitSha = $health.gitSha
    workersOnly = $health.workersOnly
  } | Format-List
  Write-Host ''
}

Write-Host '== Host fencing checks (expected 403) =='
foreach ($saas in $saases) {
  Write-Host "-- $($saas.slug) rejecting foreign Host header"
  try {
    $response = Invoke-WebRequest -Method GET -Uri "https://$($saas.domain)/api/health" -Headers @{ Host = 'invalid.drako.systems' }
    Write-Host "Unexpected status: $($response.StatusCode)"
  } catch {
    if ($_.Exception.Response) {
      Write-Host "Status: $([int]$_.Exception.Response.StatusCode)"
    } else {
      Write-Host "Request failed: $($_.Exception.Message)"
    }
  }
  Write-Host ''
}
