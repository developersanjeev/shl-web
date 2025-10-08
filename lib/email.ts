import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as mailgun from 'mailgun-js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Mailgun
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain: 'sixhourlayover.com' });

interface BookingNotificationData {
  sessionId: string;
  bookingId: string | undefined;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | undefined;
  tourOption: string | undefined;
  preferredLanguage: string;
  paymentAmount: number;
  paymentStatus: string;
  currency: string;
  paymentIntentId: string | Stripe.PaymentIntent | null;
  createdAt: string;
}



// Send email using Mailgun
export async function sendBookingNotificationEmail(bookingInfo: BookingNotificationData): Promise<boolean> {
      console.log(mg);
  try {
    if (!mg) {
      console.log('⚠️ Mailgun not configured. Email not sent.');
      return false;
    }

    console.log(mg);

    const emailContent = `
      <h2>🎉 New Booking Confirmed</h2>
      
      <h3>Customer Information</h3>
      <ul>
        <li><strong>Name:</strong> ${bookingInfo.customerName}</li>
        <li><strong>Email:</strong> ${bookingInfo.customerEmail || 'N/A'}</li>
        <li><strong>Phone:</strong> ${bookingInfo.customerPhone || 'N/A'}</li>
      </ul>
      
      <h3>Booking Details</h3>
      <ul>
        <li><strong>Tour Option:</strong> ${bookingInfo.tourOption || 'N/A'}</li>
        <li><strong>Preferred Language:</strong> ${bookingInfo.preferredLanguage}</li>
        <li><strong>Total Amount:</strong> $${bookingInfo.paymentAmount.toFixed(2)} ${bookingInfo.currency}</li>
        <li><strong>Payment Status:</strong> ${bookingInfo.paymentStatus}</li>
      </ul>
      
      <h3>Technical Details</h3>
      <ul>
        <li><strong>Booking ID:</strong> ${bookingInfo.bookingId || 'N/A'}</li>
        <li><strong>Stripe Session ID:</strong> ${bookingInfo.sessionId}</li>
        <li><strong>Payment Intent ID:</strong> ${bookingInfo.paymentIntentId || 'N/A'}</li>
        <li><strong>Booking Time:</strong> ${new Date().toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}</li>
      </ul>
      
      <p><em>This booking was automatically processed through the Six Hour Layover booking system.</em></p>
    `;

    const data = {
      from: 'Six Hour Layover <noreply@sixhourlayover.com>',
      to: ['booking@sixhourlayover.com'],
      subject: `🎉 New Booking Confirmed - ${bookingInfo.customerName}`,
      html: emailContent,
    };

    const response = await mg.messages().send(data, (error, body ,mg) => {
      if (error) {
        console.error('❌ Email sending faileg d:', error,mg);
        return NextResponse.json({ success: false, error, 'mg':mg });
      }

      console.log('✅ Email sent successfully:', body);
      return NextResponse.json({ success: true, body });
    });

    return true;
  } catch (error) {

    console.error('❌ Failed to send notification email:', error);
    return false;
  }
}

