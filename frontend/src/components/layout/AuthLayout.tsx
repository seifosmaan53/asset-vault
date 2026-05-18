import { Container, Box, Typography } from '@mui/material';
import Logo from '../common/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Box 
        sx={{ 
          width: '100%', 
          maxWidth: '600px',
          mb: 4, 
          textAlign: 'center' 
        }}
      >
        {/* Logo and Title Section - Side by Side */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            mb: 1,
          }}
        >
          {/* Custom Logo on the left */}
          <Logo size={56} />
          
          {/* Title on the right */}
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              InvoiceMe
            </Typography>
          </Box>
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          Invoice and Inventory Management
        </Typography>
      </Box>
      <Box
        sx={{
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AuthLayout;

