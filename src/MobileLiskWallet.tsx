// src/MobileLiskWallet.tsx
import React, { useState, useEffect } from 'react';
import { authFetch } from './lib/tokenManager';
import './MobileGame.css'; // Reuse styles
import MetaMaskIcon from './assets/MetaMask-icon-fox-with-margins.svg';
import SolflareIcon from './assets/Solflare_id5j73wBTF_0.png';
import TrustWalletIcon from './assets/Trust_Stacked Logo_Blue.png';
import PhantomIcon from './assets/phantom.svg';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

type WalletState = 'idle' | 'connecting' | 'signing' | 'verifying' | 'connected' | 'error';
type WalletType = 'metamask' | 'solflare' | 'trust' | 'phantom' | null;
type WalletChain = 'lisk' | 'solana' | null;

export default function MobileLiskWallet({ onClose }: { onClose?: () => void }) {
  const [walletState, setWalletState] = useState<WalletState>('idle');
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | 'devnet'>('mainnet');
  const [selectedWallet, setSelectedWallet] = useState<WalletType>(null);
  const [walletChain, setWalletChain] = useState<WalletChain>(null);

  // Check if wallet is already connected
  useEffect(() => {
    checkWalletConnection();
    checkSolanaWalletConnection();
  }, []);

  async function checkSolanaWalletConnection() {
    try {
      const response = await authFetch(`${API_BASE}/solana/account`, {
        method: 'GET'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.wallet) {
          setWalletInfo(data.wallet);
          setWalletState('connected');
          setWalletChain('solana');
        }
      }
    } catch (err) {
      // No Solana wallet connected, that's okay
      console.log('No Solana wallet connected');
    }
  }

  async function checkWalletConnection() {
    try {
      const response = await authFetch(`${API_BASE}/lisk/account`, {
        method: 'GET'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.wallet) {
          setWalletInfo(data.wallet);
          setWalletState('connected');
        } else {
          setWalletState('idle');
        }
      } else if (response.status === 404 || response.status === 400) {
        // No wallet connected (404) or error response (400)
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'No Lisk wallet connected') {
          setWalletState('idle');
        } else {
          throw new Error(errorData.error || 'Failed to check wallet status');
        }
      } else {
        throw new Error('Failed to check wallet status');
      }
    } catch (err) {
      console.error('Failed to check wallet:', err);
      setWalletState('idle');
    }
  }

  async function initiateConnection() {
    try {
      setWalletState('connecting');
      setError(null);

      const response = await authFetch(`${API_BASE}/lisk/connect`, {
        method: 'POST',
        body: JSON.stringify({ network }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.message) {
        setConnectionMessage(data.message);
        setWalletState('signing');
        // In a real implementation, you would trigger wallet signing here
        // For now, we'll show instructions
      } else {
        throw new Error(data.error || 'Failed to initiate connection');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate wallet connection');
      setWalletState('error');
    }
  }

  async function verifyConnection(address: string, signature: string) {
    try {
      setWalletState('verifying');
      setError(null);

      const response = await authFetch(`${API_BASE}/lisk/verify`, {
        method: 'POST',
        body: JSON.stringify({
          address,
          signature,
          message: connectionMessage,
          network
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.wallet) {
        setWalletInfo(data.wallet);
        setWalletState('connected');
        setConnectionMessage(null);
      } else {
        throw new Error(data.error || 'Failed to verify connection');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify wallet connection');
      setWalletState('error');
    }
  }

  async function disconnectWallet() {
    try {
      const endpoint = walletChain === 'solana' ? '/solana/disconnect' : '/lisk/disconnect';
      const response = await authFetch(`${API_BASE}${endpoint}`, {
        method: 'POST'
      });

      if (response.ok) {
        setWalletInfo(null);
        setWalletState('idle');
        setConnectionMessage(null);
        setWalletChain(null);
        setSelectedWallet(null);
      }
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
    }
  }

  // Solana wallet connection functions - All connections go through backend
  async function initiateSolanaConnection(walletType: string) {
    try {
      setWalletState('connecting');
      setError(null);

      const solanaNetwork = network === 'testnet' ? 'testnet' : network === 'devnet' ? 'devnet' : 'mainnet';
      
      // Call backend to initiate connection and get message to sign
      const response = await authFetch(`${API_BASE}/solana/connect`, {
        method: 'POST',
        body: JSON.stringify({ 
          network: solanaNetwork,
          connectionMethod: walletType 
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.message) {
        setConnectionMessage(data.message);
        setWalletState('signing');
        return data.message;
      } else {
        throw new Error(data.error || 'Failed to initiate connection');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate wallet connection');
      setWalletState('error');
      throw err;
    }
  }

  async function verifySolanaConnection(address: string, signature: string | Uint8Array) {
    try {
      setWalletState('verifying');
      setError(null);

      // Convert signature to base64 if it's Uint8Array
      let signatureString: string;
      if (signature instanceof Uint8Array) {
        // Convert Uint8Array to base64 in browser
        const binary = Array.from(signature, byte => String.fromCharCode(byte)).join('');
        signatureString = btoa(binary);
      } else {
        signatureString = signature;
      }

      const solanaNetwork = network === 'testnet' ? 'testnet' : network === 'devnet' ? 'devnet' : 'mainnet';
      const response = await authFetch(`${API_BASE}/solana/verify`, {
        method: 'POST',
        body: JSON.stringify({
          address,
          signature: signatureString,
          message: connectionMessage,
          network: solanaNetwork,
          connectionMethod: selectedWallet || 'extension'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.wallet) {
        setWalletInfo(data.wallet);
        setWalletState('connected');
        setWalletChain('solana');
        setConnectionMessage(null);
      } else {
        throw new Error(data.error || 'Failed to verify connection');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify wallet connection');
      setWalletState('error');
    }
  }

  // Connect with Phantom wallet - All verification goes through backend
  async function connectWithPhantom() {
    try {
      setSelectedWallet('phantom');
      setWalletChain('solana');
      setError(null);
      
      // Step 1: Check if wallet is installed
      if (typeof window === 'undefined' || !(window as any).solana || !(window as any).solana.isPhantom) {
        throw new Error('Phantom wallet not detected. Please install Phantom wallet extension.');
      }

      const phantom = (window as any).solana;

      // Step 2: Connect to Phantom wallet (frontend only - required for browser extension)
      let address: string;
      try {
        const response = await phantom.connect();
        address = response.publicKey.toString();
      } catch (connectErr: any) {
        if (connectErr.code === 4001) {
          throw new Error('Connection rejected by user');
        }
        throw new Error('Failed to connect to Phantom wallet. Please try again.');
      }

      // Step 3: Get connection message from backend
      const message = await initiateSolanaConnection('phantom');
      if (!message) {
        throw new Error('Failed to get connection message from server');
      }

      // Step 4: Request wallet to sign message (frontend only - required for browser extension)
      const encodedMessage = new TextEncoder().encode(message);
      let signedMessage: any;
      try {
        signedMessage = await phantom.signMessage(encodedMessage, 'utf8');
      } catch (signErr: any) {
        if (signErr.code === 4001) {
          throw new Error('Signature request rejected by user');
        }
        throw new Error('Failed to sign message. Please try again.');
      }
      
      if (!signedMessage || !signedMessage.signature) {
        throw new Error('Failed to get signature from wallet');
      }

      // Step 5: Send signature to backend for verification and storage
      await verifySolanaConnection(address, signedMessage.signature);
    } catch (err: any) {
      setError(err.message || 'Failed to connect with Phantom');
      setWalletState('error');
    }
  }

  // Connect with Solflare wallet - All verification goes through backend
  async function connectWithSolflare() {
    try {
      setSelectedWallet('solflare');
      setWalletChain('solana');
      setError(null);
      
      // Step 1: Check if wallet is installed
      if (typeof window === 'undefined' || !(window as any).solflare) {
        throw new Error('Solflare wallet not detected. Please install Solflare wallet extension.');
      }

      const solflare = (window as any).solflare;

      // Step 2: Connect to Solflare wallet (frontend only - required for browser extension)
      let address: string;
      try {
        await solflare.connect();
        if (!solflare.publicKey) {
          throw new Error('No public key returned');
        }
        address = solflare.publicKey.toString();
      } catch (connectErr: any) {
        if (connectErr.code === 4001) {
          throw new Error('Connection rejected by user');
        }
        throw new Error('Failed to connect to Solflare wallet. Please try again.');
      }

      // Step 3: Get connection message from backend
      const message = await initiateSolanaConnection('solflare');
      if (!message) {
        throw new Error('Failed to get connection message from server');
      }

      // Step 4: Request wallet to sign message (frontend only - required for browser extension)
      const encodedMessage = new TextEncoder().encode(message);
      let signedMessage: any;
      try {
        signedMessage = await solflare.signMessage(encodedMessage, 'utf8');
      } catch (signErr: any) {
        if (signErr.code === 4001) {
          throw new Error('Signature request rejected by user');
        }
        throw new Error('Failed to sign message. Please try again.');
      }
      
      if (!signedMessage || !signedMessage.signature) {
        throw new Error('Failed to get signature from wallet');
      }

      // Step 5: Send signature to backend for verification and storage
      await verifySolanaConnection(address, signedMessage.signature);
    } catch (err: any) {
      setError(err.message || 'Failed to connect with Solflare');
      setWalletState('error');
    }
  }

  // Connect with Trust Wallet - All verification goes through backend
  async function connectWithTrustWallet() {
    try {
      setSelectedWallet('trust');
      setWalletChain('solana');
      setError(null);
      
      // Step 1: Check if wallet is installed
      if (typeof window === 'undefined' || !(window as any).trustwallet) {
        throw new Error('Trust Wallet not detected. Please install Trust Wallet extension.');
      }

      const trustWallet = (window as any).trustwallet;

      // Step 2: Connect to Trust Wallet (frontend only - required for browser extension)
      let address: string;
      try {
        const accounts = await trustWallet.request({
          method: 'solana_requestAccounts'
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found');
        }
        address = accounts[0];
      } catch (connectErr: any) {
        if (connectErr.code === 4001) {
          throw new Error('Connection rejected by user');
        }
        // Trust Wallet might not support Solana directly
        throw new Error('Trust Wallet Solana support may not be available. Please use Phantom or Solflare for Solana wallets.');
      }

      // Step 3: Get connection message from backend
      const message = await initiateSolanaConnection('trust');
      if (!message) {
        throw new Error('Failed to get connection message from server');
      }

      // Step 4: Request wallet to sign message (frontend only - required for browser extension)
      const encodedMessage = new TextEncoder().encode(message);
      let signature: any;
      try {
        signature = await trustWallet.request({
          method: 'solana_signMessage',
          params: {
            message: encodedMessage,
            display: 'utf8'
          }
        });
      } catch (signErr: any) {
        if (signErr.code === 4001) {
          throw new Error('Signature request rejected by user');
        }
        throw new Error('Failed to sign message. Please try again.');
      }

      if (!signature) {
        throw new Error('Failed to get signature from wallet');
      }

      // Step 5: Send signature to backend for verification and storage
      await verifySolanaConnection(address, signature);
    } catch (err: any) {
      setError(err.message || 'Failed to connect with Trust Wallet');
      setWalletState('error');
    }
  }

  // Handle MetaMask connection (for Lisk via MetaMask) - All verification goes through backend
  async function connectWithMetaMask() {
    try {
      setSelectedWallet('metamask');
      setWalletChain('lisk');
      setError(null);
      
      // Step 1: Check if wallet is installed
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('MetaMask not detected. Please install MetaMask and add the Lisk network.');
      }
      
      const ethereum = (window as any).ethereum;

      // Step 2: Add Lisk network to MetaMask if not already added (frontend only)
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x46F', // 1135 in hex
            chainName: 'Lisk',
            nativeCurrency: {
              name: 'LSK',
              symbol: 'LSK',
              decimals: 18
            },
            rpcUrls: ['https://rpc.api.lisk.com'],
            blockExplorerUrls: ['https://blockscout.lisk.com']
          }]
        });
      } catch (addError: any) {
        // Network might already be added, continue
        if (!addError.message?.includes('already') && addError.code !== 4902) {
          console.warn('Failed to add Lisk network:', addError);
        }
      }

      // Step 3: Request account access (frontend only - required for browser extension)
      let address: string;
      try {
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
        }
        address = accounts[0];
      } catch (connectErr: any) {
        if (connectErr.code === 4001) {
          throw new Error('Connection rejected by user');
        }
        throw new Error('Failed to connect to MetaMask. Please try again.');
      }

      // Step 4: Get connection message from backend
      if (!connectionMessage) {
        await initiateConnection();
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (!connectionMessage) {
        throw new Error('Failed to get connection message from server');
      }

      // Step 5: Request wallet to sign message (frontend only - required for browser extension)
      let signature: string;
      try {
        signature = await ethereum.request({
        method: 'personal_sign',
        params: [connectionMessage, address]
      });
      } catch (signErr: any) {
        if (signErr.code === 4001) {
          throw new Error('Signature request rejected by user');
        }
        throw new Error('Failed to sign message. Please try again.');
      }

      // Step 6: Send signature to backend for verification and storage
      await verifyConnection(address, signature);
    } catch (err: any) {
      setError(err.message || 'Failed to connect with MetaMask');
      setWalletState('error');
    }
  }

  return (
    <div className="mobile-wam-container" style={{ padding: '20px', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>Connect Wallet</h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px'
          }}
          aria-label="Close Wallet"
        >
          ×
        </button>
      </div>

      {walletState === 'idle' && (
        <div style={{ color: '#fff' }}>
          <p style={{ marginBottom: '24px', textAlign: 'center' }}>
            Select a wallet to connect
          </p>
          
          {/* Wallet Grid - 3 per row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* MetaMask */}
            <button
              onClick={() => {
                setSelectedWallet('metamask');
                connectWithMetaMask();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 8px',
                borderRadius: '12px',
                background: selectedWallet === 'metamask' ? 'rgba(24, 249, 110, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: selectedWallet === 'metamask' ? '2px solid #18f96e' : '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: '100px'
              }}
              onMouseEnter={(e) => {
                if (selectedWallet !== 'metamask') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedWallet !== 'metamask') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              <img 
                src={MetaMaskIcon} 
                alt="MetaMask" 
                style={{ width: '48px', height: '48px', marginBottom: '8px' }}
              />
              <span style={{ fontSize: '12px', fontWeight: '500' }}>MetaMask</span>
            </button>

            {/* Solflare */}
            <button
              onClick={() => {
                connectWithSolflare();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 8px',
                borderRadius: '12px',
                background: selectedWallet === 'solflare' ? 'rgba(24, 249, 110, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: selectedWallet === 'solflare' ? '2px solid #18f96e' : '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: '100px'
              }}
              onMouseEnter={(e) => {
                if (selectedWallet !== 'solflare') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedWallet !== 'solflare') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              <img 
                src={SolflareIcon} 
                alt="Solflare" 
                style={{ width: '48px', height: '48px', marginBottom: '8px', objectFit: 'contain' }}
              />
              <span style={{ fontSize: '12px', fontWeight: '500' }}>Solflare</span>
            </button>

            {/* Trust Wallet */}
            <button
              onClick={() => {
                connectWithTrustWallet();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 8px',
                borderRadius: '12px',
                background: selectedWallet === 'trust' ? 'rgba(24, 249, 110, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: selectedWallet === 'trust' ? '2px solid #18f96e' : '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: '100px'
              }}
              onMouseEnter={(e) => {
                if (selectedWallet !== 'trust') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedWallet !== 'trust') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              <img 
                src={TrustWalletIcon} 
                alt="Trust Wallet" 
                style={{ width: '48px', height: '48px', marginBottom: '8px', objectFit: 'contain' }}
              />
              <span style={{ fontSize: '12px', fontWeight: '500' }}>Trust Wallet</span>
            </button>

            {/* Phantom */}
            <button
              onClick={() => {
                connectWithPhantom();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 8px',
                borderRadius: '12px',
                background: selectedWallet === 'phantom' ? 'rgba(24, 249, 110, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: selectedWallet === 'phantom' ? '2px solid #18f96e' : '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: '100px'
              }}
              onMouseEnter={(e) => {
                if (selectedWallet !== 'phantom') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedWallet !== 'phantom') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              <img 
                src={PhantomIcon} 
                alt="Phantom" 
                style={{ width: '48px', height: '48px', marginBottom: '8px', objectFit: 'contain' }}
              />
              <span style={{ fontSize: '12px', fontWeight: '500' }}>Phantom</span>
            </button>
          </div>

          {/* Network Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '14px' }}>
              Network:
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'testnet' | 'devnet')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                width: '100%',
                fontSize: '14px'
              }}
            >
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
              <option value="devnet">Devnet</option>
            </select>
          </div>
        </div>
      )}

      {walletState === 'connecting' && (
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div className="mobile-spinner" style={{ margin: '20px auto' }} />
          <p>Initiating connection...</p>
        </div>
      )}

      {walletState === 'signing' && connectionMessage && (
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <p style={{ marginBottom: '20px' }}>
            Please sign this message with your wallet:
          </p>
          <div
            style={{
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              marginBottom: '20px',
              wordBreak: 'break-word',
              fontSize: '14px'
            }}
          >
            {connectionMessage}
          </div>
          <button
            onClick={connectWithMetaMask}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: '#18f96e',
              color: '#000',
              border: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '12px'
            }}
          >
            Sign with MetaMask
          </button>
          <p style={{ fontSize: '12px', opacity: 0.7 }}>
            Or use your wallet app to sign the message above
          </p>
        </div>
      )}

      {walletState === 'verifying' && (
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div className="mobile-spinner" style={{ margin: '20px auto' }} />
          <p>Verifying connection...</p>
        </div>
      )}

      {walletState === 'connected' && walletInfo && (
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
              ✓ Wallet Connected
            </p>
            <div
              style={{
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                marginBottom: '12px',
                textAlign: 'left'
              }}
            >
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Address:</strong> {walletInfo.address}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Network:</strong> {walletInfo.network}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Balance:</strong> {
                  walletChain === 'solana' 
                    ? `${Number(walletInfo.balance || 0)} SOL`
                    : `${Number(walletInfo.balance || 0) / 1e8} LSK`
                }
              </p>
            </div>
          </div>
          <button
            onClick={disconnectWallet}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'transparent',
              color: '#fff',
              border: '2px solid #ff4444',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Disconnect Wallet
          </button>
        </div>
      )}

      {walletState === 'error' && error && (
        <div style={{ textAlign: 'center', color: '#ff4444' }}>
          <p style={{ marginBottom: '20px' }}>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setWalletState('idle');
              setConnectionMessage(null);
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: '#18f96e',
              color: '#000',
              border: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

