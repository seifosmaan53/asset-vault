# InvoiceMe Test Checklist

This document provides a comprehensive manual testing checklist for all features of the InvoiceMe application.

## Authentication

### Register
- [ ] Register new user with valid email and password
- [ ] Register with existing email (should fail)
- [ ] Register with invalid email format (should show validation error)
- [ ] Register with weak password (should show validation error)
- [ ] Register with company name (optional field)

### Login
- [ ] Login with valid credentials
- [ ] Login with invalid email (should show error)
- [ ] Login with invalid password (should show error)
- [ ] Login redirects to dashboard on success
- [ ] Login page redirects to dashboard if already authenticated

### Logout
- [ ] Logout button clears tokens and redirects to login
- [ ] Cannot access protected routes after logout

### Refresh Token
- [ ] Access token refresh works automatically on 401
- [ ] Refresh token expiration redirects to login
- [ ] Manual refresh endpoint works

### Password Reset
- [ ] Request password reset with valid email
- [ ] Request password reset with invalid email (should not reveal if email exists)
- [ ] Confirm password reset with valid token
- [ ] Confirm password reset with invalid/expired token (should fail)

## Clients Management

### Create Client
- [ ] Create client with required fields (name)
- [ ] Create client with all optional fields (email, phone, address, notes)
- [ ] Create client with invalid email format (should show validation error)
- [ ] Create client with partial address information

### Edit Client
- [ ] Edit existing client and update fields
- [ ] Edit client and change email
- [ ] Edit client and update address
- [ ] Save changes persists correctly

### Delete Client
- [ ] Delete client with confirmation dialog
- [ ] Cancel delete operation
- [ ] Verify client is removed from list after deletion

### Search Clients
- [ ] Search by client name
- [ ] Search by email
- [ ] Search with no results shows appropriate message
- [ ] Clear search resets list

### View Clients in Invoice Filters
- [ ] Client dropdown in invoice form shows all clients
- [ ] Client search in invoice form works
- [ ] Selected client information appears in invoice

## Inventory Management

### Create Inventory Item
- [ ] Create item with required fields (SKU, name, unit, price)
- [ ] Create item with all optional fields (description, category, barcode, cost price, tax rate)
- [ ] Create item with duplicate SKU (should fail)
- [ ] Create item with negative stock (should fail validation)
- [ ] Create item with reorder level set

### Edit Inventory Item
- [ ] Edit existing item and update fields
- [ ] Edit item and change price
- [ ] Edit item and update stock levels
- [ ] Save changes persists correctly

### Stock Adjustment
- [ ] Adjust stock with purchase type (increases stock)
- [ ] Adjust stock with sale type (decreases stock)
- [ ] Adjust stock with adjustment type (sets to specific value)
- [ ] Large stock adjustment (>50% change) shows confirmation
- [ ] Stock adjustment creates movement record
- [ ] Stock adjustment updates current stock correctly

### Low Stock Behavior
- [ ] Items below reorder level show low stock badge
- [ ] Low stock widget on dashboard shows correct items
- [ ] Low stock filter works on inventory list
- [ ] Low stock items highlighted appropriately

### View Linked Invoices
- [ ] Inventory detail page shows invoices using the item
- [ ] Clicking linked invoice navigates to invoice detail
- [ ] Linked invoices show correct information (number, client, date, total)

### Stock Movement History
- [ ] Stock movements table shows all movements
- [ ] Movements show correct type, quantity, source, and note
- [ ] Movements are sorted by date (newest first)
- [ ] Invoice-linked movements show invoice number

## Invoices

### Invoice Status Flows
- [ ] Create draft invoice
- [ ] Change draft to sent status
- [ ] Mark sent invoice as paid
- [ ] Change invoice to cancelled status
- [ ] Cannot change paid invoice back to draft
- [ ] Status changes update timeline correctly

### Edit Sent Invoice
- [ ] Edit sent invoice and change quantities
- [ ] Verify stock updates when quantities change
- [ ] Edit sent invoice and add new items
- [ ] Edit sent invoice and remove items
- [ ] Stock movements reflect invoice changes

### Estimate to Invoice Conversion
- [ ] Convert estimate to invoice
- [ ] Converted invoice gets new invoice number
- [ ] Converted invoice status changes to draft
- [ ] Cannot convert non-estimate invoice (should fail)

