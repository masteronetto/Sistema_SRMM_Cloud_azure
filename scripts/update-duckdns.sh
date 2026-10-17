#!/usr/bin/env bash
set -euo pipefail

: "${DUCKDNS_TOKEN:?DUCKDNS_TOKEN debe estar configurado}"
: "${DUCKDNS_DOMAIN:=srmm}"

public_ip="$(curl --fail --silent --show-error https://api.ipify.org)"
response="$(curl --fail --silent --show-error \
  --get https://www.duckdns.org/update \
  --data-urlencode "domains=${DUCKDNS_DOMAIN}" \
  --data-urlencode "token=${DUCKDNS_TOKEN}" \
  --data-urlencode "ip=${public_ip}")"

if [[ "${response}" != "OK" ]]; then
  printf 'DuckDNS rechazo la actualizacion: %s\n' "${response}" >&2
  exit 1
fi

printf 'DuckDNS actualizado para %s: %s\n' "${DUCKDNS_DOMAIN}" "${public_ip}"
