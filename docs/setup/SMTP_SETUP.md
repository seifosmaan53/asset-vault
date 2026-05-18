# SMTP Email Configuration Guide

## Quick Setup

To enable email sending for invoices, you need to configure SMTP settings in your backend `.env` file.

### Required Environment Variables

Add these to your `backend/.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="InvoiceMe <your-email@gmail.com>"
```

## Popular SMTP Providers

### Gmail

1. Enable 2-Step Verification on your Google account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Create a new app password for "Mail"
   - Use this password (not your regular Gmail password)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM="InvoiceMe <your-email@gmail.com>"
```

### Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM="InvoiceMe <your-email@outlook.com>"
```

### SendGrid

1. Sign up at https://sendgrid.com
2. Create an API key
3. Use SMTP settings:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM="InvoiceMe <noreply@yourdomain.com>"
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM="InvoiceMe <noreply@yourdomain.com>"
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM="InvoiceMe <noreply@yourdomain.com>"
```

## Testing Your Configuration

After adding SMTP settings:

1. Restart your backend server
2. Check backend logs for: `SMTP transporter configured successfully`
3. Try sending an invoice email
4. If you see errors, check the backend console for specific error messages

## Troubleshooting

### Error: "SMTP is not configured"
- Make sure all SMTP variables are set in `backend/.env`
- Restart the backend server after adding variables

### Error: "SMTP authentication failed"
- Check your SMTP_USER and SMTP_PASS are correct
- For Gmail, make sure you're using an App Password, not your regular password
- Verify 2-Step Verification is enabled (for Gmail)

### Error: "Cannot connect to SMTP server"
- Check SMTP_HOST and SMTP_PORT are correct
- Verify your firewall/network allows outbound connections on port 587 or 465
- Try port 465 with `secure: true` if 587 doesn't work

### Error: "Invalid login"
- Double-check your credentials
- Some providers require specific username formats (e.g., full email vs username)

## Security Notes

- Never commit your `.env` file to version control
- Use App Passwords for Gmail instead of your main password
- For production, consider using a dedicated email service (SendGrid, Mailgun, AWS SES)
- Keep your SMTP credentials secure

