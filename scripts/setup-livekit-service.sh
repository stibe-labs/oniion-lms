#!/bin/bash
set -e

echo "=== Setting up LiveKit systemd service ==="

# Update webhook URL to point to portal server
sed -i 's|http://localhost:3000/api/v1/webhook/livekit|http://76.13.244.60:3000/api/v1/webhook/livekit|' /etc/livekit/config.yaml
echo "OK webhook URL updated to portal server"

# Create systemd service
cat > /etc/systemd/system/livekit-server.service << 'EOF'
[Unit]
Description=LiveKit Media Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/livekit-server --config /etc/livekit/config.yaml
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable livekit-server
systemctl start livekit-server
sleep 2
systemctl is-active livekit-server
echo "OK LiveKit service started"

# Verify it responds
curl -s http://localhost:7880 > /dev/null && echo "OK LiveKit HTTP responding" || echo "WARN LiveKit not responding on 7880"
