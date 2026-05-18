// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  CheckCircle as MarkPaidIcon,
  Email as EmailIcon,
  FileCopy as DuplicateIcon,
  PictureAsPdf as PdfIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { QuickActionsMenu, type QuickAction } from '../common/QuickActionsMenu';
import type { Invoice } from '../../types/invoice';

interface InvoiceQuickActionsProps {
  invoice: Invoice;
  onMarkAsPaid?: () => void;
  onSendEmail?: () => void;
  onDuplicate?: () => void;
  onDownloadPdf?: () => void;
  onSend?: () => void;
  disabled?: boolean;
}

export const InvoiceQuickActions = ({
  invoice,
  onMarkAsPaid,
  onSendEmail,
  onDuplicate,
  onDownloadPdf,
  onSend,
  disabled = false,
}: InvoiceQuickActionsProps) => {
  const actions: QuickAction[] = [];

  if (onMarkAsPaid && invoice.status !== 'paid') {
    actions.push({
      id: 'mark-paid',
      label: 'Mark as Paid',
      icon: <MarkPaidIcon fontSize="small" />,
      onClick: onMarkAsPaid,
      color: 'success',
    });
  }

  if (onSend && invoice.status === 'draft') {
    actions.push({
      id: 'send',
      label: 'Send Invoice',
      icon: <SendIcon fontSize="small" />,
      onClick: onSend,
      color: 'primary',
    });
  }

  if (onSendEmail) {
    actions.push({
      id: 'send-email',
      label: 'Send Email',
      icon: <EmailIcon fontSize="small" />,
      onClick: onSendEmail,
    });
  }

  if (onDuplicate) {
    actions.push({
      id: 'duplicate',
      label: 'Duplicate',
      icon: <DuplicateIcon fontSize="small" />,
      onClick: onDuplicate,
      divider: true,
    });
  }

  if (onDownloadPdf) {
    actions.push({
      id: 'download-pdf',
      label: 'Download PDF',
      icon: <PdfIcon fontSize="small" />,
      onClick: onDownloadPdf,
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return <QuickActionsMenu actions={actions} ariaLabel={`Quick actions for invoice ${invoice.number}`} />;
};
