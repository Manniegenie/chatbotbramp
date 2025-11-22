// src/types/ethereum.d.ts
interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  isMetaMask?: boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}

