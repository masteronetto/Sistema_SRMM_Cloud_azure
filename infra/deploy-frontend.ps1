$ErrorActionPreference = 'Stop'

function Require-EnvironmentVariable([string] $Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value) -or $value.Contains('<')) {
    throw "La variable $Name debe contener un valor real antes de desplegar."
  }
  return $value
}

$region = Require-EnvironmentVariable 'AWS_REGION'
$bucket = Require-EnvironmentVariable 'FRONTEND_BUCKET'
$distributionId = Require-EnvironmentVariable 'CLOUDFRONT_DISTRIBUTION_ID'

Push-Location (Join-Path $PSScriptRoot '..\frontend')
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'El build del frontend fallo.' }
} finally {
  Pop-Location
}

aws s3 sync (Join-Path $PSScriptRoot '..\frontend\dist') "s3://$bucket" --delete --region $region
if ($LASTEXITCODE -ne 0) { throw 'La sincronizacion con S3 fallo.' }

aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*'
if ($LASTEXITCODE -ne 0) { throw 'La invalidacion de CloudFront fallo.' }
