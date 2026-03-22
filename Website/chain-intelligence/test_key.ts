import { GoPlus } from '@goplus/sdk-node';

async function testApi() {
  try {
    // @ts-ignore
    GoPlus.config({
      app_key: 'PHUp9ceQ32aMvEMjngnE',
      app_secret: 'EqZ6dbV1pWgK3n49g3BgTTz9922MP61Y'
    });
    // @ts-ignore
    const token = await GoPlus.getAccessToken();
    console.log("Token:", token);
    
    // @ts-ignore
    const res = await GoPlus.addressSecurity("1", "0x408e41876cccdc0f92210600ef50372656052a38", 30);
    console.log("Result:", res);
  } catch (e: any) {
    console.log("Failed:", e.message);
  }
}
testApi();
