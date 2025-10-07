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
async function sendBookingNotificationEmail(bookingInfo: BookingNotificationData): Promise<boolean> {
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

    const response = await mg.messages().send(data, (error, body) => {
      if (error) {
        console.error('❌ Email sending failed:', error,mg);
        return NextResponse.json({ success: false, error });
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

export async function POST(request: NextRequest) {
  try {
    if (!stripe || !webhookSecret || !mg) {
      return NextResponse.json(
        { error: 'Stripe webhook or Mailgun is not configured' },
        { status: 500 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;

        // Handle successful payment
        console.log('Payment succeeded for session:', session.id);

        // Extract booking information from session metadata
        const bookingInfo = {
          sessionId: session.id,
          bookingId: session.metadata?.bookingId,
          customerName: `${session.metadata?.firstName} ${session.metadata?.lastName}`,
          customerEmail: session.customer_email,
          customerPhone: session.metadata?.phone,
          tourOption: session.metadata?.tourOption,
          preferredLanguage: session.metadata?.preferredLanguage || 'English',
          paymentAmount: session.amount_total ? session.amount_total / 100 : 0,
          paymentStatus: session.payment_status,
          currency: session.currency?.toUpperCase() || 'USD',
          paymentIntentId: session.payment_intent,
          createdAt: new Date(session.created * 1000).toISOString(),
        };

        console.log('Booking completed:', bookingInfo);

        // Send email notification using Mailgun
        const emailSent = await sendBookingNotificationEmail(bookingInfo);
        if (emailSent) {
          console.log('✅ Email notification sent successfully');
        } else {
          console.log('⚠️ Email notification failed or not configured');
        }

        break;

      case 'checkout.session.expired':
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session expired:', expiredSession.id);
        break;

      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
