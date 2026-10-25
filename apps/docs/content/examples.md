# Examples

These boards are in the repository in `packages/jumper/examples`. The playground's example menu opens the same boards. Select **Open in playground** on any of them to edit it.

## Invoice autopay

An invoice autopay flow, from the breadboarding chapter of Shape Up, drawn as wireframes. It has two regions, two systems, a wire label and an open question. Both stories pass.

```jumper story=1
; Shape Up's autopay breadboard, drawn as wireframes.
(board "Invoice autopay"
  (region "Turn it on" "Can a client switch on autopay from the invoice they are paying?"
    (screen :invoice "Invoice"
      (title "Invoice #1042")
      (text "Amount due £480, due 14 Nov")
      (primary "Pay now")
      (button "Turn on Autopay" -> :setup)
      (slot "Autopay on" -> :charge "on due date")
      (note "The slot shows only when autopay is on."))
    (screen :setup "Setup Autopay"
      (title "Pay invoices automatically")
      (field "Card number")
      (field "Expiry / CVC")
      (check "Charge on the due date")
      (primary "Submit" -> :save-card))
    (system :save-card "Save card"
      (out "valid" -> :confirm)
      (out "declined" -> :setup)))
  (region "Confirm" "What does the client see once it is on?"
    (screen :confirm "Confirmation"
      (title "Autopay is on")
      (text "Future invoices pay themselves on their due date.")
      (link "Back to invoice" -> :invoice)
      (question "Do we email a receipt for each automatic charge?"))
    (system :charge "Charge card"
      (out "paid" -> :confirm "receipt"))))

(story "Client turns on autopay"
  (step :invoice "Opens the overdue invoice" :via "Turn on Autopay")
  (step :setup "Enters the card once" :touch "Card number" :via "Submit")
  (step :save-card "Card is verified" :via "valid")
  (step :confirm "Future invoices pay themselves"))

(story "Card is declined"
  (step :setup "Submits a bad card")
  (step :save-card "Bank declines it" :via "declined")
  (step :setup "Sees the form again"))
```

## Password reset

Two decisions and a system. The note records a security decision: the screen says the same thing whether or not the email has an account.

```jumper story=1
(board "Password reset"
  (region "Ask" "How does someone who forgot their password ask for a new one?"
    (screen :sign-in "Sign in"
      (title "Welcome back")
      (field "Email")
      (field "Password")
      (primary "Sign in")
      (link "Forgot password?" -> :request))
    (screen :request "Reset password"
      (title "Reset your password")
      (text "We will email you a link.")
      (field "Email")
      (primary "Send link" -> :known))
    (decision :known "Is the email on an account?"
      (to :send "yes")
      (to :sent "no"))
    (system :send "Send reset email"
      (out "sent" -> :sent)))
  (region "Reset" "What happens when they open the link?"
    (screen :sent "Check your email"
      (title "Check your email")
      (text "If the address has an account, a link is on its way.")
      (link "Open link from email" -> :valid)
      (note "Same message either way, so we do not reveal which emails have accounts."))
    (decision :valid "Is the link still valid?"
      (to :new-password "yes")
      (to :expired "expired"))
    (screen :new-password "Choose a new password"
      (field "New password")
      (field "Confirm password")
      (primary "Save password" -> :sign-in "signed out"))
    (screen :expired "Link expired"
      (text "Links last 30 minutes.")
      (button "Send a new link" -> :request)
      (question "Should we rate-limit new links per hour?"))))

(story "Forgot password, happy path"
  (step :sign-in "Cannot remember the password")
  (step :request "Asks for a reset link" :touch "Email")
  (step :known "Account found" :via "yes")
  (step :send "Email goes out")
  (step :sent "Opens the link from the email")
  (step :valid "Link is fresh" :via "yes")
  (step :new-password "Picks a new password")
  (step :sign-in "Signs in with it"))

(story "Link has expired"
  (step :sent "Opens an old email")
  (step :valid "Link is too old" :via "expired")
  (step :expired "Asks for another" :via "Send a new link")
  (step :request "Starts again"))
```

## Volunteer requests

Kanban columns, posts and a slot widget. One gap is left on purpose: the last story step has no wire back to the thread.

