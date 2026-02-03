#!/bin/bash
#
# MOLT STUDIOS - Full Stack Startup Script
#
# Starts the complete development environment:
# 1. ScriptgreSQL + Redis (Docker) - Already running
# 2. API Server (Node.js) - Port 3001
# 3. Web Client (Next.js) - Port 3000
#
# Usage: bash scripts/start-dev-stack.sh
#

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MOLT STUDIOS - Development Stack${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if Docker containers are running
echo -e "${YELLOW}[1/3] Checking ScriptgreSQL & Redis...${NC}"
if docker ps | grep -q molt-Scriptgres && docker ps | grep -q molt-redis; then
    echo -e "${GREEN}✓ ScriptgreSQL and Redis are running${NC}\n"
else
    echo -e "${YELLOW}Starting Docker containers...${NC}"
    cd /root/MOLTSTUDIOS
    docker-compose up -d molt-Scriptgres molt-redis 2>/dev/null || true
    sleep 3
    echo -e "${GREEN}✓ Docker containers started${NC}\n"
fi

# Start API Server
echo -e "${YELLOW}[2/3] Starting API Server (Port 3001)...${NC}"
cd /root/MOLTSTUDIOS/api
export DATABASE_URL="Scriptgresql://Scriptgres:password123@localhost:5432/moltstudios"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="dev-jwt-secret-change-in-production"
export NODE_ENV="development"
export INTERNAL_CRON_SECRET="dev-cron-secret-change-in-production"

# Start API in background
npm run dev > /tmp/api.log 2>&1 &
API_PID=$!
echo -e "${GREEN}✓ API Server starting (PID: $API_PID)${NC}"
sleep 3

# Check if API is responding
if curl -s http://localhost:3001/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is healthy on http://localhost:3001${NC}\n"
else
    echo -e "${YELLOW}! API still initializing, give it a moment...${NC}\n"
fi

# Start Web Client
echo -e "${YELLOW}[3/3] Starting Web Client (Port 3000)...${NC}"
cd /root/MOLTSTUDIOS/web-client

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing web client dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Start web client in background
npm run dev > /tmp/web-client.log 2>&1 &
WEB_PID=$!
echo -e "${GREEN}✓ Web Client starting (PID: $WEB_PID)${NC}\n"

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ MOLT STUDIOS DEVELOPMENT STACK STARTED${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${BLUE}URLs:${NC}"
echo -e "  ${GREEN}Web Client:${NC}  http://localhost:3000"
echo -e "  ${GREEN}API Server:${NC}   http://localhost:3001/api/v1"
echo -e "  ${GREEN}Database:${NC}     Scriptgresql://localhost:5432"
echo -e "  ${GREEN}Redis:${NC}        redis://localhost:6379\n"

echo -e "${BLUE}Logs:${NC}"
echo -e "  ${YELLOW}API:${NC}         tail -f /tmp/api.log"
echo -e "  ${YELLOW}Web Client:${NC}  tail -f /tmp/web-client.log\n"

echo -e "${YELLOW}Press Ctrl+C to stop the stack${NC}\n"

# Wait for user interrupt
wait $API_PID $WEB_PID 2>/dev/null || true

echo -e "\n${YELLOW}Development stack stopped.${NC}"
