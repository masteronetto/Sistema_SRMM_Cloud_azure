$ErrorActionPreference = 'Stop'

function Require-EnvironmentVariable([string] $Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value) -or $value.Contains('<')) {
    throw "La variable $Name debe contener un valor real antes de desplegar."
  }
  return $value
}

$region = Require-EnvironmentVariable 'AWS_REGION'
$apiName = if ([string]::IsNullOrWhiteSpace($env:API_NAME)) { 'srmm-http-api' } else { $env:API_NAME }
$origin = Require-EnvironmentVariable 'API_ORIGIN_URL'
$cloudFrontDomain = Require-EnvironmentVariable 'CLOUDFRONT_DOMAIN'
$issuer = Require-EnvironmentVariable 'AZURE_JWT_ISSUER'
$audience = Require-EnvironmentVariable 'AZURE_JWT_AUDIENCE'
$scope = if ([string]::IsNullOrWhiteSpace($env:AZURE_REQUIRED_SCOPE)) { 'access_as_user' } else { $env:AZURE_REQUIRED_SCOPE }

$apiId = aws apigatewayv2 get-apis --region $region --query "Items[?Name=='$apiName'].ApiId | [0]" --output text
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar API Gateway.' }

if ([string]::IsNullOrWhiteSpace($apiId) -or $apiId -eq 'None') {
  $apiId = aws apigatewayv2 create-api --name $apiName --protocol-type HTTP --cors-configuration "AllowOrigins=https://$cloudFrontDomain,http://localhost:5173,AllowMethods=GET,POST,PUT,PATCH,DELETE,OPTIONS,AllowHeaders=Authorization,Content-Type" --region $region --query ApiId --output text
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la HTTP API.' }
} else {
  aws apigatewayv2 update-api --api-id $apiId --cors-configuration "AllowOrigins=https://$cloudFrontDomain,http://localhost:5173,AllowMethods=GET,POST,PUT,PATCH,DELETE,OPTIONS,AllowHeaders=Authorization,Content-Type" --region $region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar CORS de la HTTP API.' }
}

$apiIntegrationId = aws apigatewayv2 get-integrations --api-id $apiId --region $region --query "Items[?IntegrationUri=='$origin'].IntegrationId | [0]" --output text
if ([string]::IsNullOrWhiteSpace($apiIntegrationId) -or $apiIntegrationId -eq 'None') {
  $apiIntegrationId = aws apigatewayv2 create-integration --api-id $apiId --integration-type HTTP_PROXY --integration-method ANY --integration-uri $origin --payload-format-version 1.0 --region $region --query IntegrationId --output text
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la integracion HTTP.' }
}

$healthOrigin = "$origin/health"
$healthIntegrationId = aws apigatewayv2 get-integrations --api-id $apiId --region $region --query "Items[?IntegrationUri=='$healthOrigin'].IntegrationId | [0]" --output text
if ([string]::IsNullOrWhiteSpace($healthIntegrationId) -or $healthIntegrationId -eq 'None') {
  $healthIntegrationId = aws apigatewayv2 create-integration --api-id $apiId --integration-type HTTP_PROXY --integration-method GET --integration-uri $healthOrigin --payload-format-version 1.0 --region $region --query IntegrationId --output text
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la integracion HTTP de health.' }
}

$authorizerId = aws apigatewayv2 get-authorizers --api-id $apiId --region $region --query "Items[?Name=='entra-jwt'].AuthorizerId | [0]" --output text
if ([string]::IsNullOrWhiteSpace($authorizerId) -or $authorizerId -eq 'None') {
  $authorizerId = aws apigatewayv2 create-authorizer --api-id $apiId --authorizer-type JWT --name entra-jwt --identity-source '$request.header.Authorization' --jwt-configuration "Audience=$audience,Issuer=$issuer" --region $region --query AuthorizerId --output text
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el JWT authorizer.' }
}

function Ensure-Route([string] $routeKey, [string] $integrationId, [string] $authorizationType, [string] $authorizer, [string[]] $scopes) {
  $escapedRoute = $routeKey.Replace("'", "''")
  $routeId = aws apigatewayv2 get-routes --api-id $apiId --region $region --query "Items[?RouteKey=='$escapedRoute'].RouteId | [0]" --output text
  $arguments = @('--api-id', $apiId, '--route-key', $routeKey, '--target', "integrations/$integrationId", '--region', $region)
  if ($authorizationType -eq 'JWT') {
    $arguments += @('--authorization-type', 'JWT', '--authorizer-id', $authorizer, '--authorization-scopes', ($scopes -join ' '))
  } else {
    $arguments += @('--authorization-type', 'NONE')
  }
  if ([string]::IsNullOrWhiteSpace($routeId) -or $routeId -eq 'None') {
    aws apigatewayv2 create-route @arguments | Out-Null
  } else {
    aws apigatewayv2 update-route @arguments '--route-id' $routeId | Out-Null
  }
  if ($LASTEXITCODE -ne 0) { throw "No se pudo configurar la ruta $routeKey." }
}

Ensure-Route 'ANY /api/{proxy+}' $apiIntegrationId 'JWT' $authorizerId @($scope)
Ensure-Route 'GET /health' $healthIntegrationId 'NONE' '' @()

$stageName = if ([string]::IsNullOrWhiteSpace($env:API_STAGE_NAME)) { '$default' } else { $env:API_STAGE_NAME }
$stageId = aws apigatewayv2 get-stages --api-id $apiId --region $region --query "Items[?StageName=='$stageName'].StageName | [0]" --output text
if ([string]::IsNullOrWhiteSpace($stageId) -or $stageId -eq 'None') {
  aws apigatewayv2 create-stage --api-id $apiId --stage-name $stageName --auto-deploy --region $region | Out-Null
}

Write-Output "HTTP API configurada: https://$apiId.execute-api.$region.amazonaws.com"
