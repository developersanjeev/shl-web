import { Resend } from 'resend';
import Stripe from 'stripe';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

export async function sendBookingNotificationEmail(bookingInfo: BookingNotificationData): Promise<boolean> {
  try {
    if (!resend) {
      console.log('⚠️ Resend not configured. Email not sent.');
      console.log('📧 Email notification data for tech@sixhourlayover.com:');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Subject: 🎉 New Booking Confirmed - ${bookingInfo.customerName}`);
      console.log(`Customer: ${bookingInfo.customerName}`);
      console.log(`Email: ${bookingInfo.customerEmail || 'N/A'}`);
      console.log(`Phone: ${bookingInfo.customerPhone || 'N/A'}`);
      console.log(`Tour: ${bookingInfo.tourOption || 'N/A'}`);
      console.log(`Preferred Language: ${bookingInfo.preferredLanguage}`);
      console.log(`Amount: $${bookingInfo.paymentAmount.toFixed(2)} ${bookingInfo.currency}`);
      console.log(`Payment Status: ${bookingInfo.paymentStatus}`);
      console.log(`Booking ID: ${bookingInfo.bookingId || 'N/A'}`);
      console.log(`Session ID: ${bookingInfo.sessionId}`);
      console.log(`Payment Intent: ${bookingInfo.paymentIntentId || 'N/A'}`);
      console.log(`Timestamp: ${new Date().toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })}`);
      console.log('═══════════════════════════════════════════════════════════');
      return false;
    }

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

    const response = await resend.emails.send({
      from: 'Six Hour Layover <noreply@sixhourlayover.com>',
      to: ['tech@sixhourlayover.com'],
      subject: `🎉 New Booking Confirmed - ${bookingInfo.customerName}`,
      html: emailContent,
    });

    if (response.error) {
      console.error('❌ Email sending faile  d:', response.error);
      return false;
    }

    console.log('✅ Email notification sent successfully:', response.data?.id);
    return true;

  } catch (error) {
    console.error('❌ Failed to send notification email:', error);
    return false;
  }
}
