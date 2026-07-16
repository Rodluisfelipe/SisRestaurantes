/**
 * Local Expo config plugin — copies our white notification icon into the Android
 * drawable resources as `ic_notification`, so Notifee can use it as the status-bar
 * small icon (Android tints it white automatically).
 *
 * Needed because we no longer use expo-notifications (which used to generate this).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withNotificationIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, 'assets', 'notification-icon.png');
      const drawableDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'drawable'
      );
      fs.mkdirSync(drawableDir, { recursive: true });
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(drawableDir, 'ic_notification.png'));
      }
      return cfg;
    },
  ]);
};
