#!/bin/bash
# ═══════════════════════════════════════════════════
# DeepMindQ — Blue-Green Deployment Script
#
# Usage:
#   ./scripts/deploy.sh [blue|green|status|switch|rollback]
#
# Prerequisites:
#   - Docker and docker-compose installed
#   - .env file configured
#   - PORT_CURRENT and PORT_NEXT set (default: 3000/3001)
# ═══════════════════════════════════════════════════

set -euo pipefail

PORT_CURRENT="${PORT_CURRENT:-3000}"
PORT_NEXT="${PORT_NEXT:-3001}"
STATE_FILE="/tmp/deepmindq-deploy-state"
IMAGE_TAG="${IMAGE_TAG:-latest}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
DRAIN_TIMEOUT="${DRAIN_TIMEOUT:-30}"

# ── Color Helpers ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
log_error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" >&2; }

# ── Pre-flight Checks ──
preflight_check() {
  log_info "Running pre-flight checks..."

  # Check Docker is installed
  if ! command -v docker &>/dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
  fi
  log_ok "  Docker found: $(docker --version)"

  # Check Docker daemon is running
  if ! docker info &>/dev/null; then
    log_error "Docker daemon is not running. Please start Docker."
    exit 1
  fi
  log_ok "  Docker daemon is running"

  # Check .env file exists
  if [ ! -f ".env" ]; then
    log_warn "  .env file not found. Deployment will use default environment."
  else
    log_ok "  .env file found"
  fi

  # Check curl is available (for health checks)
  if ! command -v curl &>/dev/null; then
    log_error "curl is required for health checks but not installed."
    exit 1
  fi
  log_ok "  curl found: $(curl --version | head -1)"

  log_ok "Pre-flight checks passed."
}

# ── State Management ──
get_active_slot() {
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE"
  else
    echo "blue"
  fi
}

set_active_slot() {
  echo "$1" > "$STATE_FILE"
  log_info "Active slot set to: $1"
}

# ── Health Check ──
health_check() {
  local port=$1
  local timeout=$2
  local start
  start=$(date +%s)

  log_info "  Health checking port $port (timeout: ${timeout}s)..."
  while true; do
    local elapsed=$(( $(date +%s) - start ))
    if [ "$elapsed" -ge "$timeout" ]; then
      log_error "  Health check FAILED after ${timeout}s"
      return 1
    fi

    if curl -sf "http://localhost:$port/api/health" > /dev/null 2>&1; then
      log_ok "  Health check PASSED (${elapsed}s)"
      return 0
    fi

    sleep 2
  done
}

# ── Build ──
build_image() {
  log_info "Building Docker image: deepmindq:${IMAGE_TAG}"
  
  # Build with no-cache if requested
  if [ "${BUILD_NO_CACHE:-false}" = "true" ]; then
    docker build --no-cache -t "deepmindq:${IMAGE_TAG}" .
  else
    docker build -t "deepmindq:${IMAGE_TAG}" .
  fi

  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log_error "Docker build failed with exit code $exit_code"
    exit 1
  fi

  # Show image size
  local image_size
  image_size=$(docker image inspect "deepmindq:${IMAGE_TAG}" --format='{{.Size}}' 2>/dev/null || echo "unknown")
  log_ok "Build complete. Image size: $(numfmt --to=iec "$image_size" 2>/dev/null || echo "$image_size bytes")"
}

# ── Deploy to Slot ──
deploy_to_slot() {
  local slot=$1
  local port=$2

  log_info "Deploying to ${slot} slot (port ${port})..."

  # Stop existing container on this slot (if any)
  if docker ps -a --filter "name=deepmindq-${slot}" --format '{{.Names}}' | grep -q "deepmindq-${slot}"; then
    log_warn "  Stopping existing container on ${slot} slot..."
    docker stop "deepmindq-${slot}" 2>/dev/null || true
    docker rm "deepmindq-${slot}" 2>/dev/null || true
    log_ok "  Old ${slot} container removed."
  fi

  # Build resource constraints from env
  local memory_limit="${CONTAINER_MEMORY_LIMIT:-512m}"
  local cpu_limit="${CONTAINER_CPU_LIMIT:-1.0}"
  local restart_policy="${CONTAINER_RESTART_POLICY:-unless-stopped}"

  log_info "  Container config: memory=${memory_limit}, cpu=${cpu_limit}, restart=${restart_policy}"

  # Start new container
  docker run -d \
    --name "deepmindq-${slot}" \
    --env-file .env \
    -p "${port}:3000" \
    --memory="$memory_limit" \
    --cpus="$cpu_limit" \
    --restart="$restart_policy" \
    --health-cmd="wget -qO- http://localhost:3000/api/health || exit 1" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-retries=3 \
    --health-start-period=30s \
    --log-driver=json-file \
    --log-opt=max-size=10m \
    --log-opt=max-file=3 \
    "deepmindq:${IMAGE_TAG}"

  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log_error "Failed to start container on ${slot} slot (exit code: $exit_code)"
    exit 1
  fi

  log_ok "Container started on ${slot} slot (port ${port})."
}

