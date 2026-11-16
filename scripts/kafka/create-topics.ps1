$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFile = Join-Path $repositoryRoot 'docker-compose.kafka.yml'
$replicationFactor = 3
if (-not [string]::IsNullOrWhiteSpace($env:KAFKA_REPLICATION_FACTOR)) {
    $replicationFactor = [int]$env:KAFKA_REPLICATION_FACTOR
}

function Invoke-KafkaCli {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $dockerArguments = @('compose', '-f', $composeFile, 'exec', '-T', 'kafka1') + $Arguments
    & docker @dockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Kafka CLI failed: $($Arguments -join ' ')"
    }
}

function Ensure-Topic {
    param(
        [string]$Name,
        [int]$Partitions,
        [int]$ReplicationFactor,
        [string]$Config
    )

    Invoke-KafkaCli -Arguments @(
        'kafka-topics', '--bootstrap-server', 'kafka1:29092',
        '--create', '--if-not-exists',
        '--topic', $Name,
        '--partitions', "$Partitions",
        '--replication-factor', "$ReplicationFactor"
    )
    Invoke-KafkaCli -Arguments @(
        'kafka-configs', '--bootstrap-server', 'kafka1:29092',
        '--alter', '--entity-type', 'topics', '--entity-name', $Name,
        '--add-config', $Config
    )

    $description = Invoke-KafkaCli -Arguments @(
        'kafka-topics', '--bootstrap-server', 'kafka1:29092',
        '--describe', '--topic', $Name
    )
    $summary = $description | Where-Object { $_ -match 'PartitionCount:\s*\d+.*ReplicationFactor:\s*\d+' } |
        Select-Object -First 1
    if ($null -eq $summary -or $summary -notmatch 'PartitionCount:\s*(\d+).*ReplicationFactor:\s*(\d+)') {
        throw "Could not verify topic shape: $Name"
    }

    $currentPartitions = [int]$Matches[1]
    $currentReplicationFactor = [int]$Matches[2]
    if ($currentPartitions -lt $Partitions) {
        Invoke-KafkaCli -Arguments @(
            'kafka-topics', '--bootstrap-server', 'kafka1:29092',
            '--alter', '--topic', $Name, '--partitions', "$Partitions"
        )
        $currentPartitions = $Partitions
    }
    if ($currentPartitions -ne $Partitions -or $currentReplicationFactor -ne $ReplicationFactor) {
        throw "Topic $Name has partitions=$currentPartitions and replicationFactor=$currentReplicationFactor; expected partitions=$Partitions and replicationFactor=$ReplicationFactor."
    }
}

Ensure-Topic 'srmm.eventos-operacionales' 3 $replicationFactor 'cleanup.policy=delete,retention.ms=604800000,min.insync.replicas=2'
Ensure-Topic 'srmm.estado-maquinaria' 3 $replicationFactor 'cleanup.policy=compact\,delete,min.cleanable.dirty.ratio=0.1,min.insync.replicas=2'
Ensure-Topic 'srmm.eventos-operacionales.DLT' 1 $replicationFactor 'retention.ms=2592000000'
Ensure-Topic 'srmm.estado-maquinaria.DLT' 1 $replicationFactor 'retention.ms=2592000000'
