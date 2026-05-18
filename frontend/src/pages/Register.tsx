// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SignUp } from '@clerk/clerk-react';
import { Box } from '@mui/material';
import { useEffect } from 'react';
import { TIMEOUTS } from '../constants/timeouts';

const Register = () => {
  useEffect(() => {
    // Hide "Development mode" text that Clerk shows
    const hideDevMode = () => {
      const devModeElements = document.querySelectorAll('[class*="devMode"], [class*="development"], [data-testid*="dev"]');
      devModeElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.textContent?.toLowerCase().includes('development mode') || 
            htmlEl.textContent?.toLowerCase().includes('dev mode') ||
            htmlEl.textContent?.toLowerCase().includes('secured by')) {
          htmlEl.style.display = 'none';
        }
      });
      
      // Hide footer elements
      const footers = document.querySelectorAll('footer, [class*="footer"], [class*="cl-footer"]');
      footers.forEach((footer) => {
        const htmlFooter = footer as HTMLElement;
        if (htmlFooter.textContent?.toLowerCase().includes('development mode') ||
            htmlFooter.textContent?.toLowerCase().includes('secured by')) {
          htmlFooter.style.display = 'none';
        }
      });

      // Hide any "Secured by" text
      const securedBy = document.querySelectorAll('*');
      securedBy.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.textContent?.trim() === 'Secured by' || 
            htmlEl.textContent?.includes('Secured by Clerk')) {
          htmlEl.style.display = 'none';
        }
      });
    };

    // Run immediately and periodically to catch dynamically added elements
    hideDevMode();
    const interval = setInterval(hideDevMode, TIMEOUTS.DEV_MODE_HIDE_INTERVAL);
    const timeoutId = setTimeout(() => clearInterval(interval), TIMEOUTS.DEV_MODE_HIDE_DURATION);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <SignUp
        routing="path"
        path="/register"
        signInUrl="/login"
        afterSignUpUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          baseTheme: undefined,
          variables: {
            colorPrimary: '#1976d2',
            colorText: '#212121',
            colorTextSecondary: '#757575',
            colorBackground: '#ffffff',
            colorInputBackground: '#ffffff',
            colorInputText: '#212121',
            borderRadius: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          },
          elements: {
            rootBox: {
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'center',
            },
              card: {
                width: '100%',
                maxWidth: '100%',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                padding: '32px',
              },
              header: {
                textAlign: 'center',
                marginBottom: '24px',
              },
              headerTitle: {
                fontSize: '24px',
                fontWeight: '600',
                color: '#212121',
                marginBottom: '8px',
                lineHeight: '1.4',
              },
              headerSubtitle: {
                fontSize: '15px',
                color: '#757575',
                fontWeight: '400',
                lineHeight: '1.5',
              },
              socialButtonsBlockButton: {
                fontSize: '15px',
                fontWeight: '500',
                padding: '12px 20px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                },
              },
              formFieldLabel: {
                fontSize: '14px',
                fontWeight: '500',
                color: '#212121',
                marginBottom: '8px',
              },
              formFieldInput: {
                fontSize: '15px',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                backgroundColor: '#ffffff',
                '&:focus': {
                  borderColor: '#1976d2',
                  boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)',
                },
              },
              formButtonPrimary: {
                fontSize: '15px',
                fontWeight: '500',
                padding: '14px 24px',
                borderRadius: '8px',
                backgroundColor: '#1976d2',
                color: '#ffffff',
                textTransform: 'none',
                boxShadow: '0 2px 4px rgba(25, 118, 210, 0.2)',
                '&:hover': {
                  backgroundColor: '#1565c0',
                  boxShadow: '0 4px 8px rgba(25, 118, 210, 0.3)',
                },
              },
              formFieldAction: {
                fontSize: '14px',
                color: '#1976d2',
                fontWeight: '500',
                '&:hover': {
                  color: '#1565c0',
                },
              },
              footer: {
                display: 'none',
              },
              footerActionLink: {
                display: 'none',
              },
              identityPreviewEditButton: {
                fontSize: '14px',
              },
              formResendCodeLink: {
                fontSize: '14px',
                color: '#1976d2',
              },
              dividerLine: {
                backgroundColor: '#e0e0e0',
              },
              dividerText: {
                fontSize: '14px',
                color: '#757575',
              },
              formFieldInputShowPasswordButton: {
                color: '#757575',
                '&:hover': {
                  color: '#212121',
                },
              },
            },
          }}
        />
    </Box>
  );
};

export default Register;
