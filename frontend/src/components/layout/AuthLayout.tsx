import { Container, Box, Typography } from '@mui/material';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: '100%', mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            InvoiceMe
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Invoice and Inventory Management
          </Typography>
        </Box>
        {children}
      </Box>
    </Container>
  );
};

export default AuthLayout;

