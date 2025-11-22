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
        viewBox="0 0 24 24"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <defs>
            <linearGradient id="crypto-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A80077" />
                <stop offset="100%" stopColor="#66FF00" />
            </linearGradient>
        </defs>
        <path fill="url(#crypto-gradient)" d="m11.953 8.819l-.547 2.19c.619.154 2.529.784 2.838-.456c.322-1.291-1.673-1.579-2.291-1.734zm-.822 3.296l-.603 2.415c.743.185 3.037.921 3.376-.441c.355-1.422-2.029-1.789-2.773-1.974z"></path>
        <path fill="url(#crypto-gradient)" d="M14.421 2.299C9.064.964 3.641 4.224 2.306 9.581C.97 14.936 4.23 20.361 9.583 21.697c5.357 1.335 10.783-1.924 12.117-7.281c1.336-5.356-1.924-10.781-7.279-12.117zm1.991 8.275c-.145.974-.686 1.445-1.402 1.611c.985.512 1.485 1.298 1.009 2.661c-.592 1.691-1.998 1.834-3.87 1.48l-.454 1.82l-1.096-.273l.447-1.794a44.624 44.624 0 0 1-.875-.228l-.449 1.804l-1.095-.275l.454-1.823c-.257-.066-.517-.136-.782-.202L6.87 15l.546-1.256s.808.215.797.199c.311.077.448-.125.502-.261l.719-2.875l.115.029a.864.864 0 0 0-.114-.037l.512-2.053c.013-.234-.066-.528-.511-.639c.018-.011-.797-.198-.797-.198l.291-1.172l1.514.378l-.001.005c.227.057.461.111.7.165l.449-1.802l1.097.273l-.44 1.766c.294.067.591.135.879.207l.438-1.755l1.097.273l-.449 1.802c1.384.479 2.396 1.195 2.198 2.525z"></path>
    </svg>
);

export const Ethereum = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 8 8"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <defs>
            <linearGradient id="crypto-gradient-eth" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A80077" />
                <stop offset="100%" stopColor="#66FF00" />
            </linearGradient>
        </defs>
        <path fill="url(#crypto-gradient-eth)" d="M1 4.5L4 6l3-1.5L4 8M1 4l3-4l3 4l-3 1.5"></path>
    </svg>
);

export const Solana = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        className={`crypto-icon ${className}`}
        style={style}
        {...props}
    >
        <defs>
            <linearGradient id="crypto-gradient-sol" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A80077" />
                <stop offset="100%" stopColor="#66FF00" />
            </linearGradient>
        </defs>
        <path fill="url(#crypto-gradient-sol)" fillRule="evenodd" d="M2.45 6.76h9.59c.12 0 .23.05.32.14l1.52 1.56c.28.29.08.78-.32.78H3.97c-.12 0-.23-.05-.32-.14L2.13 7.54c-.28-.29-.08-.78.32-.78Zm-.32-2.07l1.52-1.56c.08-.09.2-.14.32-.14h9.58c.4 0 .6.49.32.78l-1.51 1.56c-.08.09-.2.14-.32.14H2.45c-.4 0-.6-.49-.32-.78Zm11.74 6.61l-1.52 1.56c-.09.09-.2.14-.32.14H2.45c-.4 0-.6-.49-.32-.78l1.52-1.56c.08-.09.2-.14.32-.14h9.58c.4 0 .6.49.32.78Z"></path>
    </svg>
);

export const BnbFill = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
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
            <linearGradient id="crypto-gradient-bnb" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A80077" />
                <stop offset="100%" stopColor="#66FF00" />
            </linearGradient>
        </defs>
        <path fill="url(#crypto-gradient-bnb)" d="M6.167 4.367L12 1l5.833 3.367l-2.144 1.244L12 3.488L8.312 5.61zm11.666 4.246l-2.144-1.244L12 9.492L8.312 7.37L6.167 8.613V11.1l3.689 2.123v4.246L12 18.714l2.145-1.244v-4.246l3.688-2.123zm0 6.734v-2.488l-2.144 1.244v2.487zm1.523.879l-3.689 2.123v2.487L21.5 17.47v-6.734l-2.145 1.244zM17.21 6.49l2.145 1.244v2.487L21.5 8.977V6.49l-2.145-1.244zM9.856 19.25v2.487L12 22.981l2.145-1.244v-2.488L12 20.493zm-3.689-3.903l2.145 1.243v-2.487l-2.145-1.244zM9.856 6.49L12 7.734l2.145-1.244L12 5.246zM4.644 7.734L6.79 6.49L4.644 5.246L2.5 6.49v2.487l2.144 1.244zm0 4.246L2.5 10.736v6.733l5.833 3.367V18.35l-3.689-2.123z"></path>
    </svg>
);

