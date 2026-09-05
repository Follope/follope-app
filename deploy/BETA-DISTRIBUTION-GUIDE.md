# Follope — Beta Distribution Guide for Instagram Creators

You already did the outreach and have warm responses from Indian freelance creators waiting for the link. Here is how to generate the beta build and send it directly to them.

---

## 1. Option A: Generate Standalone Android APK (Recommended)

Using Expo Application Services (EAS), you can generate a direct `.apk` download link without submitting to the Google Play Store:

```bash
cd mobile

# 1. Install EAS CLI globally (if not already installed)
npm install -g eas-cli

# 2. Log in to your free Expo account
eas login

# 3. Trigger the APK preview build
eas build -p android --profile preview
```

Once the cloud build finishes (~5–10 minutes), EAS provides a download URL for the `.apk` file (e.g. `https://expo.dev/artifacts/eas/...apk`) which you can share directly.

---

## 2. Option B: Web App / PWA Link (Instant — No Installation)

Because we built the web export in Phase 2, anyone can use Follope directly in Chrome or Safari on their phone by visiting:

👉 **`https://follope.com`**

They can also tap *"Add to Home Screen"* in Chrome to install it as an app icon on their phone without downloading an APK.

---

## 3. DM Reply Templates for Your Instagram Leads

Copy and paste these personalized replies to your leads based on their specific survey answers:

### 📩 To `vivek.edits10x` (Focused on all-in-one payment records & tracking):
> *"Hey Vivek bhai! Kaise ho? As promised, Follope ka first beta version ready ho gaya hai. Isme aap seedha 1-tap me invoice bana sakte ho, client ke sath WhatsApp pe professional UPI link share kar sakte ho, aur kisne pay kiya/pending hai sab dashboard pe track hota hai. Aap is link se try karke apna honest feedback de sakte ho: [YOUR_LINK_HERE]. Thank you bhai!"*

### 📩 To `santha._edits` (Faced 1–2 week delays and awkward follow-ups):
> *"Hey Santha! Hope you're doing well. Remember we spoke about payment delays and following up with clients? Follope is now ready for beta testing! You can now send an invoice with direct UPI QR code and polite 1-tap WhatsApp reminders that do the follow-up for you. Would love to have you try it out: [YOUR_LINK_HERE]. Let me know what you think!"*

### 📩 To `nitzexvisual` (Frustrated with chasing payments and tracking who owes what):
> *"Hey! Hope your projects are going great. We spoke earlier about the headache of chasing payments after delivering work. Follope's first version is ready to test! It tracks all pending vs paid invoices and generates instant UPI payment links. Check it out here: [YOUR_LINK_HERE] and let me know your honest feedback!"*

---

## 4. Key Questions to Ask After They Create an Invoice

1. *"Was it quick to create an invoice, or was any step confusing?"*
2. *"Did you send the link to a client on WhatsApp? How did they react?"*
3. *"Is there any missing field (like advance payments or tax) that you need?"*
