#!/bin/bash
set -e

echo "=== Setting up Redis for remote access ==="

# Generate a Redis password
REDIS_PASS="stibe_redis_8f3a2c9e"

# Update Redis config: bind all, set password, disable protected-mode
sed -i 's/^bind 127.0.0.1 -::1/bind 0.0.0.0/' /etc/redis/redis.conf
sed -i 's/^protected-mode yes/protected-mode no/' /etc/redis/redis.conf

# Add or update requirepass
grep -q '^requirepass' /etc/redis/redis.conf && \
  sed -i "s/^requirepass .*/requirepass $REDIS_PASS/" /etc/redis/redis.conf || \
  echo "requirepass $REDIS_PASS" >> /etc/redis/redis.conf

# Open port 6379
ufw allow from any to any port 6379 proto tcp comment "Redis remote" 2>/dev/null || true

# Restart Redis
systemctl restart redis-server
sleep 1

# Verify
redis-cli -a "$REDIS_PASS" ping
echo "OK Redis configured — password: $REDIS_PASS"
