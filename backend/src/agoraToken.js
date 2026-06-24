const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

/**
 * Sinh Agora RTC token có hỗ trợ role.
 *
 * @param {string} channelName - Tên kênh (roomId)
 * @param {number} uid         - User ID
 * @param {string} role        - 'subscriber' | 'publisher'
 * @param {number} [expirationSeconds=3600]
 * @returns {string} Agora RTC token
 */
function generateRtcToken(channelName, uid, role = 'publisher', expirationSeconds = 3600) {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error('Agora App ID and Certificate are required');
  }

  const agoraRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs
  );

  return token;
}

module.exports = { generateRtcToken };
