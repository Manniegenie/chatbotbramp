import React from 'react'
import './landing-page.css'

interface PriceData {
  symbol: string
  price: string
  change: string
  changePercent: string
  isPositive: boolean
  icon: string
}

const PriceTicker: React.FC = () => {
  // Icon mapping
  const iconMap: Record<string, string> = {
    'BTC': '/icons/btc-icon.png',
    'ETH': '/icons/eth-icon.png',
    'SOL': '/icons/sol-icon.png',
    'USDT': '/icons/usdt-icon.png',
    'USDC': '/icons/usdc-icon.png',
    'BNB': '/icons/bnb-icon.png',
    'MATIC': '/icons/matic-icon.png',
    'TRX': '/icons/Tron.png',
  }

  // Sample price data - in production, this would come from an API
  const prices: PriceData[] = [
    { symbol: 'BTC', price: '₦95,234,500', change: '+2.5%', changePercent: '+2.5%', isPositive: true, icon: iconMap['BTC'] },
    { symbol: 'ETH', price: '₦3,245,800', change: '-1.2%', changePercent: '-1.2%', isPositive: false, icon: iconMap['ETH'] },
    { symbol: 'SOL', price: '₦245,600', change: '+5.8%', changePercent: '+5.8%', isPositive: true, icon: iconMap['SOL'] },
    { symbol: 'USDT', price: '₦1,520', change: '+0.1%', changePercent: '+0.1%', isPositive: true, icon: iconMap['USDT'] },
    { symbol: 'USDC', price: '₦1,518', change: '+0.05%', changePercent: '+0.05%', isPositive: true, icon: iconMap['USDC'] },
    { symbol: 'BNB', price: '₦425,300', change: '-0.8%', changePercent: '-0.8%', isPositive: false, icon: iconMap['BNB'] },
    { symbol: 'MATIC', price: '₦1,245', change: '+3.2%', changePercent: '+3.2%', isPositive: true, icon: iconMap['MATIC'] },
    { symbol: 'TRX', price: '₦185', change: '-0.5%', changePercent: '-0.5%', isPositive: false, icon: iconMap['TRX'] },
  ]

  // Duplicate the array for seamless scrolling
  const duplicatedPrices = [...prices, ...prices]

  return (
    <div className="price-ticker-container">
      <div className="price-ticker-wrapper">
        <div className="price-ticker-content">
          {duplicatedPrices.map((item, index) => (
            <div key={index} className="price-ticker-item">
              <img src={item.icon} alt={item.symbol} className="price-ticker-icon" />
              <span className="price-ticker-symbol">{item.symbol}</span>
              <span className="price-ticker-price">{item.price}</span>
              <span className={`price-ticker-change ${item.isPositive ? 'positive' : 'negative'}`}>
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PriceTicker
