# Webhook Server

This is a semi-private Node.js Express app that hosts the Webhook Server `https://webhook.[domain]`. The Webhook Server sends notifications to users when the following events occur:

- User's trial is about to end
- User's payment method is about to expire
- User's invoice payment failed

The Webhook Server's security group takes requests only from IPs associated with Stripe. 

## Prerequisites

* Run the Webhook [CloudFormation](https://github.com/confirmedcode/Server-CloudFormation) and all its prerequisites

## How It Works

Stripe webhook events are configured to be sent to

```
POST /stripe
```

When these events are received by the Webhook Server, the server look ups the User using the Stripe ID, then sends them the appropriate email based on the event type.

The Webhook Server always returns status code `200` to Stripe.

## Support

<engineering@confirmedvpn.com>