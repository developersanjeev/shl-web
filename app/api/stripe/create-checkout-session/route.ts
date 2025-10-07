import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    const {
      bookingId,
      productId,
      addOnIds = [],
      travelerCount,
      customerEmail,
      metadata = {},
    } = await request.json();

    // Import product configurations
    const { STRIPE_TOUR_PRODUCTS, STRIPE_ADD_ONS } = await import('@/lib/stripe-products');

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Find the selected product
    const selectedProduct = STRIPE_TOUR_PRODUCTS.find(p => p.id === productId);
    if (!selectedProduct) {
      return NextResponse.json(
        { error: 'Selected tour option is not available' },
        { status: 400 }
      );
    }

    const rawTravelerCount =
      typeof travelerCount === 'number'
        ? travelerCount
        : Number.parseInt(`${travelerCount ?? ''}`, 10);
    const normalizedTravelerCount = Number.isFinite(rawTravelerCount) ? rawTravelerCount : 0;

    if (selectedProduct.groupSize === 'per-person' && normalizedTravelerCount < 1) {
      return NextResponse.json(
        { error: 'Missing traveler count for per-person pricing' },
        { status: 400 }
      );
    }

    const perPersonQuantity =
      selectedProduct.groupSize === 'per-person'
        ? normalizedTravelerCount
        : 1;

    const payingQuantity = Math.max(1, perPersonQuantity);

    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: selectedProduct.name,
          description: selectedProduct.description,
          metadata: {
            productId: selectedProduct.id,
          },
        },
        unit_amount: selectedProduct.price * 100, // Convert to cents
      },
      quantity: Math.max(1, payingQuantity),
    });

    // Add selected add-ons
    if (addOnIds && addOnIds.length > 0) {
      addOnIds.forEach((addOnId: string) => {
        const addOn = STRIPE_ADD_ONS.find(a => a.id === addOnId);
        if (addOn) {
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: addOn.name,
                description: addOn.description,
                metadata: {
                  addOnId: addOn.id,
                },
              },
              unit_amount: addOn.price * 100, // Convert to cents
            },
            quantity: 1,
          });
        }
      });
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid products found' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}booking-cancelled`,
      metadata: {
        bookingId,
        ...metadata,
        travelerCount: String(
          selectedProduct.groupSize === 'per-person'
            ? Math.max(1, normalizedTravelerCount)
            : Math.max(1, normalizedTravelerCount || payingQuantity)
        ),
      },
      customer_email: customerEmail,
      automatic_tax: {
        enabled: true,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
