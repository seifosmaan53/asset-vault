// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SignIn } from '@clerk/clerk-react';
import { Box, Typography, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useEffect } from 'react';
import { TIMEOUTS } from '../constants/timeouts';

const Login = () => {
  useEffect(() => {
    // Make "Try another way" button more visible when passkey is shown
    const enhancePasswordAccess = () => {
      // Check if passkey screen is visible
      const passkeyText = document.body.textContent?.toLowerCase() || '';
      const isPasskeyScreen = 
        passkeyText.includes('use your passkey') ||
        passkeyText.includes('complete sign-in using your passkey') ||
        passkeyText.includes('verifying it\'s you') ||
        passkeyText.includes('fingerprint') ||
        passkeyText.includes('face') ||
        passkeyText.includes('screen lock') ||
        passkeyText.includes('passkey');

      if (isPasskeyScreen) {
        // Find all clickable elements that might be "Try another way"
        const allElements = document.querySelectorAll('button, a, [role="button"], span, div, p');
        let foundTryAnotherWay = false;
        
        allElements.forEach((el) => {
          const text = el.textContent?.toLowerCase() || '';
          if (
            text.includes('try another way') ||
            text.includes('use password') ||
            text.includes('other method')
          ) {
            foundTryAnotherWay = true;
            const htmlEl = el as HTMLElement;
            // Make it VERY visible and prominent
            htmlEl.style.cssText += `
              color: #1976d2 !important;
              font-weight: 700 !important;
              text-decoration: underline !important;
              font-size: 16px !important;
              padding: 14px 20px !important;
              cursor: pointer !important;
              display: block !important;
              width: 100% !important;
              text-align: center !important;
              margin-top: 20px !important;
              margin-bottom: 10px !important;
              background-color: #e3f2fd !important;
              border: 2px solid #1976d2 !important;
              border-radius: 8px !important;
              box-shadow: 0 2px 4px rgba(25, 118, 210, 0.2) !important;
            `;
            
            // Ensure it's clickable
            if (htmlEl.tagName === 'BUTTON' || htmlEl.getAttribute('role') === 'button' || htmlEl.onclick) {
              // Already clickable
            } else {
              // Make it clickable if it's not already
              htmlEl.style.cursor = 'pointer';
              htmlEl.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Try to find and click the actual button
                const button = htmlEl.closest('button') || 
                              htmlEl.querySelector('button') ||
                              document.querySelector('button[type="button"]');
                if (button) {
                  (button as HTMLElement).click();
                }
              };
            }
          }
        });

        // If we didn't find "Try another way" but we're on passkey screen, 
        // look for any alternative method buttons
        if (!foundTryAnotherWay) {
          // Look for buttons that might lead to password
          const buttons = document.querySelectorAll('button, [role="button"]');
          buttons.forEach((btn) => {
            const btnText = btn.textContent?.toLowerCase() || '';
            // Skip the main passkey continue button
            if (!btnText.includes('continue') && !btnText.includes('passkey')) {
              const htmlBtn = btn as HTMLElement;
              // Make alternative buttons more visible
              htmlBtn.style.cssText += `
                color: #1976d2 !important;
                font-weight: 600 !important;
                margin-top: 12px !important;
              `;
            }
          });
        }
      }
    };

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
    enhancePasswordAccess();
    
    const interval = setInterval(() => {
      hideDevMode();
      enhancePasswordAccess();
    }, TIMEOUTS.DEV_MODE_HIDE_INTERVAL);
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
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Box sx={{ width: '100%' }}>
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/register"
          afterSignInUrl="/dashboard"
          forceRedirectUrl="/dashboard"
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
              // Keep the signup link visible - it's in the footer but we want it
              footerActionLink: {
                display: 'block',
                color: '#1976d2',
                fontSize: '14px',
                fontWeight: '500',
                '&:hover': {
                  color: '#1565c0',
                },
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
              // Make "Try another way" link more visible and prominent
              formButtonAlternativeMethods: {
                fontSize: '15px',
                color: '#1976d2',
                fontWeight: '600',
                textDecoration: 'underline',
                padding: '12px 16px',
                marginTop: '16px',
                display: 'block',
                width: '100%',
                textAlign: 'center',
                '&:hover': {
                  color: '#1565c0',
                  textDecoration: 'underline',
                  backgroundColor: '#f5f5f5',
                },
              },
              // Style alternative methods container
              alternativeMethodsBlock: {
                marginTop: '20px',
                paddingTop: '20px',
                borderTop: '1px solid #e0e0e0',
              },
            },
          }}
        />
      </Box>
      <Box sx={{ mt: 3, textAlign: 'center', width: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          Don't have an account?{' '}
          <Link
            component={RouterLink}
            to="/register"
            sx={{
              color: '#1976d2',
              fontWeight: 500,
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
                color: '#1565c0',
              },
            }}
          >
            Sign up
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
