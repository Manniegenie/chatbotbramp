// src/components/CryptoIcons.tsx
import React from 'react';

interface IconProps {
    size?: number | string;
    className?: string;
    style?: React.CSSProperties;
}

export const Bitcoin = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 256 256"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <defs>
            <linearGradient id="logosBitcoin0" x1="49.973%" x2="49.973%" y1="-.024%" y2="99.99%">
                <stop offset="0%" stopColor="#F9AA4B"></stop>
                <stop offset="100%" stopColor="#F7931A"></stop>
            </linearGradient>
        </defs>
        <path fill="url(#logosBitcoin0)" d="M252.171 158.954c-17.102 68.608-86.613 110.314-155.123 93.211c-68.61-17.102-110.316-86.61-93.213-155.119C20.937 28.438 90.347-13.268 158.957 3.835c68.51 17.002 110.317 86.51 93.214 155.119Z"></path>
        <path fill="#000000" d="M188.945 112.05c2.5-17-10.4-26.2-28.2-32.3l5.8-23.1l-14-3.5l-5.6 22.5c-3.7-.9-7.5-1.8-11.3-2.6l5.6-22.6l-14-3.5l-5.7 23c-3.1-.7-6.1-1.4-9-2.1v-.1l-19.4-4.8l-3.7 15s10.4 2.4 10.2 2.5c5.7 1.4 6.7 5.2 6.5 8.2l-6.6 26.3c.4.1.9.2 1.5.5c-.5-.1-1-.2-1.5-.4l-9.2 36.8c-.7 1.7-2.5 4.3-6.4 3.3c.1.2-10.2-2.5-10.2-2.5l-7 16.1l18.3 4.6c3.4.9 6.7 1.7 10 2.6l-5.8 23.3l14 3.5l5.8-23.1c3.8 1 7.6 2 11.2 2.9l-5.7 23l14 3.5l5.8-23.3c24 4.5 42 2.7 49.5-19c6.1-17.4-.3-27.5-12.9-34.1c9.3-2.1 16.2-8.2 18-20.6Zm-32.1 45c-4.3 17.4-33.7 8-43.2 5.6l7.7-30.9c9.5 2.4 40.1 7.1 35.5 25.3Zm4.4-45.3c-4 15.9-28.4 7.8-36.3 5.8l7-28c7.9 2 33.4 5.7 29.3 22.2Z"></path>
    </svg>
);

export const EthereumCircleFlat = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 14 14"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <g fill="none">
            <path fill="#8fbffa" d="M7 14A7 7 0 1 0 7 0a7 7 0 0 0 0 14"></path>
            <path fill="#2859c5" fillRule="evenodd" d="M7 2.5a.5.5 0 0 1 .384.18l2.5 3a.5.5 0 0 1-.072.71l-2.5 2a.5.5 0 0 1-.624 0l-2.5-2a.5.5 0 0 1-.072-.71l2.5-3A.5.5 0 0 1 7 2.5M4.89 8.512a.625.625 0 0 0-.78.976l2.5 2a.625.625 0 0 0 .78 0l2.5-2a.625.625 0 1 0-.78-.976L7 10.2z" clipRule="evenodd"></path>
        </g>
    </svg>
);

export const Solana = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <g fill="none">
            <path fill="url(#tokenBrandedSolana0)" d="M16.886 8.876a.47.47 0 0 1-.313.124H5.584c-.39 0-.587-.446-.317-.707l1.805-1.74a.46.46 0 0 1 .312-.129h11.032c.394 0 .587.45.313.712z"></path>
            <path fill="url(#tokenBrandedSolana1)" d="M16.886 17.452a.47.47 0 0 1-.313.12H5.584c-.39 0-.587-.442-.317-.703l1.805-1.745A.45.45 0 0 1 7.384 15h11.032c.394 0 .587.446.313.707z"></path>
            <path fill="url(#tokenBrandedSolana2)" d="M16.886 10.834a.47.47 0 0 0-.313-.12H5.584c-.39 0-.587.442-.317.703l1.805 1.745a.47.47 0 0 0 .312.124h11.032c.394 0 .587-.446.313-.707z"></path>
            <defs>
                <linearGradient id="tokenBrandedSolana0" x1="5.143" x2="19.207" y1="44.793" y2="44.664" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#599DB0"></stop>
                    <stop offset="1" stopColor="#47F8C3"></stop>
                </linearGradient>
                <linearGradient id="tokenBrandedSolana1" x1="5.143" x2="19.117" y1="9.84" y2="9.733" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#C44FE2"></stop>
                    <stop offset="1" stopColor="#73B0D0"></stop>
                </linearGradient>
                <linearGradient id="tokenBrandedSolana2" x1="5.932" x2="18.326" y1="12" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#778CBF"></stop>
                    <stop offset="1" stopColor="#5DCDC9"></stop>
                </linearGradient>
            </defs>
        </g>
    </svg>
);

export const Usdt = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <g fill="none" fillRule="evenodd">
            <circle cx="16" cy="16" r="16" fill="#26A17B"></circle>
            <path fill="#FFF" d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042c-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658c0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061c1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658c0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118c0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116c0-1.043-3.301-1.914-7.694-2.117"></path>
        </g>
    </svg>
);

