// Facebook Pixel and Tawk.to TypeScript declarations
declare global {
  interface Window {
    fbq: (action: string, event: string, parameters?: Record<string, any>) => void;
    Tawk_API: any;
    Tawk_LoadStart: Date;
  }
}

export {};