# ── Switch Traffic ──
switch_traffic() {
  local new_active=$1
  local current_active=$2

  log_info "Switching traffic: ${current_active} → ${new_active}"

  if [ "$new_active" = "blue" ]; then
    PORT_CURRENT=3000
    PORT_NEXT=3001
  else
    PORT_CURRENT=3001
    PORT_NEXT=3000
  fi

  # Update nginx/reverse proxy (if applicable)
  if command -v nginx &>/dev/null; then
    log_info "  Nginx detected. Attempting config update..."
    # In production, this would update nginx upstream configuration
    # and reload: nginx -s reload
    log_warn "  Nginx config update not automated. Update manually if needed."
  fi

  # For cloud environments, this would update target group weights
  # e.g., AWS ALB target group, GCP NEG, etc.
  if [ -n "${AWS_TARGET_GROUP_ARN:-}" ]; then
    log_info "  AWS ALB detected. Updating target group weights..."
    # aws elbv2 modify-target-group-attributes --target-group-arn "$AWS_TARGET_GROUP_ARN" ...
    log_warn "  AWS target group update not automated in this script."
  fi

  set_active_slot "$new_active"
  log_ok "Traffic switched to ${new_active} slot."
}

# ── Drain Old Slot ──
drain_slot() {
  local slot=$1
  local port=$2

  log_info "Draining ${slot} slot (waiting ${DRAIN_TIMEOUT}s for connections to finish)..."

  # In production with a load balancer, we would:
  # 1. Set the target group weight to 0
  # 2. Wait for connection draining (DRAIN_TIMEOUT)
  # 3. Deregister the target

  # For local/docker environments, we just wait and stop
  sleep "$DRAIN_TIMEOUT"

  log_info "Stopping ${slot} container..."
  docker stop "deepmindq-${slot}" 2>/dev/null || true
  docker rm "deepmindq-${slot}" 2>/dev/null || true
  log_ok "${slot} slot drained and cleaned up."
}

# ── Validate Deployment ──
validate_deployment() {
  local port=$1
  local slot=$2

  log_info "Validating ${slot} deployment on port ${port}..."

  # 1. Basic health check
  if ! curl -sf "http://localhost:$port/api/health" > /dev/null 2>&1; then
    log_error "  Health endpoint check failed"
    return 1
  fi
  log_ok "  Health endpoint: OK"

  # 2. Readiness check
  if curl -sf "http://localhost:$port/api/ready" > /dev/null 2>&1; then
    log_ok "  Readiness endpoint: OK"
  else
    log_warn "  Readiness endpoint: not available (non-critical)"
  fi

  # 3. API version check
  local version_response
  version_response=$(curl -sf "http://localhost:$port/api/version" 2>/dev/null || echo "")
  if [ -n "$version_response" ]; then
    log_ok "  Version endpoint: $version_response"
  else
    log_warn "  Version endpoint: not available (non-critical)"
  fi

  # 4. Container health status
  local container_health
  container_health=$(docker inspect --format='{{.State.Health.Status}}' "deepmindq-${slot}" 2>/dev/null || echo "unknown")
  log_info "  Docker health status: ${container_health}"

  log_ok "Validation complete for ${slot} slot."
  return 0
}

# ── Show Deployment History ──
show_history() {
  log_info "Recent deployment history:"
  docker ps -a --filter "name=deepmindq-" \
    --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.CreatedAt}}" 2>/dev/null || \
    log_warn "No deployment history found."
}

# ── Cleanup Dangling Images ──
cleanup_images() {
  log_info "Cleaning up dangling Docker images..."
  local dangling_count
  dangling_count=$(docker images -f "dangling=true" -q | wc -l)
  if [ "$dangling_count" -gt 0 ]; then
    docker image prune -f
    log_ok "Removed ${dangling_count} dangling images."
  else
    log_info "No dangling images to clean."
  fi
}