export const Bnb = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <path fill="#F0B90B" d="M7.792 6.647L12 4.286l4.209 2.361l-1.543.874L12 6.03L9.34 7.52zm8.417 2.983l-1.543-.874L12 10.247L9.34 8.756l-1.547.874v1.744l2.657 1.492v2.978l1.551.874l1.547-.874v-2.978l2.662-1.492zm0 4.727V12.61l-1.543.874v1.744zm1.101.617l-2.661 1.487v1.749l4.208-2.366v-4.723l-1.547.87zM15.763 8.14l1.543.874v1.744l1.551-.87V8.14l-1.547-.875l-1.547.879zm-5.314 8.957v1.744l1.551.874l1.547-.874V17.1L12 17.97l-1.547-.874zm-2.657-2.743l1.543.874v-1.744l-1.543-.875v1.75zm2.657-6.214L12 9.013l1.547-.874L12 7.264l-1.547.879zm-3.759.874l1.547-.874l-1.543-.875l-1.55.879V9.89l1.546.87zm0 2.978l-1.547-.87v4.723l4.209 2.366v-1.753L6.694 14.97v-2.983z"></path>
    </svg>
);

export const Usdc = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <g fill="none">
            <circle cx="16" cy="16" r="16" fill="#3E73C4"></circle>
            <g fill="#FFF">
                <path d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156c-1.828-.243-2.193-.728-2.193-1.578c0-.85.61-1.396 1.828-1.396c1.097 0 1.707.364 2.011 1.275a.458.458 0 0 0 .427.303h.975a.416.416 0 0 0 .427-.425v-.06a3.04 3.04 0 0 0-2.743-2.489V9.142c0-.243-.183-.425-.487-.486h-.915c-.243 0-.426.182-.487.486v1.396c-1.829.242-2.986 1.456-2.986 2.974c0 2.002 1.218 2.791 3.778 3.095c1.707.303 2.255.668 2.255 1.639c0 .97-.853 1.638-2.011 1.638c-1.585 0-2.133-.667-2.316-1.578c-.06-.242-.244-.364-.427-.364h-1.036a.416.416 0 0 0-.426.425v.06c.243 1.518 1.219 2.61 3.23 2.914v1.457c0 .242.183.425.487.485h.915c.243 0 .426-.182.487-.485V21.34c1.829-.303 3.047-1.578 3.047-3.217z"></path>
                <path d="M12.892 24.497c-4.754-1.7-7.192-6.98-5.424-11.653c.914-2.55 2.925-4.491 5.424-5.402c.244-.121.365-.303.365-.607v-.85c0-.242-.121-.424-.365-.485c-.061 0-.183 0-.244.06a10.895 10.895 0 0 0-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102c.244.121.488 0 .548-.243c.061-.06.061-.122.061-.243v-.85c0-.182-.182-.424-.365-.546zm6.46-18.936c-.244-.122-.488 0-.548.242c-.061.061-.061.122-.061.243v.85c0 .243.182.485.365.607c4.754 1.7 7.192 6.98 5.424 11.653c-.914 2.55-2.925 4.491-5.424 5.402c-.244.121-.365.303-.365.607v.85c0 .242.121.424.365.485c.061 0 .183 0 .244-.06a10.895 10.895 0 0 0 7.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162z"></path>
            </g>
        </g>
    </svg>
);

export const Exchange02 = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <defs>
            <linearGradient id="crypto-gradient-exchange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A80077" />
                <stop offset="100%" stopColor="#66FF00" />
            </linearGradient>
        </defs>
        <path
            fill="none"
            stroke="url(#crypto-gradient-exchange)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M4.125 9.5v-6M6 3.5V2m0 9V9.5m-1.875-3h3.75m0 0C8.496 6.5 9 7.004 9 7.625v.75C9 8.996 8.496 9.5 7.875 9.5H3m4.875-3C8.496 6.5 9 5.996 9 5.375v-.75C9 4.004 8.496 3.5 7.875 3.5H3m12 14l3-4.5l3 4.5m-6 0l3 4.5l3-4.5m-6 0l3 1.125l3-1.125M12 5c2.828 0 5.243 0 6.121.799S19 7.429 19 10l-2-1m-5 10c-2.828 0-5.243 0-6.121-.799S5 16.571 5 14l2 1"
            color="currentColor"
        ></path>
    </svg>
);

export const Send = ({ size = 24, className = '', style, active = false, ...props }: IconProps & React.SVGProps<SVGSVGElement> & { active?: boolean }) => {
    const gradientId = `send-gradient-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={`send-icon ${className} ${active ? 'send-icon--active' : ''}`}
            style={style}
            {...props}
        >
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A80077" />
                    <stop offset="100%" stopColor="#66FF00" />
                </linearGradient>
            </defs>
            <path
                fill="none"
                stroke={active ? "white" : "currentColor"}
                strokeWidth="2"
                d="M22 3L2 11l18.5 8L22 3ZM10 20.5l3-4.5m2.5-6.5L9 14l.859 6.012c.078.546.216.537.306-.003L11 15l4.5-5.5Z"
            />
        </svg>
    );
};