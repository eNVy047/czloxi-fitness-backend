const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const { User } = require('./src/models/User');
  const { DailyLog } = require('./src/models/DailyLog');
  const { DashboardService } = require('./src/modules/dashboard/dashboard.service');
  const { Notification } = require('./src/models/Notification');
  
  const user = await User.findOne({});
  if (!user) {
    console.log("No user found");
    process.exit(0);
  }
  
  // Set water goal to 1 and water glasses to 0 to trigger the notification
  const log = await DashboardService.getOrCreateTodayLog(user._id.toString());
  log.waterGoal = 1;
  log.waterGlasses = 0;
  await log.save();
  
  console.log("Adding water glass...");
  await DashboardService.addWaterGlass(user._id.toString());
  
  const notifications = await Notification.find({ userId: user._id, type: 'achievement' }).sort({ createdAt: -1 });
  console.log("Latest notification:", notifications[0]);
  
  process.exit(0);
}
run();