export const TetherUsdtFill = ({ size = 24, className = '', style, ...props }: IconProps & React.SVGProps<SVGSVGElement>) => (
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
            <linearGradient id="crypto-gradient-usdt" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A80077" />
                <stop offset="100%" stopColor="#66FF00" />
            </linearGradient>
        </defs>
        <g fill="none">
            <path d="M24 0v24H0V0h24ZM12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035c-.01-.004-.019-.001-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427c-.002-.01-.009-.017-.017-.018Zm.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093c.012.004.023 0 .029-.008l.004-.014l-.034-.614c-.003-.012-.01-.02-.02-.022Zm-.715.002a.023.023 0 0 0-.027.006l-.006.014l-.034.614c0 .012.007.02.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01l-.184-.092Z"></path>
            <path fill="url(#crypto-gradient-usdt)" d="M17.42 3a2 2 0 0 1 1.736 1.008L22.49 9.84a2 2 0 0 1-.322 2.406l-9.283 9.283a1.25 1.25 0 0 1-1.768 0l-9.283-9.283a2 2 0 0 1-.322-2.406l3.333-5.833A2 2 0 0 1 6.58 3h10.84ZM15 6H9a1 1 0 0 0-.117 1.993L9 8h2v1.545c-.758.07-1.447.217-2.004.426c-.395.148-.749.336-1.013.571c-.264.234-.483.557-.483.958c0 .401.219.724.483.958c.264.235.618.423 1.013.57c.594.223 1.338.377 2.157.44a.994.994 0 0 0-.146.416L11 14v2a1 1 0 0 0 1.993.117L13 16v-2a.995.995 0 0 0-.153-.532c.819-.063 1.563-.216 2.157-.44c.395-.147.749-.335 1.013-.57c.264-.234.483-.557.483-.958c0-.401-.219-.724-.483-.958c-.264-.235-.618-.423-1.013-.57a7.494 7.494 0 0 0-1.683-.392L13 9.545V8h2a1 1 0 0 0 .117-1.993L15 6Zm-2.001 4.55a6.789 6.789 0 0 1 1.654.357c.329.124.56.259.7.383a.46.46 0 0 1 .14.178l.007.032l-.007.032a.46.46 0 0 1-.14.178c-.14.124-.371.26-.7.382c-.655.246-1.593.408-2.653.408s-1.998-.162-2.653-.408c-.329-.123-.56-.258-.701-.382a.46.46 0 0 1-.14-.178L8.5 11.5c0-.013.005-.085.146-.21c.14-.124.372-.26.701-.382c.44-.165 1.007-.293 1.654-.358a1 1 0 0 0 1.998 0Z"></path>
        </g>
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
        <defs>
            <linearGradient id="crypto-gradient-usdc" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A80077" />
                <stop offset="100%" stopColor="#66FF00" />
            </linearGradient>
        </defs>
        <path fill="url(#crypto-gradient-usdc)" d="M16 0c8.837 0 16 7.163 16 16s-7.163 16-16 16S0 24.837 0 16S7.163 0 16 0zm3.352 5.56c-.244-.12-.488 0-.548.243c-.061.061-.061.122-.061.243v.85l.01.104a.86.86 0 0 0 .355.503c4.754 1.7 7.192 6.98 5.424 11.653c-.914 2.55-2.925 4.491-5.424 5.402c-.244.121-.365.303-.365.607v.85l.005.088a.45.45 0 0 0 .36.397c.061 0 .183 0 .244-.06a10.895 10.895 0 0 0 7.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162zm-6.46-.06c-.061 0-.183 0-.244.06a10.895 10.895 0 0 0-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102c.244.121.488 0 .548-.243c.061-.06.061-.122.061-.243v-.85l-.01-.08c-.042-.169-.199-.362-.355-.466c-4.754-1.7-7.192-6.98-5.424-11.653c.914-2.55 2.925-4.491 5.424-5.402c.244-.121.365-.303.365-.607v-.85l-.005-.088a.45.45 0 0 0-.36-.397zm3.535 3.156h-.915l-.088.008c-.2.04-.346.212-.4.478v1.396l-.207.032c-1.708.304-2.778 1.483-2.778 2.942c0 2.002 1.218 2.791 3.778 3.095c1.707.303 2.255.668 2.255 1.639c0 .97-.853 1.638-2.011 1.638c-1.585 0-2.133-.667-2.316-1.578c-.06-.242-.244-.364-.427-.364h-1.036l-.079.007a.413.413 0 0 0-.347.418v.06l.033.18c.29 1.424 1.266 2.443 3.197 2.734v1.457l.008.088c.04.198.213.344.48.397h.914l.088-.008c.2-.04.346-.212.4-.477V21.34l.207-.04c1.713-.362 2.84-1.601 2.84-3.177c0-2.124-1.28-2.852-3.84-3.156c-1.829-.243-2.194-.728-2.194-1.578c0-.85.61-1.396 1.828-1.396c1.097 0 1.707.364 2.011 1.275a.458.458 0 0 0 .427.303h.975l.079-.006a.413.413 0 0 0 .348-.419v-.06l-.037-.173a3.04 3.04 0 0 0-2.706-2.316V9.142l-.008-.088c-.04-.199-.213-.345-.48-.398z"></path>
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

