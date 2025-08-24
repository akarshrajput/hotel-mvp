# OTP Authentication Implementation Guide

## Overview

This document describes the OTP (One-Time Password) authentication system implemented in the GuestFlow hotel management application. The system provides secure two-factor authentication for user registration, login, and password reset functionality.

## Features

### 🔐 **Security Features**
- **6-digit OTP codes** with 10-minute expiration
- **Rate limiting** with maximum 5 attempts per OTP
- **Automatic cleanup** of expired OTPs
- **Email-based delivery** with professional templates
- **JWT token integration** for secure sessions

### 📧 **Email Integration**
- **Professional HTML templates** for different OTP types
- **Gmail support** for development
- **SMTP support** for production
- **Fallback handling** for email failures

### 🔄 **User Flows**

#### 1. **Registration Flow**
```
User Input → Send OTP → Email Verification → Account Creation → Login
```

#### 2. **Login Flow**
```
Credentials → Send OTP → Email Verification → Dashboard Access
```

#### 3. **Password Reset Flow**
```
Email Input → Send OTP → Email Verification → New Password → Login
```

## Backend Implementation

### 📁 **New Files Created**

#### Models
- `backend/models/OTP.js` - OTP data model with MongoDB schema

#### Services
- `backend/utils/emailService.js` - Email sending functionality
- `backend/services/otpCleanupService.js` - Automatic OTP cleanup

#### Controllers
- Updated `backend/controllers/authController.js` with OTP endpoints

#### Routes
- Updated `backend/routes/authRoutes.js` with new OTP routes

### 🔧 **New API Endpoints**

#### Registration
```http
POST /api/auth/register
POST /api/auth/verify-registration
```

#### Login
```http
POST /api/auth/login
POST /api/auth/verify-login
```

#### Password Reset
```http
POST /api/auth/forgot-password
POST /api/auth/verify-password-reset
POST /api/auth/reset-password
```

### 📊 **Database Schema**

#### OTP Model
```javascript
{
  email: String,           // User's email
  otp: String,            // 6-digit code
  type: String,           // 'login', 'registration', 'password_reset'
  isUsed: Boolean,        // Whether OTP has been used
  expiresAt: Date,        // Expiration timestamp
  attempts: Number,       // Number of verification attempts
  registrationData: Object // Temporary storage for registration data
}
```

## Frontend Implementation

### 📁 **New Files Created**

#### Components
- `frontend/src/components/ui/otp-input.tsx` - Reusable OTP input component

#### Pages
- `frontend/src/app/auth/login/page.tsx` - Updated with OTP flow
- `frontend/src/app/auth/register/page.tsx` - Updated with OTP flow
- `frontend/src/app/auth/forgot-password/page.tsx` - New password reset page

#### API
- Updated `frontend/src/lib/api/auth.ts` with OTP functions

### 🎨 **UI Features**

#### OTP Input Component
- **6-digit input** with auto-focus
- **Keyboard navigation** (arrow keys, backspace)
- **Paste support** for convenience
- **Visual feedback** for active input
- **Accessibility** compliant

#### Multi-step Forms
- **Progressive disclosure** for better UX
- **Clear navigation** between steps
- **Loading states** and error handling
- **Resend functionality** for OTP codes

## Configuration

### 🔧 **Environment Variables**

#### Required for Development
```bash
# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@guestflow.com

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here
```

#### Required for Production
```bash
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

### 📧 **Email Setup**

#### Gmail (Development)
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password
3. Use the App Password in `EMAIL_PASSWORD`

#### SMTP (Production)
1. Configure your SMTP server settings
2. Use proper authentication credentials
3. Test email delivery before deployment

## Security Considerations

### 🔒 **OTP Security**
- **10-minute expiration** prevents long-term attacks
- **Maximum 5 attempts** prevents brute force
- **One-time use** prevents replay attacks
- **Email verification** ensures user ownership

### 🛡️ **Additional Security**
- **HTTPS required** for production
- **Rate limiting** on OTP endpoints
- **Input validation** on all forms
- **Error handling** without information leakage

## Usage Examples

### 🔄 **Registration Flow**
```javascript
// Step 1: Send registration data
const response = await register({
  name: 'John Doe',
  hotelName: 'Grand Hotel',
  email: 'john@example.com',
  password: 'securePassword123'
});

// Step 2: Verify OTP
if (response.requiresOTP) {
  const auth = await verifyRegistrationOTP({
    email: 'john@example.com',
    otp: '123456'
  });
}
```

### 🔑 **Login Flow**
```javascript
// Step 1: Send credentials
const response = await login({
  email: 'john@example.com',
  password: 'securePassword123'
});

// Step 2: Verify OTP
if (response.requiresOTP) {
  const auth = await verifyLoginOTP({
    email: 'john@example.com',
    otp: '123456'
  });
}
```

## Testing

### 🧪 **Test Scenarios**
1. **Valid OTP verification**
2. **Expired OTP handling**
3. **Invalid OTP attempts**
4. **Email delivery failures**
5. **Rate limiting behavior**
6. **Cleanup service functionality**

### 🛠️ **Testing Commands**
```bash
# Run backend tests
npm test

# Test email functionality
npm run test:email

# Test OTP cleanup
npm run test:otp-cleanup
```

## Deployment

### 🚀 **Production Checklist**
- [ ] Configure SMTP settings
- [ ] Set secure JWT secret
- [ ] Enable HTTPS
- [ ] Test email delivery
- [ ] Monitor OTP cleanup logs
- [ ] Set up error monitoring

### 📊 **Monitoring**
- **OTP success rates**
- **Email delivery rates**
- **Cleanup service logs**
- **Error rates and types**

## Troubleshooting

### 🔧 **Common Issues**

#### Email Not Sending
- Check SMTP configuration
- Verify email credentials
- Check network connectivity
- Review email service logs

#### OTP Not Working
- Verify OTP expiration
- Check attempt limits
- Ensure correct email address
- Review database connectivity

#### Frontend Issues
- Check API endpoint URLs
- Verify CORS configuration
- Review browser console errors
- Test with different browsers

## Future Enhancements

### 🚀 **Potential Improvements**
- **SMS OTP delivery** as alternative
- **Push notification OTP** for mobile apps
- **Biometric authentication** integration
- **Advanced rate limiting** with IP tracking
- **OTP analytics** and reporting
- **Multi-language** email templates

## Support

For issues or questions regarding the OTP implementation:
1. Check the troubleshooting section
2. Review application logs
3. Test with different email providers
4. Contact the development team

---

**Note**: This OTP system is designed to be secure, user-friendly, and production-ready. Always follow security best practices and keep dependencies updated. 