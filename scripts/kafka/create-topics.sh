#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="$repository_root/docker-compose.kafka.yml"
replication_factor="${KAFKA_REPLICATION_FACTOR:-3}"

ensure_topic() {
  local name="$1"
  local partitions="$2"
  local replication_factor="$3"
  local config="$4"

  docker compose -f "$compose_file" exec -T kafka1 \
    kafka-topics --bootstrap-server kafka1:29092 \
    --create --if-not-exists \
    --topic "$name" \
    --partitions "$partitions" \
    --replication-factor "$replication_factor"

  docker compose -f "$compose_file" exec -T kafka1 \
    kafka-configs --bootstrap-server kafka1:29092 \
    --alter --entity-type topics --entity-name "$name" \
    --add-config "$config"

  local description summary current_partitions current_replication_factor
  description="$(docker compose -f "$compose_file" exec -T kafka1 \
    kafka-topics --bootstrap-server kafka1:29092 --describe --topic "$name")"
  summary="$(printf '%s\n' "$description" | grep -m1 -E 'PartitionCount:[[:space:]]*[0-9]+.*ReplicationFactor:[[:space:]]*[0-9]+' || true)"
  if [[ ! "$summary" =~ PartitionCount:[[:space:]]*([0-9]+).*ReplicationFactor:[[:space:]]*([0-9]+) ]]; then
    echo "Could not verify topic shape: $name" >&2
    return 1
  fi

  current_partitions="${BASH_REMATCH[1]}"
  current_replication_factor="${BASH_REMATCH[2]}"
  if (( current_partitions < partitions )); then
    docker compose -f "$compose_file" exec -T kafka1 \
      kafka-topics --bootstrap-server kafka1:29092 \
      --alter --topic "$name" --partitions "$partitions"
    current_partitions="$partitions"
  fi
  if (( current_partitions != partitions || current_replication_factor != replication_factor )); then
    echo "Topic $name has partitions=$current_partitions and replicationFactor=$current_replication_factor; expected partitions=$partitions and replicationFactor=$replication_factor." >&2
    return 1
  fi
}

ensure_topic srmm.eventos-operacionales 3 "$replication_factor" \
  'cleanup.policy=delete,retention.ms=604800000,min.insync.replicas=2'
ensure_topic srmm.estado-maquinaria 3 "$replication_factor" \
  'cleanup.policy=compact\,delete,min.cleanable.dirty.ratio=0.1,min.insync.replicas=2'
ensure_topic srmm.eventos-operacionales.DLT 1 "$replication_factor" \
  'retention.ms=2592000000'
ensure_topic srmm.estado-maquinaria.DLT 1 "$replication_factor" \
  'retention.ms=2592000000'
