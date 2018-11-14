const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Utilities
const Stripe = require("shared/utilities").Stripe;
const Email = require("shared/utilities").Email;

// Models
const { User } = require("shared/models");

// Constants
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Routes
const router = require("express").Router();

// Add the raw text body of the request to the `request` object
function addRawBody(request, response, next) {
  request.setEncoding("utf8");
  var data = "";
  request.on("data", function(chunk) {
    data += chunk;
  });
  request.on("end", function() {
    request.rawBody = data;
    next();
  });
}

router.post("/stripe",
addRawBody,
(request, response, next) => {
  var event;
  try {
    event = Stripe.stripe.webhooks.constructEvent(
      request.rawBody,
      request.headers["stripe-signature"],
      STRIPE_WEBHOOK_SECRET
    );
    // return OK first
    response.status(200).send("Signed Webhook Received: " + event.id);
    // check if we need to send an email
    const type = event.type;
    switch (type) {
      case "customer.subscription.trial_will_end":
        // if cancelled already, don't send email
        if (event.data.object.canceled_at) {
          return;
        }
        else {
          Logger.info("getting stripeId: " + event.data.object.customer);
          return User.getWithStripeId(event.data.object.customer, "email_encrypted")
          .then( user => {
            return Email.sendTrialWillEnd(user.email);
          })
          .catch( error => {
            Logger.info(error);
          });
        }
      case "customer.source.expiring":
        // if no active subscription, don't email
        var user;
        Logger.info("getting stripeId: " + event.data.object.customer);
        return User.getWithStripeId(event.data.object.customer, "id, email, email_encrypted")
        .then( result => {
          user = result;
          return user.getActiveSubscriptions();
        })
        .then( activeSubscriptions => {
          if (activeSubscriptions.length == 0) {
            return true;
          }
          else {
            return Email.sendCardWillExpire(user.email);
          }
        })
        .catch( error => {
          Logger.info(error);
        });
      case "invoice.created":
        Logger.info("Invoice Created Event: " + JSON.stringify(event));
        // when an invoice is created, if it hasn't been paid yet, check if the user referred anyone. if so, then add a discount for each referred, active user
        var stripeId = event.data.object.customer;
        if (event.data.object.paid == true) {
          Logger.info("Already paid, not checking for referral discounts to add to invoice.");
          return true;
        }
        else {
          Logger.info("Not yet paid, checking for referral discounts to add to invoice.");
          const subscriptionItem = getSubscriptionItemFromInvoice(event);
          if (subscriptionItem == null) {
            Logger.error("no subscription item found in this invoice on invoice_created: " + JSON.stringify(event));
            return;
          }
          const planId = subscriptionItem.plan.id;
          var currency;
          return User.getWithStripeId(stripeId, "id")
          .then( user => {
            return user.getActiveReferrals();
          })
          .then( referrals => {
            return Stripe.addReferralDiscounts(stripeId, planId, subscriptionItem.currency, referrals);
          })
          .catch( error => {
            Logger.info(error);
          });
        }
      case "invoice.payment_failed":
        Logger.info("getting stripeId: " + event.data.object.customer);
        return User.getWithStripeId(event.data.object.customer, "email_encrypted")
        .then( user => {
          return Email.sendPaymentFailed(user.email);
        })
        .catch( error => {
          Logger.info(error);
        });
      case "invoice.payment_succeeded":
        // when invoice payment succeeds, if user was referred, notify the referrer
        Logger.info("Invoice Success Event: " + JSON.stringify(event));
        var stripeId = event.data.object.customer;
        const subscriptionItem = getSubscriptionItemFromInvoice(event);
        if (subscriptionItem == null) {
          Logger.error("no subscription item found in this invoice on payment_succeeded: " + JSON.stringify(event));
          return;
        }
        const planId = subscriptionItem.plan.id;
        var referredByUser;
        return User.getWithStripeId(stripeId, "id, referred_by, email_encrypted, referral_code")
        .then( thisUser => {
          // if this is a first successful payment, tell them they can refer others to save
            // - amount_remaining <= 0
            // - lines.data[0].amount > 0 (trial charge is 0)
            // - invoice number is 0002
          var isFirstPayment = false;
          if (event.data.object.amount_remaining <= 0 && subscriptionItem.amount > 0 && event.data.object.number.endsWith("0002")) {
            isFirstPayment = true;
            Email.sendReferralPromo(thisUser.email, thisUser.referralCode);
          }
          if (thisUser.referredBy) {
            Logger.info("this user was referred by " + thisUser.referredBy);
            return User.getWithId(thisUser.referredBy, "id, stripe_id, email_encrypted")
            .then( user => {
              referredByUser = user;
              if (isFirstPayment) {
                Logger.info("first real sub charge after trial (2nd invoice), notify referrer");
                return Email.sendSubscriptionStartedReferrer(referredByUser.email, thisUser.email);
              }
              // otherwise if it's a trial charge, notify referrer that a trial has started for their referee
              else if (event.data.object.amount_due == 0 && event.data.object.amount_paid == 0 && subscriptionItem.amount == 0) {
                Logger.info("trial started, notifying referrer via email");
                return Email.sendTrialStartedReferrer(referredByUser.email, thisUser.email);
              }
              return true;
            })
            .catch( error => {
              Logger.info("error on payment_succeeded webhook");
              throw new Error(error);
            });
          }
          else {
            Logger.info("this user wasn't referred by anyone");
          }
        })
        .catch( error => {
          Logger.info(error + error.stack);
        });
      default:
        throw new ConfirmedError(500, 1, `Unknown event type from Stripe: ${type}`);
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

// Finds the subscription item in the invoice (there can be non-subscription invoiceitems like discounts) and returns it
function getSubscriptionItemFromInvoice(event) {
  var subscriptionItem = null;
  for (const item of event.data.object.lines.data) {
    if (item.type == "subscription") {
      subscriptionItem = item;
      break;
    }
  }
  return subscriptionItem;
}