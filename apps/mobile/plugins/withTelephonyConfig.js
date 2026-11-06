const { withAndroidManifest } = require("@expo/config-plugins");

const withTelephonyConfig = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure uses-permission entries
    const permissions = [
      "android.permission.CALL_PHONE",
      "android.permission.READ_PHONE_STATE",
      "android.permission.READ_CALL_LOG",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_PHONE_CALL",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
    ];

    if (!androidManifest["uses-permission"]) {
      androidManifest["uses-permission"] = [];
    }

    const existingPermissions = new Set(
      androidManifest["uses-permission"].map((p) => p.$["android:name"]),
    );

    for (const permission of permissions) {
      if (!existingPermissions.has(permission)) {
        androidManifest["uses-permission"].push({
          $: { "android:name": permission },
        });
      }
    }

    return config;
  });
};

module.exports = withTelephonyConfig;