# ── Commands ──
case "${1:-deploy}" in
  deploy)
    preflight_check
    build_image

    ACTIVE=$(get_active_slot)
    log_info "Current active slot: ${ACTIVE}"

    if [ "$ACTIVE" = "blue" ]; then
      NEXT="green"
      NEXT_PORT=$PORT_NEXT
      CURRENT_PORT=$PORT_CURRENT
    else
      NEXT="blue"
      NEXT_PORT=$PORT_CURRENT
      CURRENT_PORT=$PORT_NEXT
    fi

    log_info "Deploying to ${NEXT} slot (port ${NEXT_PORT})..."
    deploy_to_slot "$NEXT" "$NEXT_PORT"

    if health_check "$NEXT_PORT" "$HEALTH_TIMEOUT"; then
      validate_deployment "$NEXT_PORT" "$NEXT"
      switch_traffic "$NEXT" "$ACTIVE"
      drain_slot "$ACTIVE" "$CURRENT_PORT"
      cleanup_images
      log_ok "Deployment successful! Active: $(get_active_slot)"
      log_info "Deploy summary:"
      log_info "  Image: deepmindq:${IMAGE_TAG}"
      log_info "  Active slot: $(get_active_slot)"
      log_info "  Active port: ${PORT_CURRENT}"
    else
      log_error "Deployment FAILED. Health check did not pass."
      log_info "Cleaning up failed deployment on ${NEXT} slot..."
      docker stop "deepmindq-${NEXT}" 2>/dev/null || true
      docker rm "deepmindq-${NEXT}" 2>/dev/null || true
      log_info "Previous deployment on ${ACTIVE} slot remains active."
      exit 1
    fi
    ;;

  switch)
    ACTIVE=$(get_active_slot)
    NEXT=$( [ "$ACTIVE" = "blue" ] && echo "green" || echo "blue" )
    log_warn "Manual traffic switch requested. This will route all traffic to ${NEXT} slot."
    switch_traffic "$NEXT" "$ACTIVE"
    log_ok "Manual switch complete. Active: $(get_active_slot)"
    ;;

  rollback)
    log_warn "Initiating rollback..."
    ACTIVE=$(get_active_slot)
    PREV=$( [ "$ACTIVE" = "blue" ] && echo "green" || echo "blue" )
    PREV_PORT=$( [ "$PREV" = "blue" ] && echo "$PORT_CURRENT" || echo "$PORT_NEXT" )

    if docker ps --filter "name=deepmindq-${PREV}" --format '{{.Names}}' | grep -q "deepmindq-${PREV}"; then
      log_info "Found previous container: deepmindq-${PREV} on port ${PREV_PORT}"
      if health_check "$PREV_PORT" 10; then
        switch_traffic "$PREV" "$ACTIVE"
        log_ok "Rollback complete. Active: $(get_active_slot)"
        log_info "The rolled-back-to container is still running. Run 'deploy' to redeploy."
      else
        log_error "Rollback FAILED. Previous slot not healthy."
        log_info "Investigate the ${PREV} container: docker logs deepmindq-${PREV}"
        exit 1
      fi
    else
      log_error "No previous container found to roll back to."
      log_info "Check available containers: docker ps -a --filter name=deepmindq-"
      exit 1
    fi
    ;;

  status)
    ACTIVE=$(get_active_slot)
    echo ""
    echo "╔══════════════════════════════════════════╗"
    echo "║    DeepMindQ Deployment Status           ║"
    echo "╠══════════════════════════════════════════╣"
    echo "║  Active slot:  ${ACTIVE}"
    echo "║  Image tag:    ${IMAGE_TAG}"
    echo "║  Blue port:    3000"
    echo "║  Green port:   3001"
    echo "╚══════════════════════════════════════════╝"
    echo ""
    echo "Containers:"
    docker ps --filter "name=deepmindq-" \
      --format "  {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (none running)"
    echo ""
    echo "State file: ${STATE_FILE} → $(get_active_slot)"
    echo ""
    show_history
    ;;

  *)
    echo ""
    echo "Usage: $0 [deploy|switch|rollback|status]"
    echo ""
    echo "Commands:"
    echo "  deploy    Build and deploy to inactive slot, switch traffic, drain old"
    echo "  switch    Manually switch traffic between blue/green"
    echo "  rollback  Switch back to previous slot"
    echo "  status    Show current deployment status"
    echo ""
    echo "Environment Variables:"
    echo "  PORT_CURRENT          Current active port (default: 3000)"
    echo "  PORT_NEXT            Next deployment port (default: 3001)"
    echo "  IMAGE_TAG            Docker image tag (default: latest)"
    echo "  HEALTH_TIMEOUT       Health check timeout in seconds (default: 60)"
    echo "  DRAIN_TIMEOUT        Connection drain timeout in seconds (default: 30)"
    echo "  BUILD_NO_CACHE       Set to 'true' for clean builds (default: false)"
    echo "  CONTAINER_MEMORY_LIMIT  Container memory limit (default: 512m)"
    echo "  CONTAINER_CPU_LIMIT     Container CPU limit (default: 1.0)"
    echo "  CONTAINER_RESTART_POLICY  Restart policy (default: unless-stopped)"
    echo ""
    exit 1
    ;;
esac
