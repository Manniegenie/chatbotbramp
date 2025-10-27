// Facebook Pixel TypeScript declarations
declare global {
  interface Window {
    fbq: (action: string, event: string, parameters?: Record<string, any>) => void;
  }
}

export {};
