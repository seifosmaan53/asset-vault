import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/system';

interface LogoProps {
  size?: number;
  sx?: SxProps<Theme>;
  showText?: boolean;
}

const Logo = ({ size = 48, sx, showText = false }: LogoProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        ...sx,
      }}
    >
      {/* SVG Logo */}
      <Box
        component="svg"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        sx={{
          flexShrink: 0,
        }}
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1976d2" />
            <stop offset="100%" stopColor="#42a5f5" />
          </linearGradient>
        </defs>
        
        {/* Outer circle */}
        <circle cx="32" cy="32" r="30" fill="url(#logoGradient)" />
        
        {/* Invoice document shape */}
        <rect x="18" y="14" width="28" height="36" rx="2" fill="white" opacity="0.95" />
        
        {/* Lines on document (representing invoice lines) */}
        <line x1="22" y1="20" x2="42" y2="20" stroke="#1976d2" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="26" x2="38" y2="26" stroke="#1976d2" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="32" x2="40" y2="32" stroke="#1976d2" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="38" x2="36" y2="38" stroke="#1976d2" strokeWidth="1.5" strokeLinecap="round" />
        
        {/* Checkmark/check icon */}
        <circle cx="44" cy="44" r="8" fill="#4caf50" />
        <path
          d="M41 44 L43 46 L47 42"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Small inventory box icon */}
        <rect x="12" y="40" width="8" height="8" rx="1" fill="#ff9800" opacity="0.9" />
        <line x1="14" y1="42" x2="18" y2="42" stroke="white" strokeWidth="0.8" />
        <line x1="14" y1="45" x2="18" y2="45" stroke="white" strokeWidth="0.8" />
      </Box>
      
      {/* Optional text */}
      {showText && (
        <Box
          component="span"
          sx={{
            fontSize: size * 0.6,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          InvoiceMe
        </Box>
      )}
    </Box>
  );
};

export default Logo;

