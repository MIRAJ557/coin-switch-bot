// --- ধাপ ১: প্রয়োজনীয় লাইব্রেরি এবং ভেরিয়েবল সেটআপ (আপনার মতোই) ---
const TelegramBot = require('node-telegram-bot-api');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// --- আপনার নিজের তথ্য দিন ---
const WEBAPP_URL = 'https://gleeful-salmiakki-c9bf45.netlify.app/'; // !! এই URL পরিবর্তন করতে হতে পারে !!
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // এটি Render-এ সেট করা আছে, যা সঠিক
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY); // এটিও Render-এ সেট করা আছে, চমৎকার!

// --- ধাপ ২: Firebase এবং Telegram Bot চালু করা ---
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
// গুরুত্বপূর্ণ পরিবর্তন: polling: true যোগ করতে হবে যাতে বট সব সময় মেসেজ শোনে
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('Bot has been started...');

// --- ধাপ ৩: "/start" কমান্ডের জন্য লজিক লেখা (সবচেয়ে গুরুত্বপূর্ণ অংশ) ---

// bot.onText() ফাংশনটি নির্দিষ্ট কমান্ড শোনার জন্য কাজ করে
// /\/start(.*)/ মানে হলো, "/start" দিয়ে শুরু হওয়া যেকোনো মেসেজ সে ধরবে
bot.onText(/\/start(.*)/, async (msg, match) => {

    // msg.chat.id থেকে আমরা ব্যবহারকারীর ইউনিক টেলিগ্রাম আইডি পাই
    const chatId = msg.chat.id;
    const newUserId = `tg_${chatId}`;
    
    // match[1] এর মধ্যে রেফারেল কোডটি থাকবে (যদি থাকে)
    // .trim() দিয়ে অতিরিক্ত স্পেস মুছে ফেলা হলো
    const referrerId = match[1] ? match[1].trim() : null;

    console.log(`User ${newUserId} started the bot.`);
    if (referrerId) {
        console.log(`Referrer ID found: ${referrerId}`);
    }

    // নতুন ব্যবহারকারীকে ডাটাবেসে খোঁজা হচ্ছে
    const newUserRef = db.collection('users').doc(newUserId);
    const doc = await newUserRef.get();

    // যদি ব্যবহারকারী ডাটাবেসে না থাকে, তবে সে নতুন ব্যবহারকারী
    if (!doc.exists) {
        console.log(`Creating new user profile for ${newUserId}`);

        // নতুন ব্যবহারকারীর জন্য ডিফল্ট ডেটা তৈরি করা
        const userData = {
            userId: newUserId,
            csBalance: 0,
            usdBalance: 0,
            hashPower: 10,
            dailyUsdReward: 0,
            lastTapTime: 0,
            purchasedPackages: [],
            referralCount: 0,
            referralEarnings: 0,
            createdAt: FieldValue.serverTimestamp() // ব্যবহারকারী কখন যোগ দিয়েছে তা সেভ হবে
        };

        // যদি রেফারার থাকে এবং সে নিজে না হয়
        if (referrerId && referrerId !== newUserId) {
            userData.referredBy = referrerId;

            // রেফারারের referralCount 1 বাড়ানো হবে
            const referrerRef = db.collection('users').doc(referrerId);
            const referrerDoc = await referrerRef.get();

            if (referrerDoc.exists) {
                console.log(`Updating referrer ${referrerId}'s referral count.`);
                await referrerRef.update({
                    referralCount: FieldValue.increment(1) // increment(1) সবচেয়ে নিরাপদ উপায়
                });
            }
        }

        // নতুন ব্যবহারকারীর তথ্য ডাটাবেসে সেভ করা
        await newUserRef.set(userData);
    } else {
        console.log(`User ${newUserId} already exists.`);
    }

    // সবশেষে, ব্যবহারকারীকে অ্যাপ খোলার বাটনসহ স্বাগত বার্তা পাঠানো
    await bot.sendMessage(chatId, 'Welcome to Coin Switch! 🚀\n\nClick the button below to open the mining app and start earning!', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚡ Open Mining App', web_app: { url: WEBAPP_URL } }]
            ]
        }
    });
});
