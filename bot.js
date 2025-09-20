// প্রয়োজনীয় লাইব্রেরিগুলো নিয়ে আসা হচ্ছে
const TelegramBot = require('node-telegram-bot-api');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// --- এখানে আপনার নিজের তথ্য দিন ---
const WEBAPP_URL = 'https://gleeful-salmiakki-c9bf45.netlify.app/'; // !! খুবই গুরুত্বপূর্ণ: এই URL পরিবর্তন করতে হবে !!
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // এটি আমরা Render-এ সেট করেছি
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY); // এটিও Render-এ সেট করা আছে

// Firebase এবং Telegram Bot চালু করা হচ্ছে
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const bot = new TelegramBot(BOT_TOKEN);

// --- Render.com Health Check - START ---
// এই অংশটি Render-কে জানানোর জন্য যে আমাদের বটটি ঠিকভাবে চলছে
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive');
});
server.listen(10000, () => {
    console.log('Health check server running on port 10000');
});
// --- Render.com Health Check - END ---

console.log('Bot is starting up...');

// যখন কোনো ব্যবহারকারী /start কমান্ড দেয়
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newUserId = `tg_${chatId}`; // নতুন ব্যবহারকারীর আইডি
    const referrerId = match[1]; // রেফারেল লিংক থেকে পাওয়া রেফারারের আইডি

    try {
        const newUserRef = db.collection('users').doc(newUserId);
        const newUserDoc = await newUserRef.get();

        // যদি ব্যবহারকারী নতুন হয়, তবেই রেফারেল কাউন্ট হবে
        if (!newUserDoc.exists) {
            console.log(`New user detected: ${newUserId}`);
            
            const defaultUserData = {
                userId: newUserId,
                csBalance: 0, usdBalance: 0,
                hashPower: 10, dailyUsdReward: 0,
                lastTapTime: 0, purchasedPackages: [],
                referralCount: 0, referralEarnings: 0,
                createdAt: FieldValue.serverTimestamp()
            };

            if (referrerId && referrerId !== newUserId) {
                console.log(`User ${newUserId} was referred by ${referrerId}.`);
                defaultUserData.referredBy = referrerId;

                const referrerRef = db.collection('users').doc(referrerId);
                await referrerRef.update({
                    referralCount: FieldValue.increment(1)
                });
                console.log(`Referrer count for ${referrerId} updated.`);
            }
            
            await newUserRef.set(defaultUserData);
            console.log(`New user data for ${newUserId} saved to Firebase.`);
        }

        // ব্যবহারকারীকে মিনি অ্যাপ খোলার বাটন পাঠান
        bot.sendMessage(chatId, "Welcome to Coin Switch! 🚀\n\nClick the 'Start Mining' button below to open the app and start earning!", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💎 Start Mining', web_app: { url: WEBAPP_URL } }]
                ]
            }
        });

    } catch (error) {
        console.error('Error processing /start command:', error);
        bot.sendMessage(chatId, "Sorry, something went wrong. Please try again later.");
    }
});

console.log('Bot is running and listening for commands...');