```jumper check
; One gap is left on purpose: nothing wires "Sent" back to the thread.
(board "Volunteer requests"
  (region "Post a request" "Can a coordinator post a request in under a minute?"
    (screen :requests "Requests"
      (title "Requests")
      (columns
        (col "Open" "Drivers for Sat" "Kitchen help")
        (col "Filled" "Stewards")
        (col "Closed"))
      (primary "New request" -> :compose))
    (screen :compose "New request"
      (field "What do you need?")
      (field "When")
      (slot "Skills picker")
      (primary "Post" -> :thread)
      (question "Do requests expire on their own?")))
  (region "Reply" "How do volunteers say yes?"
    (screen :thread "Request thread"
      (title "Drivers for Sat")
      (meta "Posted by a coordinator · 2 h ago")
      (post "Coordinator" "Need two drivers from 9 am.")
      (post "Volunteer" "I can do the morning run.")
      (field "Reply")
      (button "I can help" -> :confirm-help))
    (decision :confirm-help "Still slots left?"
      (to :sent "yes")
      (to :full "no"))
    (screen :sent "Sent"
      (text "Thanks. The coordinator will confirm by email.")
      (link "View in email"))
    (screen :full "Request is full"
      (text "Someone got there first.")
      (link "See other requests" -> :requests))))

(story "Volunteer offers to drive"
  (step :thread "Reads the request" :via "I can help")
  (step :confirm-help "There is a slot" :via "yes")
  (step :sent "Gets the email")
  (step :thread "Comes back to the thread"))
```

## Broken checkout

A board that is broken on purpose. Each mistake shows a different gap.

```jumper check
; This board is broken on purpose. Each mistake shows a different gap check.
(board "Broken checkout"
  (region "Checkout"
    (screen :cart "Cart"
      (list "Mug" "Tea towel")
      (primary "Checkout" -> :payment))
    (screen :payment "Payment"
      (field "Card")
      (primary "Pay" -> :receipt)
      (link "Back to cart" -> :cart)
      (link "Apply voucher" -> :voucher)))
  (region "Orphans" "These screens point at each other, but nothing leads in."
    (screen :help "Help"
      (link "Contact us" -> :contact))
    (screen :contact "Contact"
      (link "Help" -> :help))))

(story "Buys a mug"
  (step :cart "Adds a mug" :via "Checkout")
  (step :payment "Pays" :via "Pay")
  (step :receipt "Sees the receipt"))

(story "Skips ahead"
  (step :cart "Looks at the cart")
  (step :contact "Somehow lands on contact" :touch "Email us"))
```

## The same board as a breadboard

Add `--breadboard` to `jumper build`, or select **Breadboard** in the playground, to draw the classic breadboard style.

```jumper breadboard
; Shape Up's autopay breadboard, drawn as wireframes.
(board "Invoice autopay"
  (region "Turn it on" "Can a client switch on autopay from the invoice they are paying?"
    (screen :invoice "Invoice"
      (title "Invoice #1042")
      (text "Amount due £480, due 14 Nov")
      (primary "Pay now")
      (button "Turn on Autopay" -> :setup)
      (slot "Autopay on" -> :charge "on due date")
      (note "The slot shows only when autopay is on."))
    (screen :setup "Setup Autopay"
      (title "Pay invoices automatically")
      (field "Card number")
      (field "Expiry / CVC")
      (check "Charge on the due date")
      (primary "Submit" -> :save-card))
    (system :save-card "Save card"
      (out "valid" -> :confirm)
      (out "declined" -> :setup)))
  (region "Confirm" "What does the client see once it is on?"
    (screen :confirm "Confirmation"
      (title "Autopay is on")
      (text "Future invoices pay themselves on their due date.")
      (link "Back to invoice" -> :invoice)
      (question "Do we email a receipt for each automatic charge?"))
    (system :charge "Charge card"
      (out "paid" -> :confirm "receipt"))))

(story "Client turns on autopay"
  (step :invoice "Opens the overdue invoice" :via "Turn on Autopay")
  (step :setup "Enters the card once" :touch "Card number" :via "Submit")
  (step :save-card "Card is verified" :via "valid")
  (step :confirm "Future invoices pay themselves"))

(story "Card is declined"
  (step :setup "Submits a bad card")
  (step :save-card "Bank declines it" :via "declined")
  (step :setup "Sees the form again"))
```
