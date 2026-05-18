import { IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { TIMEOUTS } from '../../constants/timeouts';

interface CopyToClipboardProps {
  text: string;
  tooltip?: string;
  successMessage?: string;
  size?: 'small' | 'medium' | 'large';
}

const CopyToClipboard = ({
  text,
  tooltip = 'Copy to clipboard',
  successMessage = 'Copied to clipboard!',
  size = 'small',
}: CopyToClipboardProps) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  // Fix Memory Leak: Store timeout ref for cleanup
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fix Memory Leak: Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast(successMessage, 'success');
      
      // Fix Memory Leak: Clear any existing timeout before setting new one
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, TIMEOUTS.COPY_FEEDBACK_DURATION);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        showToast(successMessage, 'success');
        
        // Fix Memory Leak: Clear any existing timeout before setting new one
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopied(false);
          copyTimeoutRef.current = null;
        }, TIMEOUTS.COPY_FEEDBACK_DURATION);
      } catch (err) {
        showToast('Failed to copy to clipboard', 'error');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <Tooltip title={copied ? 'Copied!' : tooltip} arrow>
      <IconButton
        onClick={handleCopy}
        size={size}
        color={copied ? 'success' : 'default'}
        sx={{
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        }}
      >
        {copied ? <CheckIcon fontSize={size} /> : <ContentCopyIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  );
};

export default CopyToClipboard;

