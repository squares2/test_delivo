import express from 'express';
import twilio from 'twilio';
import 'dotenv/config';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors()); 

const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Temporary memory to store the codes so we can check them later
const otpStorage = {}; 

// --- STEP 1: SENDING THE CODE ---
// This is what database.js calls when the user clicks "Register"
app.post('/send-otp', async (req, res) => {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000);
    
    // Save it in our memory
    otpStorage[phone] = otp;

    try {
        await client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${phone}`,
            body: `Your Delivo verification code is: ${otp}`
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- STEP 2: VERIFYING THE CODE ---
// This is what database.js calls when the user types the code and clicks "Verify"
app.post('/verify-otp', (req, res) => {
    const { phone, otp } = req.body; // Changed 'code' to 'otp' to match frontend

    console.log(`Checking OTP for ${phone}. User entered: ${otp}. Expected: ${otpStorage[phone]}`);

    if (otpStorage[phone] && otpStorage[phone] == otp) {
        delete otpStorage[phone];
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: "Invalid or expired code" });
    }
});

app.get('/', (req, res) => {
    res.send('✅ Delivo Security Server is running!');
});

app.listen(3000, () => console.log('✅ Security server running on http://localhost:3000'));
