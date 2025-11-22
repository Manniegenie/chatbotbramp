// src/MobileLiskWallet.tsx
import React, { useState, useEffect } from 'react';
import { authFetch } from './lib/tokenManager';
import './MobileGame.css'; // Reuse styles

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

type WalletState = 'idle' | 'connecting' | 'signing' | 'verifying' | 'connected' | 'error';

export default function MobileLiskWallet({ onClose }: { onClose?: () => void }) {
  const [walletState, setWalletState] = useState<WalletState>('idle');
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('mainnet');

  // Check if wallet is already connected
  useEffect(() => {
    checkWalletConnection();
  }, []);

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
      const response = await authFetch(`${API_BASE}/lisk/disconnect`, {
        method: 'POST'
      });

      if (response.ok) {
        setWalletInfo(null);
        setWalletState('idle');
        setConnectionMessage(null);
      }
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
    }
  }

  // Handle MetaMask connection (for Lisk via MetaMask)
  async function connectWithMetaMask() {
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('MetaMask not detected. Please install MetaMask and add the Lisk network.');
      }
      
      const ethereum = (window as any).ethereum;

      // Add Lisk network to MetaMask if not already added
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
        if (!addError.message?.includes('already')) {
          console.warn('Failed to add Lisk network:', addError);
        }
      }

      // Request account access
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];

      // Get connection message
      if (!connectionMessage) {
        await initiateConnection();
        return; // Will trigger signing on next step
      }

      // Sign message
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [connectionMessage, address]
      });

      // Verify connection
      await verifyConnection(address, signature);
    } catch (err: any) {
      setError(err.message || 'Failed to connect with MetaMask');
      setWalletState('error');
    }
  }

  return (
    <div className="mobile-wam-container" style={{ padding: '20px', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>Connect Lisk Wallet</h2>
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
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <p style={{ marginBottom: '20px' }}>
            Connect your Lisk wallet to view your balance and manage your LSK tokens.
          </p>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>
              Network:
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'testnet')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                width: '100%'
              }}
            >
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
            </select>
          </div>
          <button
            onClick={initiateConnection}
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
            Connect Wallet
          </button>
          <button
            onClick={connectWithMetaMask}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'transparent',
              color: '#fff',
              border: '2px solid #18f96e',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Connect with MetaMask
          </button>
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
            Please sign this message with your Lisk wallet:
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
            Or use your Lisk wallet app to sign the message above
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
                <strong>Balance:</strong> {Number(walletInfo.balance || 0) / 1e8} LSK
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

