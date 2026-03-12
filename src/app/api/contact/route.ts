import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/security/sanitize';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export async function POST(request: NextRequest) {
    try {
        // Rate limit: 5 requests per 5 minutes per IP
        const rateLimitResponse = checkRateLimit(request, { maxRequests: 5, windowMs: 5 * 60 * 1000 });
        if (rateLimitResponse) return rateLimitResponse;

        const resend = new Resend(process.env.RESEND_API_KEY);
        const body = await request.json();
        const { name, email, message } = body;

        // Validate required fields
        if (!name || !email || !message) {
            return NextResponse.json(
                { error: 'Name, email, and message are required' },
                { status: 400 }
            );
        }

        // Sanitize user inputs before HTML interpolation
        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

        // Send email via Resend
        const { data, error } = await resend.emails.send({
            from: 'F3 Marietta <contact@f3marietta.com>',
            to: ['f3marietta@googlegroups.com'],
            replyTo: email,
            subject: `F3 Marietta Contact: ${safeName}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <hr />
                <p><strong>Message:</strong></p>
                <p>${safeMessage}</p>
                <hr />
                <p style="color: #666; font-size: 12px;">
                    This message was sent via the F3 Marietta website contact form.
                </p>
            `,
        });

        if (error) {
            console.error('Resend error details:', JSON.stringify(error, null, 2));
            console.error('Resend error name:', error.name);
            console.error('Resend error message:', error.message);
            return NextResponse.json(
                { error: 'Failed to send email', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, messageId: data?.id });
    } catch (error) {
        console.error('Contact form error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
