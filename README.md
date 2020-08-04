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

## Feedback
If you have any questions, concerns, or other feedback, please let us know any feedback in Github issues or by e-mail.

We also have a bug bounty program -- please email <engineering@confirmedvpn.com> for details.

## License

This project is licensed under the GPL License - see the [LICENSE.md](LICENSE.md) file for details

## Contact

<engineering@confirmedvpn.com>