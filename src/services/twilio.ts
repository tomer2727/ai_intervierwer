
import { Twilio } from 'twilio';

// Lazy-load Twilio client to ensure env vars are loaded
const getTwilioClient = () => {
  return new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
};

/**
 * Generates TwiML to connect a call to the media stream WebSocket.
 * @param host The host of the WebSocket server (without protocol).
 * @returns XML string
 */
export const generateStreamTwiML = (host: string): string => {
  return `
    <Response>
        <Say>Please wait while we connect you to the AI Interviewer.</Say>
        <Connect>
            <Stream url="wss://${host}/media-stream" track="inbound_track">
                <Parameter name="codec" value="PCMU" />
            </Stream>
        </Connect>
    </Response>
    `;
};

/**
 * Initiates an outbound call to the specified phone number.
 * @param to The phone number to call (E.164 format).
 * @param from The Twilio phone number to call from.
 * @param url The URL that returns the TwiML for the call (your ngrok URL + /incoming-call).
 */
export const makeCall = async (to: string, from: string, url: string) => {
  try {
    const twilioClient = getTwilioClient();
    const call = await twilioClient.calls.create({
      to,
      from,
      url, // Twilio fetches TwiML from here when the call connects
    });
    console.log(`Call initiated: ${call.sid}`);
    return call;
  } catch (error) {
    console.error('Error making call:', error);
    throw error;
  }
};
