const { Expo } = require('expo-server-sdk');
let expo = new Expo();

let pushToken = 'ExponentPushToken[XTfJ6RKSgFoYrzWOIF0eeQ]';
console.log('Sending to', pushToken);

async function run() {
  try {
    let chunks = expo.chunkPushNotifications([{
      to: pushToken,
      sound: 'default',
      title: 'Test Notification',
      body: 'Testing Expo delivery!',
      data: { withSome: 'data' },
    }]);
    
    for (let chunk of chunks) {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log('Ticket chunk:', ticketChunk);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
run();
