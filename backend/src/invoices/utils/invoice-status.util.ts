// Copyright (c) 2025 Asset Vault. All rights reserved.

import { BadRequestException } from '@nestjs/common';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

/**
 * Valid status transitions for invoices
 * This defines a finite state machine for invoice status workflow
 */
const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'paid', 'cancelled'], // Allow direct to paid for immediate payments (cash, etc.)
  sent: ['paid', 'overdue', 'cancelled', 'draft'], // Allow back to draft for editing
  paid: ['cancelled'], // Paid invoices can only be cancelled (refund scenario)
  overdue: ['paid', 'cancelled', 'sent'],
  cancelled: [], // Terminal state (no transitions allowed)
};

/**
 * Validate if a status transition is allowed
 * 
 * @param fromStatus - Current status
 * @param toStatus - Desired new status
 * @returns true if transition is valid, throws BadRequestException if invalid
 */
export function validateStatusTransition(
  fromStatus: InvoiceStatus,
  toStatus: InvoiceStatus,
): boolean {
  // Same status is always valid (no-op)
  if (fromStatus === toStatus) {
    return true;
  }

  // Check if transition is in the allowed list
  const allowedTransitions = VALID_TRANSITIONS[fromStatus];
  if (!allowedTransitions || !allowedTransitions.includes(toStatus)) {
    throw new BadRequestException(
      `Invalid status transition: Cannot change invoice status from "${fromStatus}" to "${toStatus}". ` +
      `Valid transitions from "${fromStatus}": ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (terminal state)'}`
    );
  }

  return true;
}

/**
 * Business rule validation for status changes
 * 
 * @param toStatus - Desired new status
 * @param invoiceTotal - Total amount of the invoice
 * @param itemCount - Number of items in the invoice
 * @param clientEmail - Client email address (optional)
 * @throws BadRequestException if business rules are violated
 */
export function validateStatusBusinessRules(
  toStatus: InvoiceStatus,
  invoiceTotal: number,
  itemCount: number,
  clientEmail?: string | null,
): void {
  // Can't mark as Paid if total is 0 or no items
  if (toStatus === 'paid') {
    if (invoiceTotal <= 0) {
      throw new BadRequestException(
        'Cannot mark invoice as paid: Invoice total must be greater than 0'
      );
    }
    if (itemCount === 0) {
      throw new BadRequestException(
        'Cannot mark invoice as paid: Invoice must have at least one item'
      );
    }
  }

  // Can't mark as Sent if client email is missing
  if (toStatus === 'sent') {
    if (!clientEmail || clientEmail.trim() === '') {
      throw new BadRequestException(
        'Cannot mark invoice as sent: Client email address is required'
      );
    }
  }
}

/**
 * Check if a status change affects stock
 * Stock should only be affected at specific transitions, not in Draft state
 * 
 * @param fromStatus - Current status
 * @param toStatus - Desired new status
 * @returns true if this transition should affect stock
 */
export function shouldAffectStock(
  fromStatus: InvoiceStatus,
  toStatus: InvoiceStatus,
): boolean {
  // Stock is affected when moving to 'sent' or 'paid' from 'draft'
  if (fromStatus === 'draft' && (toStatus === 'sent' || toStatus === 'paid')) {
    return true;
  }

  // Stock is affected when moving to 'paid' from 'sent' or 'overdue'
  if ((fromStatus === 'sent' || fromStatus === 'overdue') && toStatus === 'paid') {
    return true;
  }

  // Stock is returned when moving to 'cancelled' from any active status
  if (toStatus === 'cancelled' && fromStatus !== 'cancelled' && fromStatus !== 'draft') {
    return true; // Return stock
  }

  // Stock is returned when moving from 'cancelled' back to active status
  if (fromStatus === 'cancelled' && (toStatus === 'draft' || toStatus === 'sent' || toStatus === 'paid')) {
    return true; // Deduct stock again
  }

  return false;
}

/**
 * Get all valid transitions from a given status
 * 
 * @param fromStatus - Current status
 * @returns Array of valid target statuses
 */
export function getValidTransitions(fromStatus: InvoiceStatus): InvoiceStatus[] {
  return VALID_TRANSITIONS[fromStatus] || [];
}

/**
 * Check if a status is terminal (no transitions allowed)
 * 
 * @param status - Status to check
 * @returns true if status is terminal
 */
export function isTerminalStatus(status: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

