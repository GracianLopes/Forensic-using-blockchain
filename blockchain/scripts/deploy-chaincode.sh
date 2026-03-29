#!/bin/bash

# Deploy Evidence Chaincode to Hyperledger Fabric
# This script packages and installs the chaincode on the peer

set -e

echo "====================================================="
echo "  Evidence Chaincode Deployment Script"
echo "====================================================="

# Configuration
CHAINCODE_NAME="evidence-chaincode"
CHAINCODE_VERSION="1.0"
CHAINCODE_PATH="./blockchain/chaincode/evidence"
CHANNEL_NAME="forensic-channel"
PEER_ADDRESS="localhost:7051"
ORDERER_ADDRESS="localhost:7050"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v peer &> /dev/null; then
        log_error "Fabric peer CLI not found. Please install fabric-samples or set PATH."
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi

    log_info "Prerequisites check passed."
}

# Build chaincode
build_chaincode() {
    log_info "Building chaincode..."

    cd "$CHAINCODE_PATH"

    if [ -f "package.json" ]; then
        npm install
        npm run build
    fi

    cd - > /dev/null

    log_info "Chaincode built successfully."
}

# Package chaincode
package_chaincode() {
    log_info "Packaging chaincode..."

    PACKAGE_ID="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

    # Set environment variables for peer
    export CORE_PEER_ADDRESS=$PEER_ADDRESS
    export CORE_PEER_TLS_ENABLED=false

    peer lifecycle chaincode package "${CHAINCODE_NAME}.tar.gz" \
        --path "$CHAINCODE_PATH" \
        --lang node \
        --label "$PACKAGE_ID"

    log_info "Chaincode packaged successfully: ${CHAINCODE_NAME}.tar.gz"
}

# Install chaincode on peer
install_chaincode() {
    log_info "Installing chaincode on peer..."

    export CORE_PEER_ADDRESS=$PEER_ADDRESS
    export CORE_PEER_TLS_ENABLED=false

    peer lifecycle chaincode install "${CHAINCODE_NAME}.tar.gz"

    log_info "Chaincode installed on peer."
}

# Approve chaincode definition
approve_chaincode() {
    log_info "Approving chaincode definition..."

    export CORE_PEER_ADDRESS=$PEER_ADDRESS
    export CORE_PEER_TLS_ENABLED=false

    # Get package ID
    PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | \
        jq -r ".installed_chaincodes[] | select(.label==\"${CHAINCODE_NAME}_${CHAINCODE_VERSION}\") | .package_id")

    if [ -z "$PACKAGE_ID" ]; then
        log_error "Could not find installed chaincode with label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
        exit 1
    fi

    log_info "Using package ID: $PACKAGE_ID"

    # Get next sequence number
    SEQUENCE=$(peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --output json | \
        jq -r ".chaincode_definitions | length")
    SEQUENCE=$((SEQUENCE + 1))

    # Approve chaincode
    peer lifecycle chaincode approveformyorg \
        -o $ORDERER_ADDRESS \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $SEQUENCE \
        --init-required

    log_info "Chaincode definition approved."
}

# Commit chaincode
commit_chaincode() {
    log_info "Committing chaincode definition..."

    export CORE_PEER_ADDRESS=$PEER_ADDRESS
    export CORE_PEER_TLS_ENABLED=false

    SEQUENCE=$(peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --output json | \
        jq -r ".chaincode_definitions | length")
    SEQUENCE=$((SEQUENCE + 1))

    peer lifecycle chaincode commit \
        -o $ORDERER_ADDRESS \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --sequence $SEQUENCE \
        --init-required

    log_info "Chaincode definition committed."
}

# Initialize chaincode
initialize_chaincode() {
    log_info "Initializing chaincode..."

    export CORE_PEER_ADDRESS=$PEER_ADDRESS
    export CORE_PEER_TLS_ENABLED=false

    peer chaincode invoke \
        -o $ORDERER_ADDRESS \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --isInit \
        -c '{"function":"InitLedger","Args":[]}'

    log_info "Chaincode initialized."
}

# Query chaincode status
query_status() {
    log_info "Querying chaincode status..."

    export CORE_PEER_ADDRESS=$PEER_ADDRESS

    echo "Installed chaincodes:"
    peer lifecycle chaincode queryinstalled

    echo ""
    echo "Committed chaincodes:"
    peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME
}

# Main execution
main() {
    log_info "Starting chaincode deployment..."

    case "${1:-all}" in
        build)
            build_chaincode
            ;;
        package)
            package_chaincode
            ;;
        install)
            install_chaincode
            ;;
        approve)
            approve_chaincode
            ;;
        commit)
            commit_chaincode
            ;;
        init)
            initialize_chaincode
            ;;
        status)
            query_status
            ;;
        all)
            check_prerequisites
            build_chaincode
            package_chaincode
            install_chaincode
            # approve_chaincode
            # commit_chaincode
            # initialize_chaincode
            ;;
        *)
            echo "Usage: $0 {build|package|install|approve|commit|init|status|all}"
            exit 1
            ;;
    esac

    log_info "Deployment step completed."
}

main "$@"
