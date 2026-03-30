#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');

function resolvePath(inputPath, fallbackPath) {
  const value = inputPath || fallbackPath;
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(process.cwd(), value);
}

function normalizeCcpPaths(ccp, ccpPath) {
  const ccpDir = path.dirname(ccpPath);
  const peers = ccp.peers || {};
  const cas = ccp.certificateAuthorities || {};

  Object.values(peers).forEach((peer) => {
    if (peer?.tlsCACerts?.path && !path.isAbsolute(peer.tlsCACerts.path)) {
      peer.tlsCACerts.path = path.resolve(ccpDir, peer.tlsCACerts.path);
    }
  });

  Object.values(cas).forEach((ca) => {
    if (ca?.tlsCACerts?.path && !path.isAbsolute(ca.tlsCACerts.path)) {
      ca.tlsCACerts.path = path.resolve(ccpDir, ca.tlsCACerts.path);
    }
  });
}

async function enroll() {
  const ccpPath = resolvePath(
    process.env.FABRIC_CCP_PATH,
    '../blockchain/config/connection-org1.json'
  );
  const walletPath = resolvePath(process.env.FABRIC_WALLET_PATH, './wallet');
  const mspId = process.env.FABRIC_ORG_MSP || 'Org1MSP';
  const appUserId = process.env.FABRIC_APP_USER_ID || 'appUser';
  const appUserSecret = process.env.FABRIC_APP_USER_SECRET || 'appUserpw';

  if (!fs.existsSync(ccpPath)) {
    throw new Error(`Connection profile not found: ${ccpPath}`);
  }

  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  normalizeCcpPaths(ccp, ccpPath);

  const caKey = Object.keys(ccp.certificateAuthorities || {})[0];
  if (!caKey) {
    throw new Error('No certificateAuthorities entry found in connection profile');
  }

  const caInfo = ccp.certificateAuthorities[caKey];
  const tlsPath = caInfo?.tlsCACerts?.path;
  let trustedRoots;

  if (tlsPath && fs.existsSync(tlsPath)) {
    trustedRoots = [fs.readFileSync(tlsPath, 'utf8')];
  }

  const ca = new FabricCAServices(
    caInfo.url,
    trustedRoots ? { trustedRoots, verify: false } : { verify: false },
    caInfo.caName || caKey
  );

  const wallet = await Wallets.newFileSystemWallet(walletPath);
  console.log(`Wallet path: ${walletPath}`);

  let adminIdentity = await wallet.get('admin');
  if (!adminIdentity) {
    const adminEnrollment = await ca.enroll({
      enrollmentID: process.env.FABRIC_CA_ADMIN_ID || 'admin',
      enrollmentSecret: process.env.FABRIC_CA_ADMIN_SECRET || 'adminpw'
    });

    adminIdentity = {
      credentials: {
        certificate: adminEnrollment.certificate,
        privateKey: adminEnrollment.key.toBytes()
      },
      mspId,
      type: 'X.509'
    };

    await wallet.put('admin', adminIdentity);
    console.log('Enrolled CA admin identity: admin');
  } else {
    console.log('CA admin identity already exists: admin');
  }

  const userIdentity = await wallet.get(appUserId);
  if (userIdentity) {
    console.log(`App identity already exists: ${appUserId}`);
    return;
  }

  const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
  const adminUser = await provider.getUserContext(adminIdentity, 'admin');

  let registeredSecret = appUserSecret;
  try {
    registeredSecret = await ca.register(
      {
        affiliation: process.env.FABRIC_APP_USER_AFFILIATION || 'org1.department1',
        enrollmentID: appUserId,
        role: 'client'
      },
      adminUser
    );
    console.log(`Registered app identity with CA: ${appUserId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('already registered')) {
      throw error;
    }
    console.log(`App identity already registered in CA: ${appUserId}`);
  }

  const userEnrollment = await ca.enroll({
    enrollmentID: appUserId,
    enrollmentSecret: registeredSecret
  });

  const appIdentity = {
    credentials: {
      certificate: userEnrollment.certificate,
      privateKey: userEnrollment.key.toBytes()
    },
    mspId,
    type: 'X.509'
  };

  await wallet.put(appUserId, appIdentity);
  console.log(`Enrolled and imported app identity: ${appUserId}`);
}

enroll()
  .then(() => {
    console.log('Enrollment completed successfully.');
  })
  .catch((error) => {
    console.error('Enrollment failed:', error);
    process.exit(1);
  });
