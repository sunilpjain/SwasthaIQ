#!/usr/bin/env bash
# Deploys an API image tag on this server. Called by GitHub Actions through SSM:
#   /opt/swasthyaiq/deploy.sh <image-tag>      deploy that tag
#   /opt/swasthyaiq/deploy.sh --rollback       go back to the previous tag
# Keeps the previous tag in /opt/swasthyaiq/previous-tag for one-command rollback.
set -euo pipefail
cd /opt/swasthyaiq
source ./.env

REGISTRY="${ECR_REPO%%/*}"
CURRENT="$(cat current-tag 2>/dev/null || true)"

if [[ "${1:-}" == "--rollback" ]]; then
  TAG="$(cat previous-tag)"
  echo "rolling back ${CURRENT} -> ${TAG}"
else
  TAG="${1:?usage: deploy.sh <image-tag> | --rollback}"
fi

aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin "$REGISTRY"
export API_IMAGE="${ECR_REPO}:${TAG}"
sed -i "s#^API_IMAGE=.*#API_IMAGE=${API_IMAGE}#" .env
docker compose pull api
docker compose up -d

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:80/health -H "Host: ${API_DOMAIN}" -o /dev/null 2>/dev/null \
     || docker compose exec -T api wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1; then
    if [[ "${1:-}" != "--rollback" && -n "$CURRENT" && "$CURRENT" != "$TAG" ]]; then
      echo "$CURRENT" > previous-tag
    fi
    echo "$TAG" > current-tag
    echo "healthy on ${TAG}"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 4
done

echo "health check failed for ${TAG}" >&2
if [[ -n "$CURRENT" && "$CURRENT" != "$TAG" && "${1:-}" != "--rollback" ]]; then
  echo "restoring ${CURRENT}" >&2
  export API_IMAGE="${ECR_REPO}:${CURRENT}"
  sed -i "s#^API_IMAGE=.*#API_IMAGE=${API_IMAGE}#" .env
  docker compose up -d
fi
exit 1
