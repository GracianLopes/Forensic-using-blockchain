#!/bin/bash

# Setup Hyperledger Fabric Network for Forensics System
# This script initializes the Fabric network with required components

set -e

echo "====================================================="
echo "  Hyperledger Fabric Network Setup"
echo "====================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Compose wrapper supporting docker-compose, docker compose, or COMPOSE_BIN
compose() {
    if [ -n "${COMPOSE_BIN:-}" ] && [ -x "${COMPOSE_BIN}" ]; then
        "${COMPOSE_BIN}" "$@"
        return $?
    fi

    if command -v docker-compose &> /dev/null; then
        docker-compose "$@"
        return $?
    fi

    if docker compose version &> /dev/null; then
        docker compose "$@"
        return $?
    fi

    return 127
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker not found"
        exit 1
    fi

    if ! compose version &> /dev/null; then
        log_error "Compose command not found. Install docker-compose or Docker Compose v2, or set COMPOSE_BIN to a compose binary path."
        exit 1
    fi

    log_info "Prerequisites check passed."
}

# Create directory structure
create_directories() {
    log_info "Creating directory structure..."

    mkdir -p docker/fabric/{ca-org1,orderer,peer0.org1,wallet}
    mkdir -p blockchain/crypto-config
    mkdir -p backend/storage/{temp,evidence}
    mkdir -p backend/logs

    log_info "Directories created."
}

# Start Fabric network
start_network() {
    log_info "Starting Fabric network..."

    compose up -d ca_org1 orderer peer0_org1 couchdb

    log_info "Waiting for services to start (30 seconds)..."
    sleep 30

    # Check container status
    compose ps
}

# Stop Fabric network
stop_network() {
    log_info "Stopping Fabric network..."

    compose down

    log_info "Network stopped."
}

# Restart network
restart_network() {
    stop_network
    sleep 5
    start_network
}

# Clean network (remove volumes)
clean_network() {
    log_info "Cleaning network (removing volumes)..."

    compose down -v --remove-orphans

    # Remove generated crypto material
    rm -rf docker/fabric/ca-org1/*
    rm -rf docker/fabric/orderer/*
    rm -rf docker/fabric/peer0.org1/*
    rm -rf blockchain/crypto-config/*

    log_info "Network cleaned."
}

# Generate crypto material (simplified for development)
generate_crypto() {
    log_info "Generating crypto material..."

    # This is a simplified setup for development
    # In production, use cryptogen or fabric-ca

    mkdir -p blockchain/crypto-config/{peerOrganizations,ordererOrganizations}

    log_info "Crypto material directory structure created."
    log_warn "For production, use proper CA setup with fabric-ca-client"
}

# Create channel
create_channel() {
    log_info "Creating channel: forensic-channel..."

    # This would typically use configtxgen and peer channel commands
    # Simplified for development setup

    log_info "Channel creation would be handled by orderer in production."
}

# Enroll admin user
enroll_admin() {
    log_info "Enrolling admin user..."

    # This would use fabric-ca-client to enroll admin
    # For development, credentials are admin:adminpw

    log_warn "Using default admin credentials (admin:adminpw) - change for production!"
}

# Show status
show_status() {
    log_info "Network status:"
    echo ""
    compose ps
    echo ""

    log_info "Container logs (last 20 lines):"
    compose logs --tail=20
}

# Main
main() {
    case "${1:-setup}" in
        setup)
            check_prerequisites
            create_directories
            start_network
            generate_crypto
            enroll_admin
            ;;
        start)
            start_network
            ;;
        stop)
            stop_network
            ;;
        restart)
            restart_network
            ;;
        clean)
            clean_network
            ;;
        crypto)
            generate_crypto
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 {setup|start|stop|restart|clean|crypto|status}"
            echo ""
            echo "Commands:"
            echo "  setup   - Full network setup (default)"
            echo "  start   - Start network"
            echo "  stop    - Stop network"
            echo "  restart - Restart network"
            echo "  clean   - Stop and remove all data"
            echo "  crypto  - Generate crypto material"
            echo "  status  - Show network status"
            exit 1
            ;;
    esac
}

main "$@"