### Invoice Creation with Inventory
- [ ] Select inventory item from dropdown
- [ ] Inventory selection auto-fills description, price, tax
- [ ] Stock availability displayed correctly
- [ ] Quantity exceeds available stock shows warning
- [ ] Creating invoice deducts stock automatically
- [ ] Stock movement created for invoice

### Invoice Totals
- [ ] Subtotal calculated correctly
- [ ] Tax calculated on line items
- [ ] Discount applied correctly
- [ ] Total calculated correctly
- [ ] Totals update live when editing items

### PDF Generation
- [ ] Generate PDF for invoice
- [ ] PDF downloads with correct filename
- [ ] PDF contains all invoice information
- [ ] PDF layout is print-friendly

### Email Sending
- [ ] Send invoice email (if client has email)
- [ ] Email send shows success message
- [ ] Cannot send email if client has no email (should show error)
- [ ] Email endpoint returns appropriate response

### Invoice Preview
- [ ] Preview page shows invoice correctly
- [ ] Print layout works
- [ ] All invoice details visible in preview

## Recurring Invoices

### Create Recurring Invoice
- [ ] Create recurring invoice with all fields
- [ ] Set frequency (daily, weekly, monthly, quarterly, yearly)
- [ ] Set interval and start date
- [ ] Add line items to recurring invoice
- [ ] Set active/inactive status

### Edit Recurring Invoice
- [ ] Edit existing recurring invoice
- [ ] Change frequency and interval
- [ ] Update line items
- [ ] Save changes persists correctly

### Disable Recurring Invoice
- [ ] Set recurring invoice to inactive
- [ ] Inactive recurring invoices don't generate new invoices
- [ ] Can reactivate recurring invoice

### Manual Generation
- [ ] Manually generate invoice from recurring template
- [ ] Generated invoice has correct client and items
- [ ] Generated invoice has correct dates

## PDF & Email

### PDF Generation
- [ ] Generate PDF from invoice detail page
- [ ] PDF downloads successfully
- [ ] PDF contains all invoice data
- [ ] PDF layout is correct for printing

### Email Sending
- [ ] Send email from invoice detail page
- [ ] Email send requires client email
- [ ] Success message shown after sending
- [ ] Error handling for failed sends

### Print Layout
- [ ] Invoice preview page prints correctly
- [ ] Print layout hides navigation
- [ ] All invoice details visible when printing

## Settings, Templates & API Keys

### Settings
- [ ] Update profile information
- [ ] Update company information
- [ ] Update invoice settings (currency, tax defaults)
- [ ] Settings persist after page reload

### Invoice Templates
- [ ] View list of templates
- [ ] Create new template
- [ ] Edit existing template
- [ ] Delete template with confirmation

### API Keys
- [ ] Create new API key
- [ ] API key displayed once after creation
- [ ] Copy API key to clipboard
- [ ] Delete API key with confirmation
- [ ] List shows all API keys

## Edge Cases

### Quantity > Available Stock
- [ ] Warning displayed when quantity exceeds available stock
- [ ] Warning shows available stock amount
- [ ] Can still submit with warning (user decision)

### Zero/Negative Stock After Edits
- [ ] Editing invoice that would cause negative stock shows warning
- [ ] System prevents negative stock (sets to 0)
- [ ] Stock movements reflect corrections

### Delete Inventory Item Used in Invoices
- [ ] Attempting to delete item used in invoices shows warning
- [ ] Option to prevent deletion or allow with warning
- [ ] Deleted item still shows in historical invoices

### Network Failure
- [ ] Killing backend shows error messages, not blank screens
- [ ] Error messages are user-friendly
- [ ] Retry options available where appropriate
- [ ] Offline state handled gracefully

## Integration Tests

### Inventory-Invoice Integration Flow
1. Create inventory item with stock
2. Create invoice with that item
3. Verify stock decreased
4. Verify stock movement created
5. Edit invoice and change quantity
6. Verify stock updated correctly
7. View inventory detail and see linked invoice
8. Delete invoice and verify stock restored (if applicable)

### Complete Business Flow
1. Register/Login
2. Add company settings
3. Add inventory items
4. Add clients
5. Create invoice with inventory items
6. Send invoice via email
7. Mark invoice as paid
8. View dashboard statistics
9. Generate reports

