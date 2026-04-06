const mongoose = require('mongoose');
const BusinessConfig = require('./Models/BusinessConfig');
const { decrypt } = require('./services/emailService');
const nodemailer = require('nodemailer');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const config = await BusinessConfig.findById('69b596ed919b221a9a8d2420')
    .select('emailSettings businessName')
    .lean({ virtuals: false });
  
  if (!config?.emailSettings) {
    console.log('No email settings');
    process.exit(1);
  }

  console.log('Email:', config.emailSettings.senderEmail);
  console.log('Has password:', !!config.emailSettings.appPassword);
  
  let password;
  try {
    password = decrypt(config.emailSettings.appPassword);
    console.log('Decrypted password length:', password.length);
    console.log('Password preview:', password.substring(0, 4) + '...');
  } catch (e) {
    console.error('Decrypt failed:', e.message);
    process.exit(1);
  }

  console.log('\nCreating transporter...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.emailSettings.senderEmail,
      pass: password
    }
  });

  console.log('Sending test email...');
  try {
    const info = await transporter.sendMail({
      from: '"Test" <' + config.emailSettings.senderEmail + '>',
      to: config.emailSettings.senderEmail,
      subject: 'Test MenuBy Email',
      html: '<h1>Test OK</h1><p>Email works!</p>'
    });
    console.log('SUCCESS! MessageId:', info.messageId);
  } catch (e) {
    console.error('SEND FAILED:', e.message);
    console.error('Code:', e.code);
    console.error('Response:', e.response);
  }

  process.exit(0);
}

test().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
